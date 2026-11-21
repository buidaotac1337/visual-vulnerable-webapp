"""Lab 02 (Secure): Stored XSS in MiniShop product reviews.

The backend stores review content verbatim and returns it unchanged. That is the
correct pattern: the defense is output encoding at the render point
(frontend/secure.tsx), not mangling data on input.
"""

import re
from typing import Any

from app.db import LabDatabaseProtocol
from app.schemas import LabContext

_MARKUP_RE = re.compile(r"<\s*[a-zA-Z!/?]")
_MAX_CONTENT_LENGTH = 500
_MIN_RATING = 1
_MAX_RATING = 5

_PRODUCTS_SQL = "SELECT id, name FROM products ORDER BY id"
_REVIEWS_SQL = (
    "SELECT r.id, r.rating, r.content, u.username FROM reviews r "
    "JOIN users u ON u.id = r.user_id WHERE r.product_id = $1 ORDER BY r.id"
)
_INSERT_SQL = (
    "INSERT INTO reviews (product_id, user_id, rating, content) "
    "VALUES ($1, $2, $3, $4) RETURNING id"
)


def _has_markup(text: str) -> bool:
    """Return True when text contains something a browser would parse as a tag.

    Args:
        text: Review content.

    Returns:
        True if the content contains HTML-like markup.
    """
    return _MARKUP_RE.search(text) is not None


def _as_int(value: object, default: int) -> int:
    """Convert a JSON value to int, falling back to a default.

    Args:
        value: Raw payload value.
        default: Value used when conversion fails.

    Returns:
        Parsed integer.
    """
    try:
        return int(str(value))
    except ValueError:
        return default


async def _load_page(db: LabDatabaseProtocol, product_id: int) -> dict[str, Any]:
    """Load the product selector and the review list of one product.

    Args:
        db: Restricted lab database adapter.
        product_id: Product whose reviews are listed.

    Returns:
        Page data with products, reviews, and count.
    """
    products = await db.fetch_all(_PRODUCTS_SQL)
    reviews = await db.fetch_all(_REVIEWS_SQL, product_id)
    return {
        "product_id": product_id,
        "products": products,
        "reviews": reviews,
        "count": len(reviews),
    }


def _page_outcome(page: dict[str, Any]) -> str:
    """Classify the page: stored markup is neutralized by output encoding.

    Args:
        page: Result of _load_page.

    Returns:
        'blocked' when any review contains markup, otherwise 'normal'.
    """
    marked = [r for r in page["reviews"] if _has_markup(str(r.get("content", "")))]
    return "blocked" if marked else "normal"


def _validation_error(product_ids: set[int], product_id: int, rating: int, content: str) -> str:
    """Return a validation message, or an empty string when the review is valid.

    Args:
        product_ids: Existing product identifiers.
        product_id: Target product.
        rating: Submitted rating.
        content: Submitted content (already stripped).

    Returns:
        Human-readable error, or '' if valid.
    """
    if product_id not in product_ids:
        return f"Sản phẩm id={product_id} không tồn tại."
    if not _MIN_RATING <= rating <= _MAX_RATING:
        return f"Điểm đánh giá phải từ {_MIN_RATING} đến {_MAX_RATING}, nhận {rating}."
    if not content or len(content) > _MAX_CONTENT_LENGTH:
        return f"Nội dung phải có từ 1 đến {_MAX_CONTENT_LENGTH} ký tự."
    return ""


def _return_step(page: dict[str, Any], tag: str) -> dict[str, Any]:
    """Describe the review list handed to the frontend.

    Args:
        page: Result of _load_page.
        tag: @step tag of the line that loaded the page.

    Returns:
        Raw trace step for the database layer.
    """
    marked = sum(1 for r in page["reviews"] if _has_markup(str(r.get("content", ""))))
    return {
        "layer": "database",
        "tag": tag,
        "status": "info",
        "title": "Trả danh sách đánh giá nguyên văn",
        "detail": (
            f"{page['count']} đánh giá (product_id={page['product_id']}), {marked} chứa HTML. "
            "frontend/secure.tsx sẽ hiển thị chúng dưới dạng chữ."
        ),
    }


def _rejected(page: dict[str, Any], steps: list[dict[str, Any]], error: str) -> dict[str, Any]:
    """Build the response for a review that was not saved.

    Args:
        page: Current page data.
        steps: Trace steps collected so far.
        error: Reason shown to the user.

    Returns:
        Lab execution dictionary.
    """
    return {
        "data": {**page, "saved": False, "error": error},
        "meta": {"outcome": "normal"},
        "trace": steps,
    }


# @snippet:start
async def list_reviews(payload: dict[str, Any], db: LabDatabaseProtocol) -> dict[str, Any]:
    """Load the product page with its reviews (SECURE: data is returned verbatim)."""
    product_id = _as_int(payload.get("product_id"), 1)
    # @step:load-reviews
    page = await _load_page(db, product_id)
    return {
        "data": page,
        "meta": {"outcome": _page_outcome(page)},
        "trace": [
            {
                "layer": "backend",
                "tag": "load-reviews",
                "status": "info",
                "title": "Truy vấn tham số hóa danh sách đánh giá",
                "detail": f"{_REVIEWS_SQL} -- $1 = {product_id}",
            },
            # @step:return-reviews
            _return_step(page, "return-reviews"),
        ],
    }


async def post_review(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Store a review for the logged-in user (SECURE: verbatim, encoded on output)."""
    product_id = _as_int(payload.get("product_id"), 1)
    rating = _as_int(payload.get("rating"), 0)
    content = str(payload.get("content", "")).strip()
    page = await _load_page(db, product_id)
    actor = ctx.actor

    # @step:require-session
    if actor is None:
        step = {
            "layer": "backend",
            "tag": "require-session",
            "status": "warning",
            "title": "Chưa đăng nhập",
            "detail": "Chỉ người dùng đã đăng nhập mới được viết đánh giá.",
        }
        return _rejected(page, [step], "Cần đăng nhập để viết đánh giá.")

    # @step:validate-review
    error = _validation_error({int(p["id"]) for p in page["products"]}, product_id, rating, content)
    if error:
        step = {
            "layer": "backend",
            "tag": "validate-review",
            "status": "warning",
            "title": "Dữ liệu đánh giá không hợp lệ",
            "detail": error,
        }
        return _rejected(page, [step], error)

    # @step:insert-review
    review_id = await db.fetch_val(_INSERT_SQL, product_id, actor.id, rating, content)
    # @step:reload-reviews
    page = await _load_page(db, product_id)
    review = {"id": review_id, "username": actor.username, "rating": rating, "content": content}
    return {
        "data": {**page, "saved": True, "review": review},
        "meta": {"outcome": _page_outcome(page)},
        "trace": [
            {
                "layer": "backend",
                "tag": "validate-review",
                "status": "info",
                "title": "Kiểm tra dữ liệu đánh giá",
                "detail": f"user={actor.username} (phiên), rating={rating}, {len(content)} ký tự",
            },
            {
                "layer": "database",
                "tag": "insert-review",
                "status": "info",
                "title": "Lưu nguyên văn — encode ở đầu ra",
                "detail": f"INSERT tham số hóa, content = {content!r}. Không escape ở đầu vào.",
            },
            _return_step(page, "reload-reviews"),
        ],
    }


# @snippet:end
