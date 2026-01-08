"""
Сервис для работы с файловым хранилищем.

Отвечает за сохранение, получение и удаление файлов.
Файлы сохраняются с UUID именами для безопасности.
"""

import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4

from fastapi import UploadFile, HTTPException, status

from app.core.config import settings
from app.services.file_validator import get_file_extension
from app.utils.image_utils import normalize_image_bytes, convert_image_bytes_to_webp


class FileStorageError(Exception):
    """Ошибка при работе с файловым хранилищем"""
    pass


def _ensure_upload_dir_exists() -> Path:
    """
    Убедиться, что директория для загрузок существует.

    Returns:
        Path: Путь к директории загрузок
    """
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def _get_file_path(file_id: UUID, extension: str) -> Path:
    """
    Получить полный путь к файлу.

    Args:
        file_id: UUID файла
        extension: Расширение файла

    Returns:
        Path: Полный путь к файлу
    """
    upload_dir = _ensure_upload_dir_exists()
    filename = f"{file_id}.{extension}"
    return upload_dir / filename


async def save_upload_file(
    file: UploadFile,
    user_id: int,
    convert_to_webp: bool = False,
) -> tuple[UUID, str, int]:
    """
    Сохранить загруженный файл.

    JPEG/PNG файлы сохраняются как есть без конвертации (если не включён convert_to_webp).
    Нестандартные форматы (HEIC/HEIF) конвертируются в PNG в Celery task.

    Args:
        file: Загруженный файл
        user_id: ID пользователя (для логирования)

    Returns:
        tuple[UUID, str, int]: (file_id, file_url, file_size)

    Raises:
        FileStorageError: Если не удалось сохранить файл
    """
    try:
        # Генерация UUID для файла
        file_id = uuid4()

        # Получение расширения файла
        extension = get_file_extension(file.content_type)
        if not extension:
            raise FileStorageError(f"Unknown content type: {file.content_type}")

        # Чтение содержимого файла
        content = await file.read()

        # Нормализация ориентации/EXIF для изображений или конвертация в WebP
        try:
            if convert_to_webp:
                content, extension = convert_image_bytes_to_webp(content, extension)
            else:
                content, extension = normalize_image_bytes(content, extension)
        except Exception:
            # Не падаем, если обработка не удалась
            pass

        # Получение пути для сохранения (с учётом возможного обновления расширения)
        file_path = _get_file_path(file_id, extension)

        # Сохранение файла
        with open(file_path, "wb") as f:
            f.write(content)

        # Получение размера файла
        file_size = file_path.stat().st_size

        # Формирование URL для доступа к файлу
        file_url = f"/uploads/{file_id}.{extension}"

        # Возврат указателя файла в начало (на случай если понадобится еще раз прочитать)
        await file.seek(0)

        return file_id, file_url, file_size

    except Exception as e:
        raise FileStorageError(f"Failed to save file: {str(e)}")


async def save_raw_upload_file(
    file: UploadFile,
    user_id: int
) -> tuple[UUID, str, int]:
    """
    Сохранить загруженный файл без обработки (например, видео).

    Args:
        file: Загруженный файл
        user_id: ID пользователя (для логирования)

    Returns:
        tuple[UUID, str, int]: (file_id, file_url, file_size)
    """
    try:
        file_id = uuid4()

        extension = get_file_extension(file.content_type)
        if not extension:
            raise FileStorageError(f"Unknown content type: {file.content_type}")

        content = await file.read()

        file_path = _get_file_path(file_id, extension)

        with open(file_path, "wb") as f:
            f.write(content)

        file_size = file_path.stat().st_size
        file_url = f"/uploads/{file_id}.{extension}"

        await file.seek(0)

        return file_id, file_url, file_size

    except Exception as e:
        raise FileStorageError(f"Failed to save file: {str(e)}")


async def save_upload_file_by_content(
    content: bytes,
    user_id: int,
    content_type: Optional[str] = None,
    filename: Optional[str] = None
) -> tuple[UUID, str, int]:
    """
    Сохранить файл из байтов (например, для результата генерации).

    JPEG/PNG файлы сохраняются как есть без конвертации.

    Args:
        content: Содержимое файла
        user_id: ID пользователя
        content_type: MIME-тип (опционально, определится из filename)
        filename: Имя файла (для определения расширения)

    Returns:
        tuple[UUID, str, int]: (file_id, file_url, file_size)

    Raises:
        FileStorageError: Если не удалось сохранить файл
    """
    try:
        # Генерация UUID для файла
        file_id = uuid4()

        # Определение расширения файла
        extension = None

        # Сначала пытаемся получить расширение из filename
        if filename:
            import os
            ext = os.path.splitext(filename)[1].lstrip('.')
            if ext:
                extension = ext.lower()

        # Если не удалось из filename, пытаемся из content_type
        if not extension and content_type:
            extension = get_file_extension(content_type)

        # Если и так не удалось, используем дефолтное значение
        if not extension:
            # Попытка определить тип по первым байтам (magic bytes)
            if content.startswith(b'\x89PNG'):
                extension = 'png'
            elif content.startswith(b'\xFF\xD8\xFF'):
                extension = 'jpg'
            else:
                extension = 'png'  # Дефолт для изображений

        # Получение пути для сохранения
        file_path = _get_file_path(file_id, extension)

        # Сохранение файла
        with open(file_path, "wb") as f:
            f.write(content)

        # Получение размера файла
        file_size = file_path.stat().st_size

        # Формирование URL для доступа к файлу
        file_url = f"/uploads/{file_id}.{extension}"

        return file_id, file_url, file_size

    except Exception as e:
        raise FileStorageError(f"Failed to save file: {str(e)}")


def get_file_by_id(file_id: UUID) -> Optional[Path]:
    """
    Получить путь к файлу по его UUID.

    Args:
        file_id: UUID файла

    Returns:
        Optional[Path]: Путь к файлу или None если не найден
    """
    upload_dir = _ensure_upload_dir_exists()

    # Поиск файла с любым расширением (приоритет JPEG/PNG)
    for ext in ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'mpo', 'mp4', 'webm', 'mov']:
        file_path = upload_dir / f"{file_id}.{ext}"
        if file_path.exists():
            return file_path

    return None


def delete_file(file_id: UUID) -> bool:
    """
    Удалить файл по его UUID.

    Args:
        file_id: UUID файла

    Returns:
        bool: True если файл был удален, False если не найден
    """
    file_path = get_file_by_id(file_id)

    if not file_path:
        return False

    try:
        file_path.unlink()
        return True
    except Exception:
        return False


def delete_old_files(hours: int = 24, protected_file_ids: Optional[set[str]] = None) -> int:
    """
    Удалить файлы старше указанного количества часов.

    Это функция должна вызываться периодически (например, через Celery Beat).

    Args:
        hours: Количество часов, после которых файл считается старым

    Returns:
        int: Количество удаленных файлов
    """
    upload_dir = _ensure_upload_dir_exists()
    cutoff_time = datetime.now() - timedelta(hours=hours)
    protected_ids = protected_file_ids or set()
    deleted_count = 0

    for file_path in upload_dir.glob("*"):
        if not file_path.is_file():
            continue

        if file_path.stem in protected_ids:
            continue

        # Проверка времени модификации файла
        file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)

        if file_mtime < cutoff_time:
            try:
                file_path.unlink()
                deleted_count += 1
            except Exception:
                # Логируем ошибку, но продолжаем удаление остальных файлов
                pass

    return deleted_count


def get_upload_dir_size() -> int:
    """
    Получить общий размер директории загрузок в байтах.

    Returns:
        int: Размер в байтах
    """
    upload_dir = _ensure_upload_dir_exists()
    total_size = 0

    for file_path in upload_dir.glob("*"):
        if file_path.is_file():
            total_size += file_path.stat().st_size

    return total_size


def get_upload_dir_file_count() -> int:
    """
    Получить количество файлов в директории загрузок.

    Returns:
        int: Количество файлов
    """
    upload_dir = _ensure_upload_dir_exists()
    return len(list(upload_dir.glob("*")))


def cleanup_upload_dir() -> tuple[int, int]:
    """
    Очистить всю директорию загрузок (использовать с осторожностью!).

    Returns:
        tuple[int, int]: (количество удаленных файлов, освобожденное место в байтах)
    """
    upload_dir = _ensure_upload_dir_exists()
    deleted_count = 0
    freed_space = 0

    for file_path in upload_dir.glob("*"):
        if file_path.is_file():
            try:
                file_size = file_path.stat().st_size
                file_path.unlink()
                deleted_count += 1
                freed_space += file_size
            except Exception:
                pass

    return deleted_count, freed_space
