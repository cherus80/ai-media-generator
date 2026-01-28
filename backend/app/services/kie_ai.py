"""
kie.ai Nano Banana API client (URL-based).

Implements createTask/status polling endpoints:
- POST /api/v1/jobs/createTask
- GET  /api/v1/gpt4o-image/record-info?taskId=...
"""

import asyncio
import json
import logging
import time
from typing import Dict, Optional, List

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings

logger = logging.getLogger(__name__)


class KieAIError(Exception):
    """Base exception for kie.ai API errors."""


class KieAIAuthError(KieAIError):
    """Authentication error (401)."""


class KieAIRateLimitError(KieAIError):
    """Rate limit exceeded (429)."""


class KieAITimeoutError(KieAIError):
    """Request/polling timeout."""


class KieAITaskFailedError(KieAIError):
    """Task processing failed on kie.ai side."""


class KieAIClient:
    """
    Async client for kie.ai Nano Banana API (google/nano-banana).

    - URL-based inputs (image_urls)
    - Polling via record-info endpoint (successFlag/progress)
    """

    BASE_URL = "https://api.kie.ai"  # root, without /api/v1
    SUBMIT_ENDPOINT = "/api/v1/jobs/createTask"
    STATUS_ENDPOINT = "/api/v1/jobs/recordInfo"
    MODEL_NAME = "nano-banana-pro"  # согласно актуальной документации

    DEFAULT_POLL_INTERVAL = 5
    DEFAULT_MAX_POLLS = 36  # ~180s с интервалом 5 секунд

    SUPPORTED_ASPECT_RATIOS = [
        "1:1",
        "9:16",
        "16:9",
        "3:4",
        "4:3",
        "3:2",
        "2:3",
        "5:4",
        "4:5",
        "21:9",
        "auto",
    ]

    SUPPORTED_OUTPUT_FORMATS = ["png", "jpeg", "jpg"]

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[int] = None,
        poll_interval: Optional[int] = None,
        max_polls: Optional[int] = None,
    ):
        self.api_key = api_key or settings.KIE_AI_API_KEY
        if not self.api_key:
            raise KieAIError("KIE_AI_API_KEY not configured")

        raw_base = (base_url or settings.KIE_AI_BASE_URL or self.BASE_URL).rstrip("/")
        if raw_base.endswith("/api/v1"):
            raw_base = raw_base[:-7]
        elif raw_base.endswith("/v1"):
            raw_base = raw_base[:-3]
        self.base_root = raw_base
        self.submit_url = f"{self.base_root}{self.SUBMIT_ENDPOINT}"
        self.status_url = f"{self.base_root}{self.STATUS_ENDPOINT}"

        self.timeout = timeout or settings.KIE_AI_TIMEOUT
        self.poll_interval = poll_interval or settings.KIE_AI_POLL_INTERVAL
        self.max_polls = max_polls or self.DEFAULT_MAX_POLLS

        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.timeout),
            headers={"Authorization": f"Bearer {self.api_key}"},
        )

        logger.info(
            "KieAIClient initialized (base=%s, timeout=%ss, poll=%ss, max_polls=%s)",
            self.base_root,
            self.timeout,
            self.poll_interval,
            self.max_polls,
        )

    async def close(self):
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    # ---------------------------------------------------------------
    # Public helpers
    # ---------------------------------------------------------------

    async def generate_virtual_tryon(
        self,
        user_photo_url: str,
        item_photo_url: str,
        prompt: str,
        image_size: str = "auto",
        output_format: str = "png",
        progress_callback: Optional[callable] = None,
    ) -> str:
        logger.info(
            "Starting virtual try-on: user=%s, item=%s, prompt=%s...",
            user_photo_url,
            item_photo_url,
            prompt[:50],
        )
        input_payload = {
            # dok: image_urls (array of URLs)
            "image_urls": [user_photo_url, item_photo_url],
            "output_format": output_format.lower(),
            "image_size": image_size,
        }
        task_id, status_id = await self._submit_task(prompt=prompt, input_payload=input_payload)
        task_data = await self._poll_task_until_complete(status_id, progress_callback)
        return self._extract_image_from_result(task_data)

    async def generate_image_edit(
        self,
        base_image_url: str,
        prompt: str,
        image_size: str = "auto",
        output_format: str = "png",
        mask_url: Optional[str] = None,
        progress_callback: Optional[callable] = None,
        attachments_urls: Optional[List[str]] = None,
    ) -> str:
        logger.info("Starting image edit: base=%s, prompt=%s...", base_image_url, prompt[:50])

        if image_size not in self.SUPPORTED_ASPECT_RATIOS:
            logger.warning("Aspect ratio '%s' unsupported, using 'auto'", image_size)
            image_size = "auto"

        image_urls: List[str] = [base_image_url]
        if attachments_urls:
            image_urls.extend(attachments_urls)

        input_payload = {
            "image_urls": image_urls,
            "output_format": output_format.lower(),
            "image_size": image_size,
        }
        # mask_url не документирован в новой схеме, поэтому не отправляем

        task_id, status_id = await self._submit_task(prompt=prompt, input_payload=input_payload)
        task_data = await self._poll_task_until_complete(status_id, progress_callback)
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
    async def _submit_task(self, prompt: str, input_payload: dict) -> tuple[str, str]:
        payload = {
            "model": self.MODEL_NAME,
            "input": {"prompt": prompt, **input_payload},
        }

        response = await self.client.post(self.submit_url, json=payload)

        if response.status_code == 401:
            raise KieAIAuthError("Invalid API key")
        if response.status_code == 429:
            raise KieAIRateLimitError("Rate limit exceeded")
        if response.status_code >= 500:
            raise KieAIError(f"kie.ai server error: {response.status_code}")
        if response.status_code != 200:
            raise KieAIError(f"kie.ai API error: {response.status_code}, details: {response.text}")

        body = response.json()
        data = body.get("data", {}) or {}
        task_id = data.get("taskId") or body.get("taskId") or body.get("task_id")
        record_id = data.get("recordId") or data.get("record_id") or task_id
        if not task_id:
            raise KieAIError(f"Task ID not found in response: {body}")

        logger.info("Submitted task to kie.ai: task_id=%s, record_id=%s", task_id, record_id)
        return task_id, record_id

    async def _check_task_status(self, task_id: str) -> Dict:
        response = await self.client.get(self.status_url, params={"taskId": task_id})

        if response.status_code == 401:
            raise KieAIAuthError("Invalid API key")
        if response.status_code == 404:
            raise KieAIError(f"Task {task_id} not found")
        if response.status_code >= 500:
            raise KieAIError(f"Status check failed: {response.status_code}")

        return response.json()

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

            try:
                raw = await self._check_task_status(task_id)
                data = raw.get("data", raw) or {}
                if not data:
                    logger.info("Task %s: empty status payload (poll %s)", task_id, polls)
                    await asyncio.sleep(self.poll_interval)
                    continue

                # Согласно документации API kie.ai, используем только поле "state"
                state = data.get("state")

                logger.info(
                    "Task %s polling (poll %s/%s): state=%s, elapsed=%.1fs",
                    task_id,
                    polls,
                    self.max_polls,
                    state,
                    elapsed,
                )

                # Вызов progress callback с оценкой прогресса на основе state
                if progress_callback:
                    # Mapping state к прогрессу: waiting=10%, queuing=30%, generating=60%
                    progress_map = {
                        "waiting": 10,
                        "queuing": 30,
                        "generating": 60,
                        "success": 100,
                    }
                    pct = progress_map.get(state, 50)
                    try:
                        await progress_callback(state, pct)
                    except Exception as e:
                        logger.warning("Progress callback error: %s", e)

                # Проверка завершения: только state == "success"
                if state == "success":
                    logger.info(
                        "Task %s completed successfully after %s polls (%.1fs)",
                        task_id,
                        polls,
                        elapsed,
                    )
                    return data

                # Проверка ошибки: state == "fail"
                if state == "fail":
                    fail_code = data.get("failCode", "unknown")
                    fail_msg = (
                        data.get("failMsg")
                        or data.get("message")
                        or data.get("msg")
                        or "Task failed"
                    )
                    error_msg = f"kie.ai task failed (code: {fail_code}): {fail_msg}"
                    logger.error(error_msg)
                    raise KieAITaskFailedError(error_msg)

                # Состояния waiting/queuing/generating - продолжаем polling
                await asyncio.sleep(self.poll_interval)
                continue

            except (KieAITaskFailedError, KieAIAuthError):
                raise
            except Exception as e:
                logger.error("Error during polling task %s: %s", task_id, e)
                if polls >= self.max_polls:
                    raise
                await asyncio.sleep(self.poll_interval)

        elapsed = time.time() - start_time
        raise KieAITimeoutError(
            f"Polling timeout exceeded after {polls} polls ({elapsed:.1f}s)"
        )

    def _extract_image_from_result(self, task_data: Dict) -> str:
        # resultJson may be stringified JSON
        result_json = task_data.get("resultJson") or task_data.get("resultjson")
        result_urls = task_data.get("resultUrls") or task_data.get("resulturls")

        if isinstance(result_json, str):
            try:
                parsed = json.loads(result_json)
                result_urls = result_urls or parsed.get("resultUrls") or parsed.get("resulturls")
            except Exception as e:
                logger.warning("Failed to parse resultJson: %s", e)
        elif isinstance(result_json, dict):
            result_urls = result_urls or result_json.get("resultUrls") or result_json.get("resulturls")

        image_url = None
        if isinstance(result_urls, list) and result_urls:
            image_url = result_urls[0]

        if not image_url:
            raise KieAIError("No image URL in kie.ai result")

        logger.info("Extracted image URL: %s", image_url[:100])
        return image_url
