import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterRequest(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    password: str = Field(min_length=8)
    client_type: str = "individual"
    role: Literal["client", "expert"] = "client"
    accept_terms: bool
    marketing_consent: bool = False

    @model_validator(mode="after")
    def validate_identity(self):
        if not self.email and not self.phone:
            raise ValueError("Email or phone is required")
        if not self.accept_terms:
            raise ValueError("Terms must be accepted")
        return self


class LoginRequest(BaseModel):
    identifier: str
    password: str


class ServiceRequestCreate(BaseModel):
    subcategory_id: uuid.UUID
    scope_details: dict


class ServiceCreate(BaseModel):
    category: str = Field(default="Professional services", min_length=2, max_length=120)
    name: str = Field(min_length=2, max_length=160)
    scope_schema: dict = Field(default_factory=dict)

    @field_validator("category", "name")
    @classmethod
    def trim_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value


class ServiceUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=2, max_length=120)
    name: str | None = Field(default=None, min_length=2, max_length=160)
    scope_schema: dict | None = None
    active: bool | None = None

    @field_validator("category", "name")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value


class RequestScopeUpdate(BaseModel):
    scope_details: dict


class ExpertResponse(BaseModel):
    action: str = Field(pattern="^(more_info|reject)$")
    reason: str = Field(min_length=3, max_length=1000)


class QuoteCreate(BaseModel):
    request_id: uuid.UUID
    amount: Decimal = Field(gt=0)


class QuoteDecision(BaseModel):
    action: Literal["accept", "reject"]
    reason: str | None = Field(default=None, max_length=1000)


class PaymentCreate(BaseModel):
    quote_id: uuid.UUID
    email: EmailStr
    phone: str
    first_name: str
    last_name: str


class WalletTopUpCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=32)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


class WithdrawalCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    provider: str = Field(pattern="^(mtn|airtel)$")
    phone: str


class ExpertApplicationCreate(BaseModel):
    subcategory_id: uuid.UUID
    documents: list[dict] = Field(default_factory=list)


class ApplicationReview(BaseModel):
    action: Literal["approve", "reject"]
    reason: str | None = Field(default=None, max_length=1000)
    interview_outcome: str | None = Field(default=None, max_length=2000)
    interview_scheduled_at: datetime | None = None


class ClientInfoReply(BaseModel):
    scope_details: dict


class DeliveryUpdate(BaseModel):
    evidence: list[dict] = Field(default_factory=list)


class DisputeCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)
    evidence: list[dict] = Field(default_factory=list)


class DisputeResolution(BaseModel):
    resolution: Literal["release", "refund", "partial"]
    note: str = Field(min_length=3, max_length=2000)
    amount_to_expert: Decimal | None = Field(default=None, ge=0)


class AvailabilityUpdate(BaseModel):
    is_available: bool


class PriceBandCreate(BaseModel):
    subcategory_id: uuid.UUID
    client_type: str
    minimum: Decimal = Field(ge=0)
    maximum: Decimal = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)


class WithdrawalReview(BaseModel):
    action: Literal["confirm", "fail"]
    provider_ref: str | None = None


class RoleUpdate(BaseModel):
    role: Literal["client", "expert", "admin"]
