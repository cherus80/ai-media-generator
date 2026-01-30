"""
GrsAI Nano Banana API client (URL-based).

Endpoints:
- POST /v1/draw/nano-banana
- POST /v1/draw/result
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings

logger = logging.getLogger(__name__)


class GrsAIError(Exception):
    """Base exception for GrsAI API errors."""


class GrsAIAuthError(GrsAIError):
    """Authentication error (401/403)."""


class GrsAIRateLimitError(GrsAIError):
    """Rate limit exceeded (429)."""


class GrsAIServerError(GrsAIError):
    """Server error (5xx)."""


class GrsAITimeoutError(GrsAIError):
    """Request/polling timeout."""


class GrsAITaskFailedError(GrsAIError):
    """Task processing failed on GrsAI side."""


class GrsAIClient:
    """
    Async client for GrsAI Nano Banana API.

    - URL-based inputs (urls)
    - Polling via result endpoint
    """

    SUBMIT_ENDPOINT = "/v1/draw/nano-banana"
    RESULT_ENDPOINT = "/v1/draw/result"

    DEFAULT_POLL_INTERVAL = 5
    DEFAULT_MAX_POLLS = 60  # ~300s with 5s interval

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[int] = None,
        poll_interval: Optional[int] = None,
        max_polls: Optional[int] = None,
        model: Optional[str] = None,
        image_size: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or settings.GRS_AI_API_KEY
        if not self.api_key:
            raise GrsAIError("GRS_AI_API_KEY not configured")

        self.base_url = (base_url or settings.GRS_AI_BASE_URL).rstrip("/")
        self.submit_url = f"{self.base_url}{self.SUBMIT_ENDPOINT}"
        self.result_url = f"{self.base_url}{self.RESULT_ENDPOINT}"

        self.timeout = timeout or settings.GRS_AI_TIMEOUT
        self.poll_interval = poll_interval or settings.GRS_AI_POLL_INTERVAL
        self.max_polls = max_polls or settings.GRS_AI_MAX_POLLS or self.DEFAULT_MAX_POLLS
        self.model = model or settings.GRS_AI_MODEL
        self.image_size = image_size or settings.GRS_AI_IMAGE_SIZE

        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.timeout),
            headers={"Authorization": f"Bearer {self.api_key}"},
        )

        logger.info(
            "GrsAIClient initialized (base=%s, timeout=%ss, poll=%ss, max_polls=%s)",
            self.base_url,
            self.timeout,
            self.poll_interval,
            self.max_polls,
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    # ---------------------------------------------------------------
    # Public helpers
    # ---------------------------------------------------------------

    async def generate_image(
        self,
        prompt: str,
        urls: Optional[List[str]] = None,
        aspect_ratio: str = "auto",
        image_size: Optional[str] = None,
        model: Optional[str] = None,
        progress_callback: Optional[callable] = None,
    ) -> str:
        logger.info("Starting GrsAI generation: prompt=%s...", prompt[:50])

        payload: Dict = {
            "model": model or self.model,
            "prompt": prompt,
            "aspectRatio": aspect_ratio or "auto",
            "imageSize": image_size or self.image_size,
            "webHook": "-1",
            "shutProgress": False,
        }
        if urls:
            payload["urls"] = urls

        try:
            task_id, direct_url = await self._submit_task(payload)
        except (httpx.TimeoutException, httpx.RequestError) as err:
            raise GrsAITimeoutError(str(err)) from err

        if direct_url:
            return direct_url

        try:
            task_data = await self._poll_task_until_complete(task_id, progress_callback)
        except (httpx.TimeoutException, httpx.RequestError) as err:
            raise GrsAITimeoutError(str(err)) from err
        return self._extract_image_from_result(task_data)

    # ---------------------------------------------------------------
    # Internal: submit/poll/extract
    # ---------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True,
    )
    async def _submit_task(self, payload: Dict) -> tuple[str, Optional[str]]:
        response = await self.client.post(self.submit_url, json=payload)

        if response.status_code in (401, 403):
            raise GrsAIAuthError("Invalid API key")
        if response.status_code == 429:
            raise GrsAIRateLimitError("Rate limit exceeded")
        if response.status_code >= 500:
            raise GrsAIServerError(f"GrsAI server error: {response.status_code}")
        if response.status_code != 200:
            raise GrsAIError(f"GrsAI API error: {response.status_code}, details: {response.text}")

        body = response.json()
        if isinstance(body, dict) and body.get("code") not in (None, 0):
            raise GrsAIError(f"GrsAI API error: {body.get('msg') or body}")

        data = body.get("data", {}) if isinstance(body, dict) else {}
        task_id = data.get("id") or body.get("id")

        results = body.get("results") if isinstance(body, dict) else None
        if not results and isinstance(data, dict):
            results = data.get("results")

        if results:
            url = self._extract_url_from_results(results)
            return task_id or "", url

        if not task_id:
            raise GrsAIError(f"Task ID not found in response: {body}")

        logger.info("Submitted task to GrsAI: id=%s", task_id)
        return task_id, None

    async def _poll_task_until_complete(
        self,
        task_id: str,
        progress_callback: Optional[callable] = None,
    ) -> Dict:
        start_time = time.time()
        polls = 0

        while polls < self.max_polls:
            polls += 1
            elapsed = time.time() - start_time

            response = await self.client.post(self.result_url, json={"id": task_id})

            if response.status_code in (401, 403):
                raise GrsAIAuthError("Invalid API key")
            if response.status_code == 429:
                raise GrsAIRateLimitError("Rate limit exceeded")
            if response.status_code >= 500:
                raise GrsAIServerError(f"Result check failed: {response.status_code}")
            if response.status_code != 200:
                raise GrsAIError(f"GrsAI result API error: {response.status_code}")

            raw = response.json()
            if raw.get("code") not in (None, 0):
                raise GrsAIError(f"GrsAI result error: {raw.get('msg') or raw}")

            data = raw.get("data", raw) or {}
            status = data.get("status")
            progress = data.get("progress")

            if progress_callback and isinstance(progress, (int, float)):
                try:
                    await progress_callback("running", int(progress))
                except Exception:
                    logger.warning("Progress callback failed", exc_info=True)

            if status == "succeeded":
                return data
            if status == "failed":
                reason = data.get("failure_reason") or data.get("error") or "unknown"
                raise GrsAITaskFailedError(f"Task failed: {reason}")

            logger.info(
                "Task %s polling (poll %s/%s): status=%s, elapsed=%.1fs",
                task_id,
                polls,
                self.max_polls,
                status,
                elapsed,
            )

            await asyncio.sleep(self.poll_interval)

        raise GrsAITimeoutError(f"Task {task_id} timeout after {self.max_polls} polls")

    @staticmethod
    def _extract_url_from_results(results: List[Dict]) -> str:
        if not results:
            raise GrsAIError("No results returned from GrsAI")

        first = results[0] or {}
        url = first.get("url") if isinstance(first, dict) else None
        if not url:
            raise GrsAIError("No image URL in GrsAI results")
        return url

    def _extract_image_from_result(self, data: Dict) -> str:
        results = data.get("results") or []
        return self._extract_url_from_results(results)
