from decimal import Decimal

import httpx

from app.config import Settings


class PesapalError(RuntimeError):
    pass


class PesapalClient:
    """API 3.0 collection adapter. Payout remains separately capability-gated by the merchant account."""

    def __init__(self, settings: Settings):
        self.settings = settings

    async def _token(self, client: httpx.AsyncClient) -> str:
        if not self.settings.pesapal_consumer_key or not self.settings.pesapal_consumer_secret:
            raise PesapalError("Pesapal credentials are not configured")
        response = await client.post(
            f"{self.settings.pesapal_base_url}/Auth/RequestToken",
            json={"consumer_key": self.settings.pesapal_consumer_key, "consumer_secret": self.settings.pesapal_consumer_secret},
        )
        response.raise_for_status()
        token = response.json().get("token")
        if not token:
            raise PesapalError("Pesapal did not return an access token")
        return token

    async def submit_order(self, *, reference: str, amount: Decimal, description: str, billing: dict) -> dict:
        async with httpx.AsyncClient(timeout=20) as client:
            token = await self._token(client)
            response = await client.post(
                f"{self.settings.pesapal_base_url}/Transactions/SubmitOrderRequest",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "id": reference,
                    "currency": self.settings.default_currency,
                    "amount": float(amount),
                    "description": description,
                    "callback_url": self.settings.pesapal_callback_url,
                    "notification_id": self.settings.pesapal_ipn_id,
                    "billing_address": billing,
                },
            )
            response.raise_for_status()
            data = response.json()
            if data.get("error"):
                raise PesapalError(str(data["error"]))
            return data

    async def transaction_status(self, tracking_id: str) -> dict:
        async with httpx.AsyncClient(timeout=20) as client:
            token = await self._token(client)
            response = await client.get(
                f"{self.settings.pesapal_base_url}/Transactions/GetTransactionStatus",
                params={"orderTrackingId": tracking_id},
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            return response.json()

