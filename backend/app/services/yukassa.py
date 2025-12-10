"""
Сервис для работы с ЮKassa API.

Интеграция с платёжной системой ЮKassa (YooMoney):
- Создание платежей
- Проверка статуса платежей
- Верификация webhook подписи
"""

import hmac
import hashlib
import base64
import logging
from typing import Optional
from decimal import Decimal
from uuid import uuid4

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.core.config import settings


logger = logging.getLogger(__name__)


class YuKassaError(Exception):
    """Базовая ошибка ЮKassa API"""

    pass


class YuKassaAuthError(YuKassaError):
    """Ошибка авторизации в ЮKassa"""

    pass


class YuKassaPaymentError(YuKassaError):
    """Ошибка создания/обработки платежа"""

    pass


class YuKassaClient:
    """
    Клиент для работы с ЮKassa API.

    Документация: https://yookassa.ru/developers/api
    """

    API_BASE_URL = "https://api.yookassa.ru/v3"

    def __init__(
        self,
        shop_id: str,
        secret_key: str,
        return_url: Optional[str] = None,
    ):
        """
        Инициализация клиента ЮKassa.

        Args:
            shop_id: ID магазина в ЮKassa
            secret_key: Секретный ключ для API
            return_url: URL для возврата после оплаты
        """
        self.shop_id = shop_id
        self.secret_key = secret_key
        self.return_url = return_url or f"{settings.FRONTEND_URL}/payment/success"
        self.idempotency_header = settings.YOOKASSA_IDEMPOTENCY_HEADER or "Idempotence-Key"

        # HTTP клиент с Basic Auth
        auth_string = f"{shop_id}:{secret_key}"
        auth_bytes = auth_string.encode("utf-8")
        auth_b64 = base64.b64encode(auth_bytes).decode("utf-8")

        self.client = httpx.AsyncClient(
            base_url=self.API_BASE_URL,
            headers={
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def close(self):
        """Закрытие HTTP клиента"""
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    )
    async def create_payment(
        self,
        amount: Decimal,
        description: str,
        idempotency_key: Optional[str] = None,
        metadata: Optional[dict] = None,
        receipt: Optional[dict] = None,
    ) -> dict:
        """
        Создание платежа в ЮKassa.

        Args:
            amount: Сумма платежа в рублях
            description: Описание платежа
            idempotency_key: Ключ идемпотентности (UUID)
            metadata: Метаданные платежа (до 16 пар ключ-значение)
            receipt: Чек (customer, items) — обязателен для большинства мерчантов

        Returns:
            dict: Ответ от ЮKassa API с данными платежа

        Raises:
            YuKassaAuthError: Ошибка авторизации
            YuKassaPaymentError: Ошибка создания платежа
        """
        if idempotency_key is None:
            idempotency_key = str(uuid4())

        # Формируем запрос
        payload = {
            "amount": {
                "value": f"{amount:.2f}",
                "currency": "RUB",
            },
            "confirmation": {
                "type": "redirect",
                "return_url": self.return_url,
            },
            "capture": True,  # Автоматическое подтверждение
            "description": description,
        }

        if metadata:
            payload["metadata"] = metadata
        if receipt:
            payload["receipt"] = receipt

        try:
            response = await self.client.post(
                "/payments",
                json=payload,
                headers={
                    self.idempotency_header: idempotency_key,
                },
            )

            if response.status_code == 401:
                logger.error("YuKassa authentication failed")
                raise YuKassaAuthError("Invalid shop_id or secret_key")

            if response.status_code >= 400:
                error_data = response.json()
                logger.error(f"YuKassa payment creation failed: {error_data}")
                raise YuKassaPaymentError(
                    f"Payment creation failed: {error_data.get('description', 'Unknown error')}"
                )

            payment_data = response.json()
            logger.info(
                f"YuKassa payment created: {payment_data['id']} for {amount} RUB"
            )

            return payment_data

        except httpx.HTTPError as e:
            logger.error(f"YuKassa API HTTP error: {e}")
            raise YuKassaPaymentError(f"HTTP error: {e}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    )
    async def get_payment_info(self, payment_id: str) -> dict:
        """
        Получение информации о платеже.

        Args:
            payment_id: UUID платежа в ЮKassa

        Returns:
            dict: Данные платежа

        Raises:
            YuKassaAuthError: Ошибка авторизации
            YuKassaPaymentError: Платёж не найден
        """
        try:
            response = await self.client.get(f"/payments/{payment_id}")

            if response.status_code == 401:
                raise YuKassaAuthError("Invalid shop_id or secret_key")

            if response.status_code == 404:
                raise YuKassaPaymentError(f"Payment {payment_id} not found")

            if response.status_code >= 400:
                error_data = response.json()
                raise YuKassaPaymentError(
                    f"Failed to get payment info: {error_data.get('description', 'Unknown error')}"
                )

            return response.json()

        except httpx.HTTPError as e:
            logger.error(f"YuKassa API HTTP error: {e}")
            raise YuKassaPaymentError(f"HTTP error: {e}")

    def verify_webhook_signature(
        self, payload: str, signature: str
    ) -> bool:
        """
        Проверка подписи webhook от ЮKassa.

        Args:
            payload: Тело запроса (JSON string)
            signature: Значение заголовка X-Yookassa-Signature

        Returns:
            bool: True если подпись валидна

        Note:
            Документация: https://yookassa.ru/developers/using-api/webhooks#verifying
        """
        try:
            secret = settings.YUKASSA_WEBHOOK_SECRET or self.secret_key
            if not secret:
                logger.error("YuKassa webhook secret is not configured")
                return False

            # Документация: base64(HMAC_SHA256(payload, webhook_secret))
            secret_bytes = secret.encode("utf-8")
            payload_bytes = payload.encode("utf-8")

            expected_signature = base64.b64encode(
                hmac.new(secret_bytes, payload_bytes, hashlib.sha256).digest()
            ).decode("utf-8")

            # Сравниваем подписи (constant-time comparison)
            return hmac.compare_digest(expected_signature, signature)

        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False


# Singleton instance
_yukassa_client: Optional[YuKassaClient] = None


def get_yukassa_client():
    """
    Получение singleton экземпляра YuKassaClient.

    В зависимости от PAYMENT_MOCK_MODE возвращает либо реальный,
    либо mock-клиент для тестирования.

    Returns:
        YuKassaClient | MockYuKassaClient: Клиент ЮKassa
    """
    global _yukassa_client

    # Проверяем, включён ли mock-режим
    if settings.PAYMENT_MOCK_MODE:
        from app.services.yukassa_mock import get_mock_yukassa_client
        logger.warning("🔧 PAYMENT_MOCK_MODE is enabled - using MockYuKassaClient")
        return get_mock_yukassa_client()

    if _yukassa_client is None:
        if not settings.YUKASSA_SHOP_ID or not settings.YUKASSA_SECRET_KEY:
            raise ValueError("YuKassa credentials are not configured")

        _yukassa_client = YuKassaClient(
            shop_id=settings.YUKASSA_SHOP_ID,
            secret_key=settings.YUKASSA_SECRET_KEY,
        )

    return _yukassa_client


async def close_yukassa_client():
    """Закрытие HTTP клиента YuKassa"""
    global _yukassa_client

    if _yukassa_client is not None:
        await _yukassa_client.close()
        _yukassa_client = None
