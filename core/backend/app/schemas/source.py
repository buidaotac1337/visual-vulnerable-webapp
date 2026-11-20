"""Pydantic schemas for source code inspection and # @step line mapping."""

from pydantic import BaseModel, Field


class ParsedSourceFile(BaseModel):
    """Cleaned source snippet with resolved # @step line mappings.

    Attributes:
        code: Extracted source text with @snippet/@step comment markers stripped.
        steps: Mapping from @step tag name to 1-based line number inside `code`.
        line_count: Total number of lines in `code`.
    """

    code: str
    steps: dict[str, int] = Field(default_factory=dict)
    line_count: int


class LabSourceResponse(BaseModel):
    """Response envelope returned by GET /api/labs/{lab_id}/source.

    Attributes:
        lab_id: Identifier of the inspected lab.
        vulnerable: Parsed snippet and step map for backend/vulnerable.py.
        secure: Parsed snippet and step map for backend/secure.py.
        frontend: Optional parsed snippet and step map for frontend/LabView.tsx.
        diff: Unified diff comparing vulnerable.code against secure.code.
    """

    lab_id: str
    vulnerable: ParsedSourceFile
    secure: ParsedSourceFile
    frontend: ParsedSourceFile | None = None
    diff: str
