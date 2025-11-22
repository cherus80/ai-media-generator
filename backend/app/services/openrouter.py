"""
OpenRouter API Client для Claude Haiku.

Клиент для работы с OpenRouter API для генерации промптов
через Claude 3 Haiku для редактирования изображений.

Документация: https://openrouter.ai/docs
"""

import logging
from typing import List, Dict, Any, Optional

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenRouterError(Exception):
    """Базовая ошибка для OpenRouter API"""
    pass


class OpenRouterAuthError(OpenRouterError):
    """Ошибка авторизации"""
    pass


class OpenRouterRateLimitError(OpenRouterError):
    """Ошибка превышения rate limit"""
    pass


class OpenRouterClient:
    """
    Async клиент для OpenRouter API (Claude 3 Haiku).

    Используется для генерации промптов на основе запросов пользователя
    для редактирования изображений через AI-ассистента.

    Особенности:
    - Отправка последних 10 сообщений для контекста
    - Системный промпт на английском для генерации 3 вариантов
    - Retry логика (3 попытки, exponential backoff)
    - Подсчёт токенов (input/output)
    """

    BASE_URL = "https://openrouter.ai/api/v1"
    CHAT_ENDPOINT = "/chat/completions"

    # Модель Nano Banana для генерации изображений
    NANO_BANANA_MODEL = "google/gemini-2.5-flash-image-preview"

    # Системный промпт для генерации вариантов промптов
    SYSTEM_PROMPT = """You are an expert image editing prompt generator.

Your task is to help users edit images by generating 3 different creative prompt variations based on their request.

Rules:
1. Generate exactly 3 prompt variations (short, medium, detailed)
2. Each prompt must be in English
3. Prompts should be clear, specific, and actionable for image AI models
4. Consider the context from previous messages in the conversation
5. Focus on editing/modifying existing images, not creating new ones
6. Return ONLY a JSON object with this structure:
{
  "prompts": [
    "Short prompt variation (1-2 sentences)",
    "Medium prompt variation (2-3 sentences with more details)",
    "Detailed prompt variation (3-4 sentences with specific instructions)"
  ]
}

Do not include any additional text, explanations, or markdown formatting. Return only the JSON object."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 60,
    ):
        """
        Инициализация клиента.

        Args:
            api_key: API ключ от OpenRouter (если не указан, берётся из settings)
            base_url: Базовый URL API (по умолчанию https://openrouter.ai/api/v1)
            model: Модель для использования (по умолчанию claude-3-haiku-20240307)
            timeout: Таймаут запросов в секундах
        """
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.base_url = base_url or settings.OPENROUTER_BASE_URL
        self.model = model or settings.OPENROUTER_MODEL
        self.timeout = timeout

        if not self.api_key:
            raise OpenRouterError("OPENROUTER_API_KEY not configured")

        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.PROJECT_NAME,  # Для аналитики OpenRouter
                "X-Title": settings.PROJECT_NAME,
            },
        )

        logger.info(
            f"OpenRouter client initialized (model: {self.model}, "
            f"base_url: {self.base_url})"
        )

    async def close(self):
        """Закрытие HTTP клиента"""
        await self.client.aclose()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True,
    )
    async def generate_prompts(
        self,
        user_message: str,
        chat_history: List[Dict[str, str]],
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> List[str]:
        """
        Генерация 3 вариантов промптов для редактирования изображения.

        Args:
            user_message: Текущее сообщение пользователя
            chat_history: История последних сообщений (до 10)
                Формат: [{"role": "user|assistant", "content": "..."}, ...]
            max_tokens: Максимальное количество токенов для ответа
            temperature: Температура генерации (0.0-1.0)

        Returns:
            Список из 3 промптов (короткий, средний, детальный)

        Raises:
            OpenRouterAuthError: Ошибка авторизации
            OpenRouterRateLimitError: Превышен rate limit
            OpenRouterError: Другие ошибки API
        """
        try:
            # Формируем сообщения для API
            messages = [
                {"role": "system", "content": self.SYSTEM_PROMPT}
            ]

            # Добавляем последние 10 сообщений из истории для контекста
            messages.extend(chat_history[-10:])

            # Добавляем текущее сообщение пользователя
            messages.append({
                "role": "user",
                "content": user_message,
            })

            # Формируем запрос
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "response_format": {"type": "json_object"},  # Требуем JSON ответ
            }

            logger.info(
                f"Sending request to OpenRouter (model: {self.model}, "
                f"messages: {len(messages)}, user_message_length: {len(user_message)})"
            )

            # Отправляем запрос
            response = await self.client.post(
                f"{self.base_url}{self.CHAT_ENDPOINT}",
                json=payload,
            )

            # Обработка ошибок
            if response.status_code == 401:
                raise OpenRouterAuthError("Invalid API key")
            elif response.status_code == 429:
                raise OpenRouterRateLimitError("Rate limit exceeded")
            elif response.status_code >= 500:
                raise OpenRouterError(
                    f"OpenRouter server error: {response.status_code}"
                )
            elif response.status_code != 200:
                error_data = response.json() if response.content else {}
                raise OpenRouterError(
                    f"OpenRouter API error: {response.status_code}, "
                    f"details: {error_data}"
                )

            # Парсим ответ
            data = response.json()

            # Извлекаем токены для логирования
            usage = data.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            total_tokens = usage.get("total_tokens", 0)

            logger.info(
                f"OpenRouter response received (tokens: {total_tokens}, "
                f"prompt: {prompt_tokens}, completion: {completion_tokens})"
            )

            # Извлекаем содержимое ответа
            content = data["choices"][0]["message"]["content"]

            # Парсим JSON с промптами
            import json
            try:
                prompts_data = json.loads(content)
                prompts = prompts_data.get("prompts", [])
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {content}")
                raise OpenRouterError(f"Invalid JSON response from AI: {e}")

            # Валидация: должно быть ровно 3 промпта
            if not prompts or len(prompts) != 3:
                logger.warning(
                    f"Expected 3 prompts, got {len(prompts)}. "
                    f"Generating fallback prompts."
                )
                # Fallback: если AI вернул не 3 промпта, генерируем базовые
                prompts = [
                    user_message,  # Короткий = оригинальный запрос
                    f"{user_message}. Make it professional and high quality.",  # Средний
                    f"{user_message}. Create a professional, high-quality edit with attention to detail, proper lighting, and realistic results.",  # Детальный
                ][:3]

            logger.info(f"Generated {len(prompts)} prompts successfully")

            return prompts

        except (OpenRouterAuthError, OpenRouterRateLimitError, OpenRouterError):
            # Пробрасываем наши кастомные ошибки
            raise
        except httpx.TimeoutException as e:
            logger.error(f"OpenRouter request timeout: {e}")
            raise OpenRouterError(f"Request timeout: {e}")
        except httpx.NetworkError as e:
            logger.error(f"OpenRouter network error: {e}")
            raise OpenRouterError(f"Network error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in OpenRouter client: {e}")
            raise OpenRouterError(f"Unexpected error: {e}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True,
    )
    async def generate_virtual_tryon(
        self,
        user_photo_data: str,
        item_photo_data: str,
        prompt: str,
        aspect_ratio: str = "1:1",
    ) -> str:
        """
        Генерация виртуальной примерки через Gemini 2.5 Flash Image (Nano Banana).

        Args:
            user_photo_data: Base64-encoded данные фото пользователя (data:image/jpeg;base64,...)
            item_photo_data: Base64-encoded данные фото одежды/аксессуара
            prompt: Промпт для виртуальной примерки
            aspect_ratio: Соотношение сторон (1:1, 16:9, 9:16, 4:3, 3:4)

        Returns:
            Base64-encoded URL сгенерированного изображения (data:image/png;base64,...)

        Raises:
            OpenRouterAuthError: Ошибка авторизации
            OpenRouterRateLimitError: Превышен rate limit
            OpenRouterError: Другие ошибки API
        """
        try:
            # Формируем сообщение с двумя изображениями
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": user_photo_data,
                            },
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": item_photo_data,
                            },
                        },
                    ],
                }
            ]

            # Формируем запрос с modalities для генерации изображения
            payload = {
                "model": self.NANO_BANANA_MODEL,
                "messages": messages,
                "modalities": ["image", "text"],  # Важно для генерации изображений
                "image_config": {
                    "aspect_ratio": aspect_ratio,
                },
            }

            logger.info(
                f"Sending virtual try-on request to OpenRouter (model: {self.NANO_BANANA_MODEL}, "
                f"aspect_ratio: {aspect_ratio}, prompt_length: {len(prompt)})"
            )

            # Отправляем запрос
            response = await self.client.post(
                f"{self.base_url}{self.CHAT_ENDPOINT}",
                json=payload,
            )

            # Обработка ошибок
            if response.status_code == 401:
                raise OpenRouterAuthError("Invalid API key")
            elif response.status_code == 429:
                raise OpenRouterRateLimitError("Rate limit exceeded")
            elif response.status_code >= 500:
                raise OpenRouterError(
                    f"OpenRouter server error: {response.status_code}"
                )
            elif response.status_code != 200:
                error_data = response.json() if response.content else {}
                raise OpenRouterError(
                    f"OpenRouter API error: {response.status_code}, "
                    f"details: {error_data}"
                )

            # Парсим ответ
            data = response.json()

            # Извлекаем токены для логирования
            usage = data.get("usage", {})
            logger.info(
                f"OpenRouter virtual try-on response received (usage: {usage})"
            )

            # Извлекаем сгенерированное изображение
            choice = data.get("choices", [{}])[0]
            message = choice.get("message", {}) or {}

            # OpenRouter может возвращать изображения либо в message["images"],
            # либо как элементы в message["content"] с type=image_url. Собираем оба варианта.
            images = message.get("images") or []
            if not images:
                content = message.get("content") or []
                images = [
                    part for part in content
                    if isinstance(part, dict) and part.get("type") == "image_url"
                ]

            if not images:
                raise OpenRouterError(
                    f"No image returned from Nano Banana. Message keys: {list(message.keys())}"
                )

            # Возвращаем первое изображение (data:image/png;base64,...)
            first_image = images[0]
            image_url = None

            if isinstance(first_image, dict):
                # Стандартная схема: {"type": "image_url", "image_url": {"url": "..."}}
                image_data = first_image.get("image_url")
                if isinstance(image_data, dict):
                    image_url = (
                        image_data.get("url")
                        or image_data.get("data")
                        or image_data.get("image")
                    )

                # Фолбэк на старую схему: {"url": "..."} или {"data": "..."}
                if not image_url:
                    image_url = (
                        first_image.get("url")
                        or first_image.get("data")
                        or first_image.get("image")
                    )

                logger.info(
                    f"Dict image, extracted URL length: {len(image_url) if image_url else 0}"
                )
            else:
                image_url = first_image

            if not image_url:
                raise OpenRouterError(f"Empty image URL returned from Nano Banana. First image type: {type(first_image)}, keys: {first_image.keys() if isinstance(first_image, dict) else 'N/A'}")

            logger.info(f"Virtual try-on image generated successfully, URL length: {len(image_url)}")

            return image_url

        except (OpenRouterAuthError, OpenRouterRateLimitError, OpenRouterError):
            # Пробрасываем наши кастомные ошибки
            raise
        except httpx.TimeoutException as e:
            logger.error(f"OpenRouter request timeout: {e}")
            raise OpenRouterError(f"Request timeout: {e}")
        except httpx.NetworkError as e:
            logger.error(f"OpenRouter network error: {e}")
            raise OpenRouterError(f"Network error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in OpenRouter virtual try-on: {e}")
            raise OpenRouterError(f"Unexpected error: {e}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True,
    )
    async def generate_image_edit(
        self,
        base_image_data: str,
        prompt: str,
        aspect_ratio: str = "1:1",
    ) -> str:
        """
        Редактирование одного изображения по промпту через Gemini image model.

        Args:
            base_image_data: Base64 data URL of the source image.
            prompt: Text prompt describing the edit.
            aspect_ratio: Desired aspect ratio.

        Returns:
            Base64 data URL of the generated image or a direct URL.
        """
        try:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": base_image_data}},
                    ],
                }
            ]

            payload = {
                "model": self.NANO_BANANA_MODEL,
                "messages": messages,
                "modalities": ["image", "text"],
                "image_config": {"aspect_ratio": aspect_ratio},
            }

            response = await self.client.post(
                f"{self.base_url}{self.CHAT_ENDPOINT}",
                json=payload,
            )

            if response.status_code == 401:
                raise OpenRouterAuthError("Invalid API key")
            elif response.status_code == 429:
                raise OpenRouterRateLimitError("Rate limit exceeded")
            elif response.status_code >= 500:
                raise OpenRouterError(f"OpenRouter server error: {response.status_code}")
            elif response.status_code != 200:
                error_data = response.json() if response.content else {}
                raise OpenRouterError(
                    f"OpenRouter API error: {response.status_code}, "
                    f"details: {error_data}"
                )

            data = response.json()
            usage = data.get("usage", {})
            logger.info(f"OpenRouter image edit response received (usage: {usage})")

            choice = data.get("choices", [{}])[0]
            message = choice.get("message", {}) or {}

            images = message.get("images") or []
            if not images:
                content = message.get("content") or []
                images = [
                    part for part in content
                    if isinstance(part, dict) and part.get("type") == "image_url"
                ]

            if not images:
                raise OpenRouterError(
                    f"No image returned from OpenRouter. Message keys: {list(message.keys())}"
                )

            first_image = images[0]
            image_url = None

            if isinstance(first_image, dict):
                image_data = first_image.get("image_url")
                if isinstance(image_data, dict):
                    image_url = (
                        image_data.get("url")
                        or image_data.get("data")
                        or image_data.get("image")
                    )

                if not image_url:
                    image_url = (
                        first_image.get("url")
                        or first_image.get("data")
                        or first_image.get("image")
                    )
            else:
                image_url = first_image

            if not image_url:
                raise OpenRouterError(
                    f"Empty image URL returned from OpenRouter. First image type: {type(first_image)}, keys: {first_image.keys() if isinstance(first_image, dict) else 'N/A'}"
                )

            return image_url

        except (OpenRouterAuthError, OpenRouterRateLimitError, OpenRouterError):
            raise
        except httpx.TimeoutException as e:
            logger.error(f"OpenRouter request timeout: {e}")
            raise OpenRouterError(f"Request timeout: {e}")
        except httpx.NetworkError as e:
            logger.error(f"OpenRouter network error: {e}")
            raise OpenRouterError(f"Network error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in OpenRouter image edit: {e}")
            raise OpenRouterError(f"Unexpected error: {e}")

    async def __aenter__(self):
        """Context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        await self.close()


# Singleton instance для переиспользования
_openrouter_client: Optional[OpenRouterClient] = None


def get_openrouter_client() -> OpenRouterClient:
    """
    Получение singleton instance OpenRouter клиента.

    Returns:
        OpenRouterClient instance
    """
    global _openrouter_client

    if _openrouter_client is None:
        _openrouter_client = OpenRouterClient()

    return _openrouter_client


async def close_openrouter_client():
    """Закрытие singleton instance OpenRouter клиента"""
    global _openrouter_client

    if _openrouter_client is not None:
        await _openrouter_client.close()
        _openrouter_client = None
