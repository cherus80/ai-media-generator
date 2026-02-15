"""
Модель примеров генераций для публичной библиотеки.
"""

from sqlalchemy import Boolean, Integer, String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class GenerationExample(Base, TimestampMixin):
    """
    Пример генерации (картинка + промпт).
    """

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(240), nullable=False, unique=True, index=True)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    seo_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    seo_variant_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    uses_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_by_user = relationship("User", foreign_keys=[created_by_user_id], lazy="joined")
    updated_by_user = relationship("User", foreign_keys=[updated_by_user_id], lazy="joined")
    tags = relationship(
        "GenerationExampleTag",
        back_populates="example",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    slug_history = relationship(
        "GenerationExampleSlug",
        back_populates="example",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    variant_stats = relationship(
        "GenerationExampleVariantStat",
        back_populates="example",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<GenerationExample id={self.id} uses={self.uses_count}>"


class GenerationExampleTag(Base, TimestampMixin):
    """
    Метки для примеров генераций.
    """

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    example_id: Mapped[int] = mapped_column(
        ForeignKey("generation_examples.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    example = relationship("GenerationExample", back_populates="tags", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<GenerationExampleTag example_id={self.example_id} tag={self.tag!r}>"


class GenerationExampleSlug(Base, TimestampMixin):
    """
    История slug для 301-редиректов со старых URL.
    """

    __table_args__ = (UniqueConstraint("slug", name="uq_generation_example_slugs_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    example_id: Mapped[int] = mapped_column(
        ForeignKey("generation_examples.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slug: Mapped[str] = mapped_column(String(240), nullable=False, index=True)

    example = relationship("GenerationExample", back_populates="slug_history", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<GenerationExampleSlug example_id={self.example_id} slug={self.slug!r}>"


class GenerationExampleVariantStat(Base, TimestampMixin):
    """
    Агрегированные метрики по варианту SEO-карточки.
    """

    __table_args__ = (
        UniqueConstraint(
            "example_id",
            "source",
            "seo_variant_index",
            name="uq_generation_example_variant_stats_example_source_variant",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    example_id: Mapped[int] = mapped_column(
        ForeignKey("generation_examples.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source: Mapped[str] = mapped_column(String(40), nullable=False, server_default="unknown", index=True)
    seo_variant_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", index=True)
    views_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    starts_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    example = relationship("GenerationExample", back_populates="variant_stats", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover
        return (
            "<GenerationExampleVariantStat "
            f"example_id={self.example_id} source={self.source!r} variant={self.seo_variant_index} "
            f"views={self.views_count} starts={self.starts_count}>"
        )
