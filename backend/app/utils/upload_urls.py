"""
Utilities for validating and normalizing upload URLs.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from fastapi import HTTPException, status

from app.core.config import settings

_UPLOAD_PATH_RE = re.compile(r"^/uploads/[0-9a-fA-F-]{36}\.[A-Za-z0-9]+$")


def normalize_upload_url(raw_url: str) -> str:
    """
    Ensure that an URL points to a local upload and return normalized path.

    Accepts:
    - "/uploads/<uuid>.<ext>"
    - "uploads/<uuid>.<ext>"
    - "https://<frontend|backend-host>/uploads/<uuid>.<ext>"
    """
    if not raw_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректная ссылка загрузки",
        )

    path = raw_url
    if raw_url.startswith("http://") or raw_url.startswith("https://"):
        parsed = urlparse(raw_url)
        allowed_hosts: set[str] = set()
        for base in (settings.BACKEND_URL, settings.FRONTEND_URL):
            if not base:
                continue
            base_host = urlparse(base).hostname
            if base_host:
                allowed_hosts.add(base_host)
        if parsed.hostname not in allowed_hosts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Только локальные загрузки разрешены",
            )
        path = parsed.path
    else:
        if not path.startswith("/"):
            path = f"/{path}"
        path = urlparse(path).path

    if not _UPLOAD_PATH_RE.match(path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный формат ссылки на файл",
        )

    return path
