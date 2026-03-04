"""
Watermark Service
Сервис для наложения водяных знаков на изображения для Freemium пользователей
"""

import logging
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)


class WatermarkService:
    """Сервис для работы с водяными знаками"""

    def __init__(
        self,
        text: str = "ИИ Генератор - Demo",
        position: str = "bottom-right",
        opacity: int = 128,  # 0-255 (128 = 50% прозрачности)
        font_size: int = 24,
        padding: int = 10,
        color: tuple[int, int, int] = (255, 255, 255),  # белый
    ):
        """
        Инициализация сервиса водяных знаков

        Args:
            text: Текст водяного знака
            position: Позиция (bottom-right, bottom-left, top-right, top-left, center)
            opacity: Прозрачность (0-255)
            font_size: Размер шрифта
            padding: Отступ от края
            color: Цвет текста (R, G, B)
        """
        self.text = text
        self.position = position
        self.opacity = opacity
        self.font_size = font_size
        self.padding = padding
        self.color = color

    def _get_font(self) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
        """
        Получить шрифт для водяного знака

        Returns:
            Font object
        """
        # Пытаемся использовать системные шрифты
        font_paths = [
            "/System/Library/Fonts/Helvetica.ttc",  # macOS
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
            "C:\\Windows\\Fonts\\arial.ttf",  # Windows
        ]

        for font_path in font_paths:
            if Path(font_path).exists():
                try:
                    return ImageFont.truetype(font_path, self.font_size)
                except Exception as e:
                    logger.warning(f"Failed to load font from {font_path}: {e}")

        # Fallback на default font
        logger.warning("Using default font for watermark")
        return ImageFont.load_default()

    def _calculate_position(
        self, image_width: int, image_height: int, text_width: int, text_height: int
    ) -> tuple[int, int]:
        """
        Рассчитать координаты водяного знака

        Args:
            image_width: Ширина изображения
            image_height: Высота изображения
            text_width: Ширина текста
            text_height: Высота текста

        Returns:
            Tuple (x, y) координат
        """
        if self.position == "bottom-right":
            x = image_width - text_width - self.padding
            y = image_height - text_height - self.padding
        elif self.position == "bottom-left":
            x = self.padding
            y = image_height - text_height - self.padding
        elif self.position == "top-right":
            x = image_width - text_width - self.padding
            y = self.padding
        elif self.position == "top-left":
            x = self.padding
            y = self.padding
        elif self.position == "center":
            x = (image_width - text_width) // 2
            y = (image_height - text_height) // 2
        else:
            # Default: bottom-right
            x = image_width - text_width - self.padding
            y = image_height - text_height - self.padding

        return (x, y)

    def add_watermark(
        self, image_path: str, output_path: Optional[str] = None
    ) -> str:
        """
        Добавить водяной знак на изображение

        Args:
            image_path: Путь к исходному изображению
            output_path: Путь для сохранения (если None, перезаписывает исходный)

        Returns:
            Путь к изображению с водяным знаком
        """
        try:
            # Открываем изображение
            image = Image.open(image_path)

            # Конвертируем в RGBA если нужно (для прозрачности)
            if image.mode != "RGBA":
                image = image.convert("RGBA")

            # Создаём слой для водяного знака
            watermark_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(watermark_layer)

            # Получаем шрифт
            font = self._get_font()

            # Получаем размеры текста
            # Для ImageFont.load_default() используем getbbox
            try:
                bbox = draw.textbbox((0, 0), self.text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
            except AttributeError:
                # Для старых версий PIL
                text_width, text_height = draw.textsize(self.text, font=font)

            # Рассчитываем позицию
            x, y = self._calculate_position(
                image.width, image.height, text_width, text_height
            )

            # Добавляем полупрозрачный фон под текст для лучшей читаемости
            background_padding = 5
            background_bbox = (
                x - background_padding,
                y - background_padding,
                x + text_width + background_padding,
                y + text_height + background_padding,
            )
            draw.rectangle(
                background_bbox, fill=(0, 0, 0, int(self.opacity * 0.7))
            )

            # Рисуем текст водяного знака
            text_color = (*self.color, self.opacity)
            draw.text((x, y), self.text, font=font, fill=text_color)

            # Накладываем водяной знак на изображение
            watermarked = Image.alpha_composite(image, watermark_layer)

            # Конвертируем обратно в RGB если нужно (для JPEG)
            if watermarked.mode == "RGBA":
                rgb_image = Image.new("RGB", watermarked.size, (255, 255, 255))
                rgb_image.paste(watermarked, mask=watermarked.split()[3])  # alpha channel
                watermarked = rgb_image

            # Сохраняем
            save_path = output_path or image_path
            watermarked.save(save_path, quality=95, optimize=True)

            logger.info(f"Watermark added to {save_path}")
            return save_path

        except Exception as e:
            logger.error(f"Failed to add watermark to {image_path}: {e}")
            raise

    def add_watermark_to_bytes(self, image_bytes: bytes) -> bytes:
        """
        Добавить водяной знак к изображению в виде bytes

        Args:
            image_bytes: Изображение в виде bytes

        Returns:
            Изображение с водяным знаком в виде bytes
        """
        from io import BytesIO

        try:
            # Открываем изображение из bytes
            image = Image.open(BytesIO(image_bytes))

            # Конвертируем в RGBA если нужно
            if image.mode != "RGBA":
                image = image.convert("RGBA")

            # Создаём слой для водяного знака
            watermark_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(watermark_layer)

            # Получаем шрифт
            font = self._get_font()

            # Получаем размеры текста
            try:
                bbox = draw.textbbox((0, 0), self.text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
            except AttributeError:
                text_width, text_height = draw.textsize(self.text, font=font)

            # Рассчитываем позицию
            x, y = self._calculate_position(
                image.width, image.height, text_width, text_height
            )

            # Добавляем полупрозрачный фон
            background_padding = 5
            background_bbox = (
                x - background_padding,
                y - background_padding,
                x + text_width + background_padding,
                y + text_height + background_padding,
            )
            draw.rectangle(
                background_bbox, fill=(0, 0, 0, int(self.opacity * 0.7))
            )

            # Рисуем текст
            text_color = (*self.color, self.opacity)
            draw.text((x, y), self.text, font=font, fill=text_color)

            # Накладываем водяной знак
            watermarked = Image.alpha_composite(image, watermark_layer)

            # Конвертируем в RGB для JPEG
            if watermarked.mode == "RGBA":
                rgb_image = Image.new("RGB", watermarked.size, (255, 255, 255))
                rgb_image.paste(watermarked, mask=watermarked.split()[3])
                watermarked = rgb_image

            # Сохраняем в bytes
            output = BytesIO()
            watermarked.save(output, format="JPEG", quality=95, optimize=True)
            output.seek(0)

            return output.getvalue()

        except Exception as e:
            logger.error(f"Failed to add watermark to bytes: {e}")
            raise


# Singleton instance для переиспользования
_watermark_service: Optional[WatermarkService] = None


def get_watermark_service() -> WatermarkService:
    """
    Получить singleton instance WatermarkService

    Returns:
        WatermarkService instance
    """
    global _watermark_service
    if _watermark_service is None:
        _watermark_service = WatermarkService(
            text="ИИ Генератор - Demo",
            position="bottom-right",
            opacity=128,
            font_size=24,
            padding=10,
            color=(255, 255, 255),
        )
    return _watermark_service


def add_watermark(
    image_path: str, output_path: Optional[str] = None, text: Optional[str] = None
) -> str:
    """
    Удобная функция для добавления водяного знака

    Args:
        image_path: Путь к изображению
        output_path: Путь для сохранения
        text: Текст водяного знака (опционально)

    Returns:
        Путь к изображению с водяным знаком
    """
    service = get_watermark_service()
    if text:
        service.text = text

    return service.add_watermark(image_path, output_path)
