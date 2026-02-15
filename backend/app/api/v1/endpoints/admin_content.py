"""
Админские endpoints для инструкций и примеров генераций.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status, File, UploadFile
import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from app.api.dependencies import AdminUser, AdminOrService, DBSession
from app.models import Instruction, GenerationExample, GenerationExampleTag, GenerationExampleSlug
from app.schemas.content import (
    InstructionAdminListResponse,
    InstructionAdminItem,
    InstructionCreateRequest,
    InstructionUpdateRequest,
    InstructionType,
    InstructionUploadResponse,
    GenerationExampleAdminListResponse,
    GenerationExampleAdminItem,
    GenerationExampleCreateRequest,
    GenerationExampleUpdateRequest,
    GenerationExampleSeoSuggestionRequest,
    GenerationExampleSeoSuggestionResponse,
)
from app.services.file_storage import save_raw_upload_file, save_upload_file
from app.services.file_validator import validate_video_file, validate_image_file
from app.services.example_seo import generate_example_seo_suggestions
from app.utils.slug import generate_unique_slug

router = APIRouter()


def _normalize_tags(tags: list[str] | None) -> list[str]:
    if not tags:
        return []
    normalized: list[str] = []
    seen = set()
    for tag in tags:
        cleaned = tag.strip().lower()
        if not cleaned or cleaned in seen:
            continue
        normalized.append(cleaned)
        seen.add(cleaned)
    return normalized


def _clean_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


@router.get("/instructions", response_model=InstructionAdminListResponse)
async def list_instructions(
    admin: AdminUser,
    db: DBSession,
    instruction_type: Optional[InstructionType] = Query(default=None, alias="type"),
) -> InstructionAdminListResponse:
    stmt = sa.select(Instruction)
    if instruction_type:
        stmt = stmt.where(Instruction.type == instruction_type.value)
    stmt = stmt.order_by(Instruction.sort_order.asc(), Instruction.created_at.desc())
    result = await db.execute(stmt)
    items = result.scalars().all()

    return InstructionAdminListResponse(
        items=[
            InstructionAdminItem(
                id=item.id,
                type=InstructionType(item.type.value),
                title=item.title,
                description=item.description,
                content=item.content,
                sort_order=item.sort_order,
                is_published=item.is_published,
                created_at=item.created_at,
                updated_at=item.updated_at,
                created_by_user_id=item.created_by_user_id,
                updated_by_user_id=item.updated_by_user_id,
            )
            for item in items
        ],
        total=len(items),
    )


@router.post(
    "/instructions/upload",
    response_model=InstructionUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_instruction_video(
    admin: AdminUser,
    file: UploadFile = File(..., description="Видео (MP4/WebM/MOV)"),
) -> InstructionUploadResponse:
    await validate_video_file(file)

    try:
        file_id, file_url, file_size = await save_raw_upload_file(
            file,
            user_id=admin.id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Не удалось сохранить файл на сервере. "
                "Попробуйте повторить загрузку позже."
            ),
        )

    return InstructionUploadResponse(
        file_id=str(file_id),
        file_url=file_url,
        file_size=file_size,
    )


@router.post(
    "/instructions/upload-image",
    response_model=InstructionUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_instruction_image(
    admin: AdminUser,
    file: UploadFile = File(..., description="Изображение (JPEG/PNG/WebP/HEIC)"),
) -> InstructionUploadResponse:
    await validate_image_file(file)

    try:
        file_id, file_url, file_size = await save_upload_file(
            file,
            user_id=admin.id,
            convert_to_webp=True,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Не удалось сохранить файл на сервере. "
                "Попробуйте повторить загрузку позже."
            ),
        )

    return InstructionUploadResponse(
        file_id=str(file_id),
        file_url=file_url,
        file_size=file_size,
    )


@router.post(
    "/examples/upload-image",
    response_model=InstructionUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_example_image(
    admin: AdminOrService,
    file: UploadFile = File(..., description="Изображение (JPEG/PNG/WebP/HEIC)"),
) -> InstructionUploadResponse:
    await validate_image_file(file)

    try:
        file_id, file_url, file_size = await save_upload_file(
            file,
            user_id=admin.id if admin else 0,
            convert_to_webp=True,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Не удалось сохранить файл на сервере. "
                "Попробуйте повторить загрузку позже."
            ),
        )

    return InstructionUploadResponse(
        file_id=str(file_id),
        file_url=file_url,
        file_size=file_size,
    )


@router.post("/instructions", response_model=InstructionAdminItem, status_code=status.HTTP_201_CREATED)
async def create_instruction(
    payload: InstructionCreateRequest,
    admin: AdminUser,
    db: DBSession,
) -> InstructionAdminItem:
    item = Instruction(
        type=payload.type.value,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        content=payload.content.strip(),
        sort_order=payload.sort_order,
        is_published=payload.is_published,
        created_by_user_id=admin.id,
        updated_by_user_id=admin.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return InstructionAdminItem(
        id=item.id,
        type=InstructionType(item.type.value),
        title=item.title,
        description=item.description,
        content=item.content,
        sort_order=item.sort_order,
        is_published=item.is_published,
        created_at=item.created_at,
        updated_at=item.updated_at,
        created_by_user_id=item.created_by_user_id,
        updated_by_user_id=item.updated_by_user_id,
    )


@router.put("/instructions/{instruction_id}", response_model=InstructionAdminItem)
async def update_instruction(
    instruction_id: int,
    payload: InstructionUpdateRequest,
    admin: AdminUser,
    db: DBSession,
) -> InstructionAdminItem:
    stmt = sa.select(Instruction).where(Instruction.id == instruction_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Инструкция не найдена")

    if payload.title is not None:
        item.title = payload.title.strip()
    if payload.description is not None:
        item.description = payload.description.strip() if payload.description else None
    if payload.content is not None:
        item.content = payload.content.strip()
    if payload.sort_order is not None:
        item.sort_order = payload.sort_order
    if payload.is_published is not None:
        item.is_published = payload.is_published
    item.updated_by_user_id = admin.id

    await db.commit()
    await db.refresh(item)
    return InstructionAdminItem(
        id=item.id,
        type=InstructionType(item.type.value),
        title=item.title,
        description=item.description,
        content=item.content,
        sort_order=item.sort_order,
        is_published=item.is_published,
        created_at=item.created_at,
        updated_at=item.updated_at,
        created_by_user_id=item.created_by_user_id,
        updated_by_user_id=item.updated_by_user_id,
    )


@router.delete("/instructions/{instruction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instruction(
    instruction_id: int,
    admin: AdminUser,
    db: DBSession,
) -> None:
    result = await db.execute(sa.select(Instruction).where(Instruction.id == instruction_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Инструкция не найдена")
    await db.delete(item)
    await db.commit()
    return None


@router.get("/examples", response_model=GenerationExampleAdminListResponse)
async def list_examples(
    admin: AdminOrService,
    db: DBSession,
) -> GenerationExampleAdminListResponse:
    stmt = (
        sa.select(GenerationExample)
        .options(selectinload(GenerationExample.tags))
        .order_by(
            GenerationExample.uses_count.desc(),
            GenerationExample.created_at.desc(),
        )
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    return GenerationExampleAdminListResponse(
        items=[
            GenerationExampleAdminItem(
                id=item.id,
                slug=item.slug,
                title=item.title,
                description=item.description,
                prompt=item.prompt,
                image_url=item.image_url,
                seo_title=item.seo_title,
                seo_description=item.seo_description,
                uses_count=item.uses_count,
                tags=[tag.tag for tag in item.tags],
                is_published=item.is_published,
                created_at=item.created_at,
                updated_at=item.updated_at,
                created_by_user_id=item.created_by_user_id,
                updated_by_user_id=item.updated_by_user_id,
            )
            for item in items
        ],
        total=len(items),
    )


@router.post("/examples/seo-suggestions", response_model=GenerationExampleSeoSuggestionResponse)
async def get_example_seo_suggestions(
    payload: GenerationExampleSeoSuggestionRequest,
    _admin: AdminOrService,
) -> GenerationExampleSeoSuggestionResponse:
    return await generate_example_seo_suggestions(payload)


@router.post("/examples", response_model=GenerationExampleAdminItem, status_code=status.HTTP_201_CREATED)
async def create_example(
    payload: GenerationExampleCreateRequest,
    admin: AdminOrService,
    db: DBSession,
) -> GenerationExampleAdminItem:
    slug = await generate_unique_slug(
        db,
        payload.slug or payload.title,
        fallback_prefix="example",
    )
    item = GenerationExample(
        slug=slug,
        title=_clean_optional_text(payload.title),
        description=_clean_optional_text(payload.description),
        prompt=payload.prompt.strip(),
        image_url=payload.image_url.strip(),
        seo_title=_clean_optional_text(payload.seo_title),
        seo_description=_clean_optional_text(payload.seo_description),
        is_published=payload.is_published,
        created_by_user_id=admin.id if admin else None,
        updated_by_user_id=admin.id if admin else None,
    )
    normalized_tags = _normalize_tags(payload.tags)
    if normalized_tags:
        item.tags = [GenerationExampleTag(tag=tag) for tag in normalized_tags]
    item.slug_history = [GenerationExampleSlug(slug=slug)]
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return GenerationExampleAdminItem(
        id=item.id,
        slug=item.slug,
        title=item.title,
        description=item.description,
        prompt=item.prompt,
        image_url=item.image_url,
        seo_title=item.seo_title,
        seo_description=item.seo_description,
        uses_count=item.uses_count,
        tags=[tag.tag for tag in item.tags],
        is_published=item.is_published,
        created_at=item.created_at,
        updated_at=item.updated_at,
        created_by_user_id=item.created_by_user_id,
        updated_by_user_id=item.updated_by_user_id,
    )


@router.put("/examples/{example_id}", response_model=GenerationExampleAdminItem)
async def update_example(
    example_id: int,
    payload: GenerationExampleUpdateRequest,
    admin: AdminOrService,
    db: DBSession,
) -> GenerationExampleAdminItem:
    result = await db.execute(
        sa.select(GenerationExample)
        .options(
            selectinload(GenerationExample.tags),
            selectinload(GenerationExample.slug_history),
        )
        .where(GenerationExample.id == example_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Пример не найден")

    if payload.title is not None:
        item.title = _clean_optional_text(payload.title)
    if payload.description is not None:
        item.description = _clean_optional_text(payload.description)
    if payload.prompt is not None:
        item.prompt = payload.prompt.strip()
    if payload.image_url is not None:
        item.image_url = payload.image_url.strip()
    if payload.seo_title is not None:
        item.seo_title = _clean_optional_text(payload.seo_title)
    if payload.seo_description is not None:
        item.seo_description = _clean_optional_text(payload.seo_description)
    if payload.tags is not None:
        normalized_tags = _normalize_tags(payload.tags)
        existing_tags = {tag.tag for tag in item.tags}
        desired_tags = set(normalized_tags)

        for tag in list(item.tags):
            if tag.tag not in desired_tags:
                item.tags.remove(tag)

        for tag in normalized_tags:
            if tag not in existing_tags:
                item.tags.append(GenerationExampleTag(tag=tag))
    if payload.is_published is not None:
        item.is_published = payload.is_published

    should_update_slug = payload.slug is not None or payload.title is not None
    if should_update_slug:
        slug_source = payload.slug or item.title or f"example-{item.id}"
        new_slug = await generate_unique_slug(
            db,
            slug_source,
            fallback_prefix=f"example-{item.id}",
            exclude_example_id=item.id,
        )
        if new_slug != item.slug:
            current_slug = item.slug
            existing_history = {slug_row.slug for slug_row in item.slug_history}
            if current_slug not in existing_history:
                item.slug_history.append(GenerationExampleSlug(slug=current_slug))
            item.slug = new_slug
            existing_history.add(current_slug)
            if new_slug not in existing_history:
                item.slug_history.append(GenerationExampleSlug(slug=new_slug))

    item.updated_by_user_id = admin.id if admin else item.updated_by_user_id

    await db.commit()
    await db.refresh(item)
    return GenerationExampleAdminItem(
        id=item.id,
        slug=item.slug,
        title=item.title,
        description=item.description,
        prompt=item.prompt,
        image_url=item.image_url,
        seo_title=item.seo_title,
        seo_description=item.seo_description,
        uses_count=item.uses_count,
        tags=[tag.tag for tag in item.tags],
        is_published=item.is_published,
        created_at=item.created_at,
        updated_at=item.updated_at,
        created_by_user_id=item.created_by_user_id,
        updated_by_user_id=item.updated_by_user_id,
    )


@router.delete("/examples/{example_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_example(
    example_id: int,
    admin: AdminOrService,
    db: DBSession,
) -> None:
    result = await db.execute(sa.select(GenerationExample).where(GenerationExample.id == example_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Пример не найден")
    await db.delete(item)
    await db.commit()
    return None
