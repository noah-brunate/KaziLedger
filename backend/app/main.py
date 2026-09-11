import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.bootstrap import initialize_database
from app.config import get_settings
from app.database import get_db
from app.models import (
    Dispute,
    EscrowTransaction,
    ExpertSubcategory,
    PriceBand,
    Quote,
    RequestAssignmentLog,
    RequestStatus,
    ServiceRequest,
    ServiceSubcategory,
    User,
    Wallet,
    WalletTopUp,
    WalletTransaction,
)
from app.pesapal import PesapalClient, PesapalError
from app.schemas import (
    ApplicationReview,
    AvailabilityUpdate,
    ClientInfoReply,
    DeliveryUpdate,
    DisputeCreate,
    DisputeResolution,
    ExpertApplicationCreate,
    ExpertResponse,
    LoginRequest,
    PriceBandCreate,
    QuoteCreate,
    QuoteDecision,
    RegisterRequest,
    RoleUpdate,
    RequestScopeUpdate,
    ServiceCreate,
    ServiceRequestCreate,
    ServiceUpdate,
    WalletTopUpCreate,
    WithdrawalCreate,
    WithdrawalReview,
)
from app.security import ROLE_PERMISSIONS, create_access_token, decode_access_token, hash_password, verify_password


settings = get_settings()
bearer = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await initialize_database(settings)
    yield


app = FastAPI(title="KaziLedger API", version="1.0.0", openapi_url="/api/v1/openapi.json", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.client_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    payload = decode_access_token(credentials.credentials)
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token") from exc
    user = await db.get(User, user_id)
    if not user or user.status.value != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is unavailable")
    return user


def require_role(user: User, *roles: str) -> None:
    if user.role not in roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account cannot perform that action")


def token_for(user: User) -> dict:
    permissions = ROLE_PERMISSIONS.get(user.role, ROLE_PERMISSIONS["client"])
    return {
        "access_token": create_access_token(user.id, permissions, user.role),
        "token_type": "bearer",
        "permissions": permissions,
        "role": user.role,
        "user_id": user.id,
    }


async def next_expert(db: AsyncSession, request: ServiceRequest, excluded: set[uuid.UUID]) -> uuid.UUID | None:
    query = select(ExpertSubcategory).where(
        ExpertSubcategory.subcategory_id == request.subcategory_id,
        ExpertSubcategory.status == "approved",
        ExpertSubcategory.is_available.is_(True),
    )
    if excluded:
        query = query.where(ExpertSubcategory.expert_id.not_in(excluded))
    candidate = (await db.scalars(query.order_by(ExpertSubcategory.updated_at.asc()))).first()
    return candidate.expert_id if candidate else None


async def assign_request(db: AsyncSession, request: ServiceRequest, excluded: set[uuid.UUID] | None = None) -> None:
    excluded = excluded or set()
    expert_id = await next_expert(db, request, excluded)
    request.assigned_expert_id = expert_id
    request.response_due_at = datetime.now(UTC) + timedelta(hours=settings.expert_response_hours) if expert_id else None
    request.status = RequestStatus.matching if expert_id else RequestStatus.closed
    db.add(RequestAssignmentLog(request_id=request.id, expert_id=expert_id, action="assigned" if expert_id else "experts_exhausted"))


async def assignment_history(db: AsyncSession, request_id: uuid.UUID) -> set[uuid.UUID]:
    rows = (await db.scalars(select(RequestAssignmentLog).where(RequestAssignmentLog.request_id == request_id))).all()
    return {row.expert_id for row in rows if row.expert_id}


async def get_request_for_user(db: AsyncSession, request_id: uuid.UUID, user: User) -> ServiceRequest:
    request = await db.get(ServiceRequest, request_id)
    if not request:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if user.role == "client" and request.client_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if user.role == "expert" and request.assigned_expert_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    return request


async def get_wallet(db: AsyncSession, user_id: uuid.UUID, *, lock: bool = False) -> Wallet:
    query = select(Wallet).where(Wallet.user_id == user_id)
    if lock:
        query = query.with_for_update()
    wallet = await db.scalar(query)
    if wallet:
        return wallet
    wallet = Wallet(user_id=user_id, balance=Decimal("0"), currency=settings.default_currency)
    db.add(wallet)
    await db.flush()
    return wallet


async def release_escrow(db: AsyncSession, escrow: EscrowTransaction, resolution: str = "release", amount_to_expert: Decimal | None = None) -> dict:
    if escrow.status in {"released", "refunded"}:
        return {"status": escrow.status, "already_processed": True}
    request = await db.get(ServiceRequest, escrow.request_id)
    quote = await db.scalar(select(Quote).where(Quote.request_id == escrow.request_id))
    expert_id = request.assigned_expert_id if request else (quote.expert_id if quote else None)
    if not request or not expert_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "The escrow has no assigned expert")
    if resolution == "refund":
        escrow.status = "refunded"
        request.status = RequestStatus.closed
        client_wallet = await get_wallet(db, request.client_id, lock=True)
        client_wallet.balance += escrow.amount
        db.add(WalletTransaction(wallet_id=client_wallet.id, type="escrow_refund", amount=escrow.amount, status="confirmed", escrow_id=escrow.id))
        await db.commit()
        return {"status": escrow.status, "amount_to_expert": Decimal("0"), "commission": Decimal("0")}
    gross = amount_to_expert if amount_to_expert is not None else escrow.amount
    if gross < 0 or gross > escrow.amount:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid release amount")
    commission = (gross * Decimal(str(settings.platform_commission_rate))).quantize(Decimal("0.01"))
    net = gross - commission
    wallet = await get_wallet(db, expert_id, lock=True)
    wallet.balance += net
    db.add(WalletTransaction(wallet_id=wallet.id, type="escrow_release", amount=net, status="confirmed", escrow_id=escrow.id))
    escrow.status = "released"
    request.status = RequestStatus.completed
    await db.commit()
    return {"status": escrow.status, "amount_to_expert": net, "commission": commission}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "environment": settings.app_env}


@app.post("/api/v1/auth/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    # Do not compare optional identifiers to NULL.  The former query generated
    # ``phone IS NULL`` for email-only registration and could therefore match a
    # completely different email-only account.
    email = str(payload.email).strip().lower() if payload.email else None
    phone = payload.phone.strip() if payload.phone else None
    identifiers = []
    if email:
        identifiers.append(func.lower(User.email) == email)
    if phone:
        identifiers.append(User.phone == phone)
    duplicate = await db.scalar(select(User).where(or_(*identifiers)))
    if duplicate:
        field = "email" if email and (duplicate.email or "").lower() == email else "phone number"
        raise HTTPException(409, f"An account already exists for this {field}. Please sign in or use a different {field}.")
    user = User(email=email, phone=phone, password_hash=hash_password(payload.password), client_type=payload.client_type, role=payload.role, marketing_consent=payload.marketing_consent)
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "An account already exists for this email or phone. Please sign in or use different details.") from exc
    await db.refresh(user)
    await get_wallet(db, user.id)
    await db.commit()
    return {"id": user.id, **token_for(user)}


@app.post("/api/v1/auth/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> dict:
    user = await db.scalar(select(User).where((User.email == payload.identifier) | (User.phone == payload.identifier)))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return token_for(user)


@app.get("/api/v1/auth/me")
async def me(user: User = Depends(current_user)) -> dict:
    return {"id": user.id, "email": user.email, "phone": user.phone, "role": user.role, "client_type": user.client_type}


@app.get("/api/v1/services")
async def list_services(db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = (await db.scalars(select(ServiceSubcategory).where(ServiceSubcategory.active.is_(True)).order_by(ServiceSubcategory.name))).all()
    return [{"id": row.id, "category": row.category, "name": row.name, "scope_schema": row.scope_schema, "active": row.active} for row in rows]


@app.post("/api/v1/requests", status_code=status.HTTP_201_CREATED)
async def create_request(payload: ServiceRequestCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "client")
    if not await db.get(ServiceSubcategory, payload.subcategory_id):
        raise HTTPException(404, "Service not found")
    request = ServiceRequest(client_id=user.id, subcategory_id=payload.subcategory_id, scope_details=payload.scope_details)
    db.add(request)
    await db.flush()
    await assign_request(db, request)
    await db.commit()
    return {"id": request.id, "status": request.status, "assigned_expert_id": request.assigned_expert_id, "response_due_at": request.response_due_at}


@app.get("/api/v1/requests")
async def list_requests(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    query = select(ServiceRequest).order_by(ServiceRequest.created_at.desc())
    if user.role == "client":
        query = query.where(ServiceRequest.client_id == user.id)
    elif user.role == "expert":
        query = query.where(ServiceRequest.assigned_expert_id == user.id)
    rows = (await db.scalars(query)).all()
    return [{"id": r.id, "status": r.status, "subcategory_id": r.subcategory_id, "client_id": r.client_id, "assigned_expert_id": r.assigned_expert_id, "scope_details": r.scope_details, "rejection_count": r.rejection_count, "response_due_at": r.response_due_at} for r in rows]


@app.get("/api/v1/requests/{request_id}")
async def get_request(request_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    request = await get_request_for_user(db, request_id, user)
    logs = (await db.scalars(select(RequestAssignmentLog).where(RequestAssignmentLog.request_id == request_id).order_by(RequestAssignmentLog.timestamp))).all()
    quote = await db.scalar(select(Quote).where(Quote.request_id == request_id))
    quote_payload = None if not quote else {"id": quote.id, "request_id": quote.request_id, "expert_id": quote.expert_id, "amount": quote.amount, "currency": quote.currency, "status": quote.status, "expires_at": quote.expires_at}
    return {"id": request.id, "status": request.status, "scope_details": request.scope_details, "rejection_count": request.rejection_count, "response_due_at": request.response_due_at, "logs": [{"action": l.action, "reason": l.reason, "expert_id": l.expert_id, "timestamp": l.timestamp} for l in logs], "quote": quote_payload}


@app.post("/api/v1/requests/{request_id}/respond")
async def respond(request_id: uuid.UUID, payload: ExpertResponse, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "expert")
    request = await get_request_for_user(db, request_id, user)
    if request.status not in {RequestStatus.matching, RequestStatus.needs_info}:
        raise HTTPException(409, "This request is no longer awaiting an expert response")
    if payload.action == "more_info":
        request.status = RequestStatus.needs_info
        request.response_due_at = None
        db.add(RequestAssignmentLog(request_id=request.id, expert_id=user.id, action="more_info", reason=payload.reason))
    else:
        request.rejection_count += 1
        db.add(RequestAssignmentLog(request_id=request.id, expert_id=user.id, action="reject", reason=payload.reason))
        if request.rejection_count >= 3:
            request.assigned_expert_id = None
            request.response_due_at = None
            request.status = RequestStatus.closed
        else:
            await assign_request(db, request, await assignment_history(db, request.id) | {user.id})
    await db.commit()
    return {"id": request.id, "status": request.status, "rejection_count": request.rejection_count, "assigned_expert_id": request.assigned_expert_id}


@app.post("/api/v1/requests/{request_id}/information")
async def reply_to_info(request_id: uuid.UUID, payload: ClientInfoReply, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "client")
    request = await get_request_for_user(db, request_id, user)
    if request.status != RequestStatus.needs_info:
        raise HTTPException(409, "This request is not waiting for information")
    request.scope_details = payload.scope_details
    request.status = RequestStatus.matching
    request.response_due_at = datetime.now(UTC) + timedelta(hours=settings.expert_response_hours)
    db.add(RequestAssignmentLog(request_id=request.id, expert_id=request.assigned_expert_id, action="client_replied"))
    await db.commit()
    return {"id": request.id, "status": request.status, "assigned_expert_id": request.assigned_expert_id}


@app.post("/api/v1/requests/{request_id}/resubmit")
async def resubmit_request(request_id: uuid.UUID, payload: RequestScopeUpdate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "client")
    request = await get_request_for_user(db, request_id, user)
    if request.status != RequestStatus.closed:
        raise HTTPException(409, "Only closed requests can be resubmitted")
    request.scope_details = payload.scope_details
    request.rejection_count = 0
    await assign_request(db, request)
    await db.commit()
    return {"id": request.id, "status": request.status, "assigned_expert_id": request.assigned_expert_id}


@app.post("/api/v1/quotes", status_code=status.HTTP_201_CREATED)
async def create_quote(payload: QuoteCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "expert")
    request = await get_request_for_user(db, payload.request_id, user)
    if request.status != RequestStatus.matching:
        raise HTTPException(409, "This request is not accepting quotes")
    client = await db.get(User, request.client_id)
    band = await db.scalar(select(PriceBand).where(PriceBand.subcategory_id == request.subcategory_id, PriceBand.client_type == client.client_type))
    if not band or not band.minimum <= payload.amount <= band.maximum:
        raise HTTPException(422, "Quote must be within the applicable price band")
    quote = Quote(request_id=request.id, expert_id=user.id, amount=payload.amount, currency=band.currency, expires_at=datetime.now(UTC) + timedelta(hours=48))
    request.status = RequestStatus.quoted
    db.add(quote)
    await db.commit()
    await db.refresh(quote)
    return {"id": quote.id, "request_id": quote.request_id, "amount": quote.amount, "currency": quote.currency, "status": quote.status, "expires_at": quote.expires_at}


@app.get("/api/v1/quotes")
async def list_quotes(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    query = select(Quote).order_by(Quote.created_at.desc())
    if user.role == "expert":
        query = query.where(Quote.expert_id == user.id)
    elif user.role == "client":
        query = query.join(ServiceRequest, Quote.request_id == ServiceRequest.id).where(ServiceRequest.client_id == user.id)
    rows = (await db.scalars(query)).all()
    return [{"id": q.id, "request_id": q.request_id, "amount": q.amount, "currency": q.currency, "status": q.status, "expires_at": q.expires_at} for q in rows]


@app.post("/api/v1/quotes/{quote_id}/decision")
async def quote_decision(quote_id: uuid.UUID, payload: QuoteDecision, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "client")
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")
    request = await get_request_for_user(db, quote.request_id, user)
    if quote.status != "pending" or (quote.expires_at and quote.expires_at < datetime.now(UTC)):
        quote.status = "expired"
        await db.commit()
        raise HTTPException(409, "Quote is no longer available")
    quote.status = "accepted" if payload.action == "accept" else "rejected"
    if payload.action == "reject":
        request.status = RequestStatus.closed
    await db.commit()
    return {"id": quote.id, "status": quote.status, "request_status": request.status}


@app.post("/api/v1/wallet/topups/pesapal", status_code=status.HTTP_201_CREATED)
async def start_wallet_topup(payload: WalletTopUpCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    """Create a Pesapal order that adds funds to the signed-in account wallet."""
    require_role(user, "client")
    wallet = await get_wallet(db, user.id, lock=True)
    topup = WalletTopUp(wallet_id=wallet.id, amount=payload.amount)
    db.add(topup)
    await db.flush()
    try:
        order = await PesapalClient(settings).submit_order(
            reference=f"WAL-{topup.id}", amount=payload.amount, description="KaziLedger wallet top-up",
            billing={"email_address": payload.email, "phone_number": payload.phone, "country_code": "UG", "first_name": payload.first_name, "last_name": payload.last_name},
        )
    except PesapalError as exc:
        await db.rollback()
        raise HTTPException(503, str(exc)) from exc
    topup.pesapal_tracking_id = order["order_tracking_id"]
    await db.commit()
    return {"id": topup.id, "redirect_url": order["redirect_url"], "tracking_id": topup.pesapal_tracking_id}


@app.post("/api/v1/quotes/{quote_id}/charge")
async def charge_quote_from_wallet(quote_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "client")
    quote = await db.get(Quote, quote_id)
    if not quote:
        raise HTTPException(404, "Quote not found")
    request = await get_request_for_user(db, quote.request_id, user)
    if quote.status != "accepted":
        raise HTTPException(409, "Accept the quote before charging your wallet")
    existing = await db.scalar(select(EscrowTransaction).where(EscrowTransaction.request_id == request.id, EscrowTransaction.status.in_(["pending", "funded", "disputed"])))
    if existing:
        raise HTTPException(409, "This request already has funded escrow")
    wallet = await get_wallet(db, user.id, lock=True)
    if wallet.balance < quote.amount:
        raise HTTPException(422, f"Insufficient wallet balance. Top up at least {quote.amount - wallet.balance} {quote.currency}.")
    wallet.balance -= quote.amount
    escrow = EscrowTransaction(request_id=request.id, amount=quote.amount, status="funded", release_at=datetime.now(UTC) + timedelta(hours=settings.escrow_release_hours))
    db.add(escrow)
    await db.flush()
    db.add(WalletTransaction(wallet_id=wallet.id, type="escrow_hold", amount=-quote.amount, status="confirmed", escrow_id=escrow.id))
    quote.status = "funded"
    request.status = RequestStatus.funded
    await db.commit()
    return {"id": escrow.id, "status": escrow.status, "wallet_balance": wallet.balance}


@app.api_route("/api/v1/payments/pesapal/ipn", methods=["GET", "POST"])
async def pesapal_ipn(OrderTrackingId: str, OrderMerchantReference: str, db: AsyncSession = Depends(get_db)) -> dict:
    topup = await db.scalar(select(WalletTopUp).where(WalletTopUp.pesapal_tracking_id == OrderTrackingId).with_for_update())
    if not topup:
        raise HTTPException(404, "Wallet top-up not found")
    details = await PesapalClient(settings).transaction_status(OrderTrackingId)
    if details.get("payment_status_description") == "Completed" and topup.status != "completed":
        wallet = await db.scalar(select(Wallet).where(Wallet.id == topup.wallet_id).with_for_update())
        if not wallet:
            raise HTTPException(404, "Wallet not found")
        wallet.balance += topup.amount
        topup.status = "completed"
        db.add(WalletTransaction(wallet_id=wallet.id, type="top_up", amount=topup.amount, status="confirmed", provider="pesapal", provider_ref=OrderTrackingId))
    await db.commit()
    return {"orderNotificationType": "IPNCHANGE", "orderTrackingId": OrderTrackingId, "orderMerchantReference": OrderMerchantReference, "status": 200}


@app.post("/api/v1/requests/{request_id}/deliver")
async def mark_delivered(request_id: uuid.UUID, payload: DeliveryUpdate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "expert")
    request = await get_request_for_user(db, request_id, user)
    if request.status not in {RequestStatus.funded, RequestStatus.in_progress}:
        raise HTTPException(409, "This request cannot be delivered yet")
    request.status = RequestStatus.delivered
    request.scope_details = {**request.scope_details, "delivery_evidence": payload.evidence}
    await db.commit()
    return {"id": request.id, "status": request.status}


@app.post("/api/v1/requests/{request_id}/complete")
async def confirm_completion(request_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "client")
    request = await get_request_for_user(db, request_id, user)
    escrow = await db.scalar(select(EscrowTransaction).where(EscrowTransaction.request_id == request.id, EscrowTransaction.status == "funded"))
    if request.status != RequestStatus.delivered or not escrow:
        raise HTTPException(409, "The request is not ready for completion")
    return await release_escrow(db, escrow)


@app.post("/api/v1/requests/{request_id}/disputes", status_code=status.HTTP_201_CREATED)
async def create_dispute(request_id: uuid.UUID, payload: DisputeCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "client")
    request = await get_request_for_user(db, request_id, user)
    escrow = await db.scalar(select(EscrowTransaction).where(EscrowTransaction.request_id == request.id, EscrowTransaction.status.in_(["funded", "pending"])))
    if not escrow or request.status not in {RequestStatus.funded, RequestStatus.in_progress, RequestStatus.delivered}:
        raise HTTPException(409, "This request is outside its dispute window")
    dispute = Dispute(request_id=request.id, raised_by_id=user.id, reason=payload.reason, evidence=payload.evidence)
    request.status = RequestStatus.disputed
    escrow.status = "disputed"
    db.add(dispute)
    await db.commit()
    return {"id": dispute.id, "status": dispute.status}


@app.get("/api/v1/disputes")
async def list_disputes(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    require_role(user, "admin")
    rows = (await db.scalars(select(Dispute).order_by(Dispute.created_at.desc()))).all()
    return [{"id": d.id, "request_id": d.request_id, "reason": d.reason, "evidence": d.evidence, "status": d.status, "resolution": d.resolution, "resolution_note": d.resolution_note} for d in rows]


@app.post("/api/v1/admin/disputes/{dispute_id}/resolve")
async def resolve_dispute(dispute_id: uuid.UUID, payload: DisputeResolution, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "admin")
    dispute = await db.get(Dispute, dispute_id)
    if not dispute or dispute.status != "open":
        raise HTTPException(404, "Open dispute not found")
    escrow = await db.scalar(select(EscrowTransaction).where(EscrowTransaction.request_id == dispute.request_id).with_for_update())
    dispute.status = "resolved"
    dispute.resolution = payload.resolution
    dispute.resolution_note = payload.note
    result = await release_escrow(db, escrow, payload.resolution, payload.amount_to_expert)
    return {"id": dispute.id, **result}


@app.get("/api/v1/wallet")
async def wallet(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    row = await get_wallet(db, user.id)
    transactions = (await db.scalars(select(WalletTransaction).where(WalletTransaction.wallet_id == row.id).order_by(WalletTransaction.created_at.desc()))).all()
    topups = (await db.scalars(select(WalletTopUp).where(WalletTopUp.wallet_id == row.id).order_by(WalletTopUp.created_at.desc()))).all()
    return {"balance": row.balance, "currency": row.currency, "transactions": [{"id": tx.id, "type": tx.type, "amount": tx.amount, "status": tx.status, "provider": tx.provider, "provider_ref": tx.provider_ref, "created_at": tx.created_at} for tx in transactions], "topups": [{"id": topup.id, "amount": topup.amount, "status": topup.status, "created_at": topup.created_at} for topup in topups]}


@app.post("/api/v1/wallet/withdrawals", status_code=status.HTTP_202_ACCEPTED)
async def withdraw(payload: WithdrawalCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "expert")
    wallet = await get_wallet(db, user.id, lock=True)
    if wallet.balance < payload.amount:
        raise HTTPException(422, "Insufficient available balance")
    wallet.balance -= payload.amount
    tx = WalletTransaction(wallet_id=wallet.id, type="withdrawal", amount=-payload.amount, status="pending", provider=payload.provider)
    db.add(tx)
    await db.commit()
    return {"id": tx.id, "status": tx.status, "provider": tx.provider, "message": "Payout queued for gateway confirmation"}


@app.post("/api/v1/admin/withdrawals/{transaction_id}/review")
async def review_withdrawal(transaction_id: uuid.UUID, payload: WithdrawalReview, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "admin")
    tx = await db.get(WalletTransaction, transaction_id)
    if not tx or tx.type != "withdrawal" or tx.status != "pending":
        raise HTTPException(404, "Pending withdrawal not found")
    tx.status = "confirmed" if payload.action == "confirm" else "failed"
    tx.provider_ref = payload.provider_ref
    if payload.action == "fail":
        wallet_row = await db.scalar(select(Wallet).where(Wallet.id == tx.wallet_id).with_for_update())
        wallet_row.balance += abs(tx.amount)
    await db.commit()
    return {"id": tx.id, "status": tx.status}


@app.get("/api/v1/admin/withdrawals")
async def pending_withdrawals(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    require_role(user, "admin")
    rows = (await db.scalars(select(WalletTransaction).where(WalletTransaction.type == "withdrawal", WalletTransaction.status == "pending").order_by(WalletTransaction.created_at))).all()
    return [{"id": tx.id, "wallet_id": tx.wallet_id, "amount": tx.amount, "provider": tx.provider, "status": tx.status, "created_at": tx.created_at} for tx in rows]


@app.post("/api/v1/expert/applications", status_code=status.HTTP_201_CREATED)
async def apply_as_expert(payload: ExpertApplicationCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "expert")
    if not await db.get(ServiceSubcategory, payload.subcategory_id):
        raise HTTPException(404, "Service not found")
    existing = await db.scalar(select(ExpertSubcategory).where(ExpertSubcategory.expert_id == user.id, ExpertSubcategory.subcategory_id == payload.subcategory_id, ExpertSubcategory.status.in_(["pending", "approved"])))
    if existing:
        raise HTTPException(409, "An active application already exists for this service")
    application = ExpertSubcategory(expert_id=user.id, subcategory_id=payload.subcategory_id, status="pending", documents=payload.documents, is_available=False)
    db.add(application)
    await db.commit()
    await db.refresh(application)
    return {"id": application.id, "status": application.status, "subcategory_id": application.subcategory_id}


@app.get("/api/v1/expert/applications")
async def expert_applications(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    require_role(user, "expert", "admin")
    query = select(ExpertSubcategory).order_by(ExpertSubcategory.created_at.desc())
    if user.role == "expert":
        query = query.where(ExpertSubcategory.expert_id == user.id)
    rows = (await db.scalars(query)).all()
    return [{"id": row.id, "expert_id": row.expert_id, "subcategory_id": row.subcategory_id, "status": row.status, "is_available": row.is_available, "documents": row.documents, "interview_outcome": row.interview_outcome, "interview_scheduled_at": row.interview_scheduled_at} for row in rows]


@app.post("/api/v1/admin/applications/{application_id}/review")
async def review_application(application_id: uuid.UUID, payload: ApplicationReview, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "admin")
    application = await db.get(ExpertSubcategory, application_id)
    if not application:
        raise HTTPException(404, "Application not found")
    if payload.action == "reject" and not payload.reason:
        raise HTTPException(422, "A rejection reason is required")
    application.status = "approved" if payload.action == "approve" else "rejected"
    application.is_available = payload.action == "approve"
    application.interview_outcome = payload.interview_outcome or payload.reason
    application.interview_scheduled_at = payload.interview_scheduled_at
    await db.commit()
    return {"id": application.id, "status": application.status, "reason": application.interview_outcome}


@app.patch("/api/v1/expert/services/{application_id}/availability")
async def update_availability(application_id: uuid.UUID, payload: AvailabilityUpdate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "expert")
    application = await db.get(ExpertSubcategory, application_id)
    if not application or application.expert_id != user.id or application.status != "approved":
        raise HTTPException(404, "Approved service not found")
    application.is_available = payload.is_available
    await db.commit()
    return {"id": application.id, "is_available": application.is_available}


def service_response(service: ServiceSubcategory) -> dict:
    return {
        "id": service.id,
        "category": service.category,
        "name": service.name,
        "scope_schema": service.scope_schema,
        "active": service.active,
    }


@app.get("/api/v1/admin/services")
async def admin_services(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    """Return the complete catalogue, including services hidden from new requests."""
    require_role(user, "admin")
    rows = (await db.scalars(select(ServiceSubcategory).order_by(ServiceSubcategory.category, ServiceSubcategory.name))).all()
    return [service_response(row) for row in rows]


@app.post("/api/v1/admin/services", status_code=status.HTTP_201_CREATED)
async def create_service(payload: ServiceCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "admin")
    existing = await db.scalar(select(ServiceSubcategory).where(func.lower(ServiceSubcategory.name) == payload.name.lower()))
    if existing:
        raise HTTPException(409, "A service with this name already exists")
    service = ServiceSubcategory(**payload.model_dump())
    db.add(service)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "A service with this name already exists") from exc
    await db.refresh(service)
    return service_response(service)


@app.patch("/api/v1/admin/services/{service_id}")
async def update_service(service_id: uuid.UUID, payload: ServiceUpdate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "admin")
    service = await db.get(ServiceSubcategory, service_id)
    if not service:
        raise HTTPException(404, "Service not found")
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        duplicate = await db.scalar(select(ServiceSubcategory).where(func.lower(ServiceSubcategory.name) == changes["name"].lower(), ServiceSubcategory.id != service_id))
        if duplicate:
            raise HTTPException(409, "A service with this name already exists")
    for field, value in changes.items():
        setattr(service, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "A service with this name already exists") from exc
    await db.refresh(service)
    return service_response(service)


@app.post("/api/v1/admin/price-bands", status_code=status.HTTP_201_CREATED)
async def create_price_band(payload: PriceBandCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "admin")
    if payload.minimum >= payload.maximum:
        raise HTTPException(422, "Minimum must be below maximum")
    service = await db.get(ServiceSubcategory, payload.subcategory_id)
    if not service or not service.active:
        raise HTTPException(404, "Active service not found")
    band = PriceBand(**payload.model_dump())
    db.add(band)
    await db.commit()
    await db.refresh(band)
    return {"id": band.id, "subcategory_id": band.subcategory_id, "client_type": band.client_type, "minimum": band.minimum, "maximum": band.maximum, "currency": band.currency}


@app.get("/api/v1/admin/users")
async def admin_users(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> list[dict]:
    require_role(user, "admin")
    rows = (await db.scalars(select(User).order_by(User.created_at.desc()))).all()
    return [{"id": row.id, "email": row.email, "phone": row.phone, "role": row.role, "status": row.status} for row in rows]


@app.patch("/api/v1/admin/users/{user_id}/role")
async def update_user_role(user_id: uuid.UUID, payload: RoleUpdate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "admin")
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    target.role = payload.role
    await db.commit()
    return {"id": target.id, "role": target.role}


@app.post("/api/v1/admin/jobs/process")
async def process_jobs(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "admin")
    now = datetime.now(UTC)
    timed_out = (await db.scalars(select(ServiceRequest).where(ServiceRequest.status == RequestStatus.matching, ServiceRequest.response_due_at.is_not(None), ServiceRequest.response_due_at < now))).all()
    for request in timed_out:
        if request.assigned_expert_id:
            db.add(RequestAssignmentLog(request_id=request.id, expert_id=request.assigned_expert_id, action="timeout", reason="Expert response window expired"))
            request.rejection_count += 1
            if request.rejection_count >= 3:
                request.assigned_expert_id = None
                request.response_due_at = None
                request.status = RequestStatus.closed
            else:
                await assign_request(db, request, await assignment_history(db, request.id))
    expired_quotes = (await db.scalars(select(Quote).where(Quote.status == "pending", Quote.expires_at < now))).all()
    for quote in expired_quotes:
        quote.status = "expired"
        request = await db.get(ServiceRequest, quote.request_id)
        if request and request.status == RequestStatus.quoted:
            request.status = RequestStatus.closed
    released = 0
    escrows = (await db.scalars(select(EscrowTransaction).where(EscrowTransaction.status == "funded", EscrowTransaction.release_at.is_not(None), EscrowTransaction.release_at < now))).all()
    for escrow in escrows:
        await release_escrow(db, escrow)
        released += 1
    await db.commit()
    return {"timed_out": len(timed_out), "expired_quotes": len(expired_quotes), "released_escrows": released}


@app.get("/api/v1/admin/metrics")
async def metrics(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> dict:
    require_role(user, "admin")
    request_count = await db.scalar(select(func.count(ServiceRequest.id)))
    open_escrow = await db.scalar(select(func.coalesce(func.sum(EscrowTransaction.amount), 0)).where(EscrowTransaction.status.in_(["funded", "disputed"])))
    pending_applications = await db.scalar(select(func.count(ExpertSubcategory.id)).where(ExpertSubcategory.status == "pending"))
    open_disputes = await db.scalar(select(func.count(Dispute.id)).where(Dispute.status == "open"))
    return {"requests": request_count, "open_escrow": open_escrow, "pending_applications": pending_applications, "open_disputes": open_disputes, "currency": settings.default_currency, "settings": {"expert_response_hours": settings.expert_response_hours, "escrow_release_hours": settings.escrow_release_hours, "commission_rate": settings.platform_commission_rate}}


# Keep this catch-all last: otherwise it would intercept API, health, and docs routes.
static_path = (Path(__file__).resolve().parent.parent / "static").resolve()
client_static_dir = static_path if (static_path / "index.html").is_file() else None


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_client(full_path: str) -> FileResponse:
    if not client_static_dir or full_path.startswith("api/"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

    relative_path = full_path.strip("/")
    if relative_path == "favicon.ico" and (client_static_dir / "favicon.svg").is_file():
        return FileResponse(client_static_dir / "favicon.svg", media_type="image/svg+xml")

    candidates = [
        client_static_dir / relative_path,
        client_static_dir / f"{relative_path}.html",
        client_static_dir / relative_path / "index.html",
    ] if relative_path else [client_static_dir / "index.html"]

    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved.is_relative_to(client_static_dir) and resolved.is_file():
            return FileResponse(resolved)

    not_found = client_static_dir / "404.html"
    if not_found.is_file():
        return FileResponse(not_found, status_code=status.HTTP_404_NOT_FOUND)
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
