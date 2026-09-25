import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class UserStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    pending = "pending"


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", UUID(as_uuid=True), ForeignKey("permissions.id"), primary_key=True),
)

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True),
)


class Role(Timestamped, Base):
    __tablename__ = "roles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)


class Permission(Base):
    __tablename__ = "permissions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str | None] = mapped_column(Text)


class RequestStatus(str, enum.Enum):
    matching = "matching"
    needs_info = "needs_info"
    quoted = "quoted"
    funded = "funded"
    in_progress = "in_progress"
    delivered = "delivered"
    disputed = "disputed"
    completed = "completed"
    closed = "closed"


class User(Timestamped, Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=True, index=True
    )
    email: Mapped[str | None] = mapped_column(String(320), unique=True)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True)
    # Retained temporarily for a safe legacy-data migration. New passwords are
    # owned and hashed exclusively by Supabase Auth.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.active)
    client_type: Mapped[str] = mapped_column(String(24), default="individual")
    role: Mapped[str] = mapped_column(String(24), default="client")
    marketing_consent: Mapped[bool] = mapped_column(Boolean, default=False)


class ServiceSubcategory(Timestamped, Base):
    __tablename__ = "service_subcategories"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(120), default="Professional services")
    name: Mapped[str] = mapped_column(String(160), unique=True)
    scope_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class PriceBand(Timestamped, Base):
    __tablename__ = "price_bands"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subcategory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_subcategories.id"))
    client_type: Mapped[str] = mapped_column(String(24))
    minimum: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    maximum: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3), default="UGX")


class ExpertSubcategory(Timestamped, Base):
    __tablename__ = "expert_subcategories"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    subcategory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_subcategories.id"))
    status: Mapped[str] = mapped_column(String(24), default="pending")
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    documents: Mapped[list] = mapped_column(JSON, default=list)
    interview_outcome: Mapped[str | None] = mapped_column(Text)
    interview_scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ServiceRequest(Timestamped, Base):
    __tablename__ = "service_requests"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    subcategory_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_subcategories.id"))
    assigned_expert_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus), default=RequestStatus.matching
    )
    scope_details: Mapped[dict] = mapped_column(JSON)
    rejection_count: Mapped[int] = mapped_column(default=0)
    response_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RequestAssignmentLog(Base):
    __tablename__ = "request_assignment_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_requests.id"), index=True)
    expert_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str | None] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Quote(Timestamped, Base):
    __tablename__ = "quotes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_requests.id"), unique=True)
    expert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3), default="UGX")
    status: Mapped[str] = mapped_column(String(24), default="pending")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class EscrowTransaction(Timestamped, Base):
    __tablename__ = "escrow_transactions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_requests.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    status: Mapped[str] = mapped_column(String(24), default="pending")
    pesapal_tracking_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    release_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WalletTopUp(Timestamped, Base):
    __tablename__ = "wallet_topups"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wallets.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    status: Mapped[str] = mapped_column(String(24), default="pending")
    pesapal_tracking_id: Mapped[str | None] = mapped_column(String(120), unique=True)


class Dispute(Timestamped, Base):
    __tablename__ = "disputes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_requests.id"), unique=True)
    raised_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(24), default="open")
    resolution: Mapped[str | None] = mapped_column(String(24))
    resolution_note: Mapped[str | None] = mapped_column(Text)


class Wallet(Timestamped, Base):
    __tablename__ = "wallets"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # ``expert_id`` remains for compatibility with the first local schema.
    # ``user_id`` is the wallet owner for both clients and experts.
    expert_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), unique=True, nullable=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), unique=True, nullable=True, index=True
    )
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="UGX")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wallets.id"), index=True)
    type: Mapped[str] = mapped_column(String(32))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    status: Mapped[str] = mapped_column(String(24), default="pending")
    provider: Mapped[str | None] = mapped_column(String(24))
    provider_ref: Mapped[str | None] = mapped_column(String(120))
    escrow_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("escrow_transactions.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
