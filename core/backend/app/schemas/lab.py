"""Pydantic schemas for lab metadata discovery and execution trace responses."""

import re
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Discriminator,
    Field,
    Tag,
    field_validator,
    model_validator,
)

from app.schemas.session import ACTOR_USERNAME_PATTERN

LabMode = Literal["vulnerable", "secure"]
TraceLayer = Literal["frontend", "backend", "database"]
TraceStatus = Literal["info", "warning", "danger", "safe"]
TraceOutcome = Literal["exploited", "blocked", "normal", "error"]
VerifyLayer = Literal["backend", "frontend"]

_COMPONENT_NAME_PATTERN = re.compile(r"\A[A-Z][A-Za-z0-9]*\Z")


class SamplePayload(BaseModel):
    """One-click pedagogical payload button defined inside a lab's meta.json.

    Attributes:
        label: Short button text displayed as a PayloadChip.
        description: Brief educational explanation of what the payload tests.
        data: JSON object pre-filled into the MiniShop sandbox form.
        actor: Optional persona the sandbox switches to when the chip is clicked.
    """

    label: str
    description: str
    data: dict[str, Any]
    actor: str | None = None


class BackendVerifyTest(BaseModel):
    """Backend assertion run by POST /api/labs/{id}/verify against backend/vulnerable.py.

    Attributes:
        layer: Always 'backend' (the default when meta.json omits `layer`).
        name: Human-readable test case title displayed in VerifyModal.
        action: Async handler name inside labs/<id>/backend/vulnerable.py.
        input: Request JSON payload supplied to the handler.
        expect: Subset of key-value pairs expected in response.data.
        actor: Optional persona whose session the handler receives via ctx.
    """

    layer: Literal["backend"] = "backend"
    name: str
    action: str
    input: dict[str, Any]
    expect: dict[str, Any]
    actor: str | None = None


class FrontendVerifyTest(BaseModel):
    """Frontend assertion run in the browser against frontend/vulnerable.tsx (ADR-0006).

    Attributes:
        layer: Always 'frontend'.
        name: Human-readable test case title displayed in VerifyModal.
        component: Named export of frontend/vulnerable.tsx to render.
        props: Props passed to the component inside the inert document.
        expect: Expectation matched against the DOM probe observation.
    """

    layer: Literal["frontend"]
    name: str
    component: str
    props: dict[str, Any] = Field(default_factory=dict)
    expect: dict[str, Any]

    @field_validator("component")
    @classmethod
    def _validate_component_name(cls, value: str) -> str:
        """Require a PascalCase export name so it can only address a React component.

        Args:
            value: Raw component name from meta.json.

        Returns:
            The unchanged component name.

        Raises:
            ValueError: If the name is not a PascalCase identifier.
        """
        if not _COMPONENT_NAME_PATTERN.match(value):
            msg = f"Invalid component name '{value}'; expected a PascalCase export."
            raise ValueError(msg)
        return value


def _verify_layer(value: Any) -> str:  # noqa: ANN401
    """Pick the verifyTests union member, defaulting to 'backend' when `layer` is absent.

    Args:
        value: Raw dict from meta.json or an already-built model.

    Returns:
        Discriminator tag ('backend', 'frontend', or the unknown raw value).
    """
    if isinstance(value, dict):
        return str(value.get("layer", "backend"))
    return str(getattr(value, "layer", "backend"))


VerifyTestCase = Annotated[
    Annotated[BackendVerifyTest, Tag("backend")] | Annotated[FrontendVerifyTest, Tag("frontend")],
    Discriminator(_verify_layer),
]


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
        actors: Seed usernames offered in the persona switcher (first is the default).
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
    actors: list[str] = Field(default_factory=list)

    @field_validator("actors")
    @classmethod
    def _validate_actor_names(cls, value: list[str]) -> list[str]:
        """Reject persona names that the session header could never carry.

        Args:
            value: Raw actors list from meta.json.

        Returns:
            The unchanged list when every name is a safe, unique username.

        Raises:
            ValueError: If a name is malformed or duplicated.
        """
        invalid = [name for name in value if not ACTOR_USERNAME_PATTERN.match(name)]
        if invalid:
            msg = f"Invalid actor usernames: {invalid}."
            raise ValueError(msg)
        if len(set(value)) != len(value):
            msg = "Duplicate entries in actors."
            raise ValueError(msg)
        return value

    @model_validator(mode="after")
    def _validate_actor_references(self) -> "LabMetadata":
        """Ensure every samplePayloads/verifyTests actor is declared in actors.

        Returns:
            Validated LabMetadata instance.

        Raises:
            ValueError: If a payload or test references an undeclared actor.
        """
        referenced = {item.actor for item in self.sample_payloads}
        referenced |= {
            item.actor for item in self.verify_tests if isinstance(item, BackendVerifyTest)
        }
        unknown = sorted(
            name for name in referenced if name is not None and name not in self.actors
        )
        if unknown:
            msg = f"Actors {unknown} are referenced but not declared in 'actors'."
            raise ValueError(msg)
        return self


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
