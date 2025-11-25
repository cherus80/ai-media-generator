"""
Image processing utilities for AI image generation.

This module provides helper functions for:
- Calculating aspect ratios from image dimensions
- Determining optimal image sizes for different services
- Converting between different aspect ratio formats
"""

import logging
from pathlib import Path
from typing import Tuple

from PIL import Image

logger = logging.getLogger(__name__)


# ======================================================================
# ASPECT RATIO UTILITIES
# ======================================================================


def get_image_dimensions(file_path: str | Path) -> Tuple[int, int]:
    """
    Get width and height of an image file.

    Args:
        file_path: Path to image file

    Returns:
        Tuple of (width, height) in pixels

    Raises:
        IOError: If file cannot be read
        ValueError: If file is not a valid image
    """
    try:
        with Image.open(file_path) as img:
            width, height = img.size
            logger.debug(f"Image dimensions: {width}x{height} ({file_path})")
            return width, height
    except Exception as e:
        logger.error(f"Failed to read image dimensions from {file_path}: {e}")
        raise ValueError(f"Cannot read image: {e}") from e


def calculate_aspect_ratio(width: int, height: int, tolerance: float = 0.05) -> str:
    """
    Calculate the closest standard aspect ratio from image dimensions.

    This function maps actual image dimensions to kie.ai supported aspect ratios:
    1:1, 9:16, 16:9, 3:4, 4:3, 3:2, 2:3, 5:4, 4:5, 21:9

    Args:
        width: Image width in pixels
        height: Image height in pixels
        tolerance: Tolerance for ratio matching (default: 0.05 = 5%)

    Returns:
        Aspect ratio string (e.g., "16:9", "1:1", "auto")

    Examples:
        >>> calculate_aspect_ratio(1920, 1080)
        '16:9'
        >>> calculate_aspect_ratio(1080, 1920)
        '9:16'
        >>> calculate_aspect_ratio(1000, 1000)
        '1:1'
        >>> calculate_aspect_ratio(1200, 900)
        '4:3'
    """
    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid dimensions: {width}x{height}")

    # Calculate actual ratio
    actual_ratio = width / height

    # Standard aspect ratios (width:height format)
    # Format: (ratio_value, ratio_string)
    standard_ratios = [
        (1.0, "1:1"),  # Square
        (16 / 9, "16:9"),  # Widescreen landscape
        (9 / 16, "9:16"),  # Widescreen portrait
        (4 / 3, "4:3"),  # Standard landscape
        (3 / 4, "3:4"),  # Standard portrait
        (3 / 2, "3:2"),  # Classic photo landscape
        (2 / 3, "2:3"),  # Classic photo portrait
        (5 / 4, "5:4"),  # Slightly wider than square
        (4 / 5, "4:5"),  # Slightly taller than square
        (21 / 9, "21:9"),  # Ultra-wide
    ]

    # Find closest match
    best_match = None
    best_diff = float("inf")

    for ratio_value, ratio_str in standard_ratios:
        diff = abs(actual_ratio - ratio_value)

        # Check if within tolerance
        if diff <= tolerance * actual_ratio:
            if diff < best_diff:
                best_diff = diff
                best_match = ratio_str

    if best_match:
        logger.debug(
            f"Matched {width}x{height} (ratio={actual_ratio:.3f}) "
            f"to {best_match} (diff={best_diff:.4f})"
        )
        return best_match

    # No close match found, return "auto"
    logger.debug(
        f"No standard match for {width}x{height} (ratio={actual_ratio:.3f}), "
        f"returning 'auto'"
    )
    return "auto"


def determine_image_size_from_file(file_path: str | Path) -> str:
    """
    Determine optimal aspect ratio setting from an image file.

    This is a convenience function that combines get_image_dimensions()
    and calculate_aspect_ratio().

    Args:
        file_path: Path to image file

    Returns:
        Aspect ratio string (e.g., "16:9", "1:1", "auto")

    Examples:
        >>> determine_image_size_from_file("photo.jpg")
        '4:3'
    """
    width, height = get_image_dimensions(file_path)
    return calculate_aspect_ratio(width, height)


def determine_image_size_for_fitting(user_photo_path: str | Path) -> str:
    """
    Determine image size for virtual try-on based on user's photo.

    For virtual try-on, we want the output to match the aspect ratio
    of the user's uploaded photo to maintain natural proportions.

    Args:
        user_photo_path: Path to user's photo

    Returns:
        Aspect ratio string for kie.ai API

    Examples:
        >>> determine_image_size_for_fitting("uploads/user_123.jpg")
        '9:16'  # Vertical photo (portrait)
    """
    try:
        aspect_ratio = determine_image_size_from_file(user_photo_path)
        logger.info(
            f"Determined fitting image size: {aspect_ratio} "
            f"(from {user_photo_path})"
        )
        return aspect_ratio
    except Exception as e:
        logger.warning(
            f"Failed to determine image size from {user_photo_path}: {e}. "
            f"Falling back to 'auto'"
        )
        return "auto"


def determine_image_size_for_editing(base_image_path: str | Path) -> str:
    """
    Determine image size for editing to preserve original dimensions.

    For image editing, we want to preserve the original aspect ratio
    so the edited image has the same proportions as the input.

    Args:
        base_image_path: Path to base image for editing

    Returns:
        Aspect ratio string for kie.ai API

    Examples:
        >>> determine_image_size_for_editing("uploads/photo.jpg")
        '16:9'  # Preserves original widescreen format
    """
    try:
        aspect_ratio = determine_image_size_from_file(base_image_path)
        logger.info(
            f"Determined editing image size: {aspect_ratio} "
            f"(preserving original from {base_image_path})"
        )
        return aspect_ratio
    except Exception as e:
        logger.warning(
            f"Failed to determine image size from {base_image_path}: {e}. "
            f"Falling back to 'auto'"
        )
        return "auto"


# ======================================================================
# IMAGE FORMAT UTILITIES
# ======================================================================


def get_image_format(file_path: str | Path) -> str:
    """
    Determine the format of an image file.

    Args:
        file_path: Path to image file

    Returns:
        Format string (e.g., "JPEG", "PNG", "WEBP")

    Raises:
        IOError: If file cannot be read
        ValueError: If file is not a valid image
    """
    try:
        with Image.open(file_path) as img:
            format_str = img.format
            logger.debug(f"Image format: {format_str} ({file_path})")
            return format_str
    except Exception as e:
        logger.error(f"Failed to determine image format for {file_path}: {e}")
        raise ValueError(f"Cannot read image: {e}") from e


def normalize_output_format(format_str: str) -> str:
    """
    Normalize image format string for API compatibility.

    Args:
        format_str: Format string (e.g., "JPEG", "JPG", "PNG")

    Returns:
        Normalized format ("png" or "jpeg")

    Examples:
        >>> normalize_output_format("JPEG")
        'jpeg'
        >>> normalize_output_format("PNG")
        'png'
        >>> normalize_output_format("jpg")
        'jpeg'
    """
    format_lower = format_str.lower()

    if format_lower in ["jpg", "jpeg"]:
        return "jpeg"
    elif format_lower == "png":
        return "png"
    elif format_lower == "webp":
        # WEBP images can be converted to PNG for compatibility
        return "png"
    else:
        logger.warning(
            f"Unknown format '{format_str}', defaulting to 'png'"
        )
        return "png"


def get_output_format_for_file(file_path: str | Path, default: str = "png") -> str:
    """
    Determine appropriate output format based on input file.

    Args:
        file_path: Path to input image file
        default: Default format if detection fails (default: "png")

    Returns:
        Output format string ("png" or "jpeg")

    Examples:
        >>> get_output_format_for_file("photo.jpg")
        'jpeg'
        >>> get_output_format_for_file("screenshot.png")
        'png'
    """
    try:
        format_str = get_image_format(file_path)
        return normalize_output_format(format_str)
    except Exception as e:
        logger.warning(
            f"Failed to detect format for {file_path}: {e}. "
            f"Using default: {default}"
        )
        return default


# ======================================================================
# VALIDATION UTILITIES
# ======================================================================


def validate_image_file(
    file_path: str | Path,
    max_size_mb: int = 10,
    allowed_formats: list[str] = None,
) -> Tuple[bool, str]:
    """
    Validate an image file for API upload.

    Args:
        file_path: Path to image file
        max_size_mb: Maximum file size in MB (default: 10)
        allowed_formats: List of allowed formats (default: ["JPEG", "PNG", "WEBP"])

    Returns:
        Tuple of (is_valid, error_message)
        If valid, error_message is empty string

    Examples:
        >>> validate_image_file("photo.jpg")
        (True, '')
        >>> validate_image_file("huge_image.png", max_size_mb=5)
        (False, 'File size exceeds 5 MB')
    """
    if allowed_formats is None:
        allowed_formats = ["JPEG", "PNG", "WEBP"]

    path = Path(file_path)

    # Check file exists
    if not path.exists():
        return False, f"File not found: {file_path}"

    # Check file size
    file_size_mb = path.stat().st_size / (1024 * 1024)
    if file_size_mb > max_size_mb:
        return False, f"File size {file_size_mb:.1f} MB exceeds {max_size_mb} MB"

    # Check format
    try:
        format_str = get_image_format(file_path)
        if format_str not in allowed_formats:
            return (
                False,
                f"Format '{format_str}' not in allowed formats: {allowed_formats}",
            )
    except ValueError as e:
        return False, str(e)

    return True, ""
