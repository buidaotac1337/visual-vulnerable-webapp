"""Pydantic schemas for lab metadata discovery and execution trace responses."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

LabMode = Literal["vulnerable", "secure"]
TraceLayer = Literal["frontend", "backend", "database"]
TraceStatus = Literal["info", "warning", "danger", "safe"]
TraceOutcome = Literal["exploited", "blocked", "normal", "error"]


class SamplePayload(BaseModel):
    """One-click pedagogical payload button defined inside a lab's meta.json.

    Attributes:
        label: Short button text displayed as a PayloadChip.
        description: Brief educational explanation of what the payload tests.
        data: JSON object pre-filled into the MiniShop sandbox form.
    """

    label: str
    description: str
    data: dict[str, Any]


class VerifyTestCase(BaseModel):
    """Single automated assertion executed by the Test My Fix verifier.

    Attributes:
        name: Human-readable test case title displayed in VerifyModal.
        action: Async handler name inside labs/<id>/backend/vulnerable.py.
        input: Request JSON payload supplied to the handler.
        expect: Subset of key-value pairs expected in response.data.
    """

    name: str
    action: str
    input: dict[str, Any]
    expect: dict[str, Any]


class LabMetadata(BaseModel):
    """Structured metadata loaded from labs/<id>/meta.json.

    Attributes:
        id: Unique kebab-case lab identifier matching the directory name.
        title: Human-readable lesson title displayed in TopControlBar.
        category: Vulnerability family (e.g., Injection, XSS, Access Control).
        difficulty: Difficulty label shown to students.
        summary: Short overview of the exploit scenario.
        safety_pattern: Summary of the recommended secure coding pattern.
        sample_payloads: Pre-configured 1-click payloads for the sandbox UI.
        verify_tests: Automated checks run when the student clicks Test My Fix.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    category: str
    difficulty: str
    summary: str
    safety_pattern: str = Field(alias="safetyPattern")
    sample_payloads: list[SamplePayload] = Field(default_factory=list, alias="samplePayloads")
    verify_tests: list[VerifyTestCase] = Field(default_factory=list, alias="verifyTests")


class LabListResponse(BaseModel):
    """Response envelope returned by GET /api/labs.

    Attributes:
        labs: Ordered list of discovered lab metadata entries.
    """

    labs: list[LabMetadata]


class TraceStep(BaseModel):
    """Single step in the live execution trace used to glow pipeline & code lines.

    Attributes:
        step: 1-based sequential step number.
        layer: Architectural layer where the step occurred.
        tag: Anchor tag matching an # @step:<tag> marker in source code.
        status: Semantic highlight color status.
        title: Concise heading displayed inside the Inline Callout Box.
        detail: Runtime variable/SQL/explanation detail for students.
    """

    step: int
    layer: TraceLayer
    tag: str
    status: TraceStatus
    title: str
    detail: str


class LabExecutionMeta(BaseModel):
    """Execution metadata block inside every lab action response.

    Attributes:
        lab_id: Identifier of the executed lab.
        mode: Active execution mode (vulnerable or secure).
        outcome: High-level pedagogical result classification.
    """

    lab_id: str
    mode: LabMode
    outcome: TraceOutcome = "normal"


class LabExecutionResponse(BaseModel):
    """Unified JSON response contract for POST /api/labs/{lab_id}/{mode}/{action}.

    Attributes:
        ok: True when the handler executed without unhandled runtime errors.
        data: Domain output returned to the MiniShop Sandbox UI.
        meta: Execution context including lab_id, mode, and outcome.
        trace: Ordered execution trace array driving live highlighting.
    """

    ok: bool = True
    data: dict[str, Any] = Field(default_factory=dict)
    meta: LabExecutionMeta
    trace: list[TraceStep] = Field(default_factory=list)
