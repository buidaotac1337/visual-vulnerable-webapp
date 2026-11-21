"""Lab discovery, source inspection, download, verify, and execution routes."""

from fastapi import APIRouter, Query, Response

from app.api.deps import EngineContextDep, LabInvocationDep, SettingsDep
from app.schemas import (
    LabExecutionResponse,
    LabListResponse,
    LabMode,
    LabSourceResponse,
    VerifyLabResponse,
)
from app.services import (
    LabActionRequest,
    build_snippet_zip,
    discover_labs,
    execute_lab_action,
    read_lab_source,
    reset_upload_sandbox,
    resolve_lab_dir,
    validate_action_name,
    validate_lab_id,
    verify_lab,
)

router = APIRouter(prefix="/api/labs", tags=["labs"])


@router.get("", response_model=LabListResponse)
async def list_labs_endpoint(settings: SettingsDep) -> LabListResponse:
    """List all educational security labs discovered under labs/.

    Args:
        settings: Injected application Settings providing labs_dir.

    Returns:
        LabListResponse containing validated metadata for every lab.
    """
    return LabListResponse(labs=discover_labs(settings.labs_dir))


@router.get("/{lab_id}/source", response_model=LabSourceResponse)
async def get_lab_source_endpoint(
    lab_id: str,
    settings: SettingsDep,
) -> LabSourceResponse:
    """Read live source snippets, # @step line mappings, and unified diff for a lab.

    Args:
        lab_id: Kebab-case identifier of the lab.
        settings: Injected application Settings providing labs_dir.

    Returns:
        LabSourceResponse with vulnerable, secure, optional frontend, and diff.
    """
    return read_lab_source(settings.labs_dir, lab_id)


@router.get("/{lab_id}/download")
async def download_lab_snippet_endpoint(
    lab_id: str,
    settings: SettingsDep,
) -> Response:
    """Package and download a lab's vulnerable/secure/diff/README bundle as a ZIP.

    Args:
        lab_id: Kebab-case identifier of the lab.
        settings: Injected application Settings providing labs_dir.

    Returns:
        Binary application/zip HTTP response with Content-Disposition attachment header.
    """
    safe_id = validate_lab_id(lab_id)
    archive_bytes = build_snippet_zip(settings.labs_dir, safe_id)
    headers = {"Content-Disposition": f'attachment; filename="{safe_id}-fastapi.zip"'}
    return Response(content=archive_bytes, media_type="application/zip", headers=headers)


@router.post("/{lab_id}/verify", response_model=VerifyLabResponse)
async def verify_lab_endpoint(
    lab_id: str,
    ctx: EngineContextDep,
    reset_db: bool = Query(default=False),
) -> VerifyLabResponse:
    """Execute meta.json verifyTests against vulnerable.py to grade a student's fix.

    Args:
        lab_id: Kebab-case identifier of the lab.
        ctx: Injected EngineContext with settings and database manager.
        reset_db: When True, replay seed.sql before each verification test.

    Returns:
        VerifyLabResponse summarizing overall pass status and per-test results.
    """
    resolve_lab_dir(ctx.settings.labs_dir, lab_id)
    lab_db = await ctx.db_manager.get_lab_db()

    async def _reset_all() -> float:
        duration_ms = await ctx.db_manager.reset_database()
        reset_upload_sandbox(ctx.settings.upload_sandbox_dir)
        return duration_ms

    return await verify_lab(
        labs_dir=ctx.settings.labs_dir,
        lab_id=lab_id,
        db=lab_db,
        reset_fn=_reset_all if reset_db else None,
        upload_sandbox_dir=ctx.settings.upload_sandbox_dir,
    )


@router.post("/{lab_id}/{mode}/{action}", response_model=LabExecutionResponse)
async def execute_lab_action_endpoint(
    lab_id: str,
    mode: LabMode,
    action: str,
    ctx: EngineContextDep,
    invocation: LabInvocationDep,
) -> LabExecutionResponse:
    """Execute a lab's vulnerable or secure async handler and return its trace.

    Args:
        lab_id: Kebab-case identifier of the lab.
        mode: Target execution mode ('vulnerable' or 'secure').
        action: Public async handler function name inside <mode>.py.
        ctx: Injected EngineContext with settings and database manager.
        invocation: Untrusted JSON payload plus trusted session actor (ADR-0005).

    Returns:
        LabExecutionResponse containing data, meta, and live trace steps.
    """
    resolve_lab_dir(ctx.settings.labs_dir, lab_id)
    validate_action_name(action)
    lab_db = await ctx.db_manager.get_lab_db()
    action_req = LabActionRequest(
        lab_id=lab_id,
        mode=mode,
        action=action,
        payload=invocation.payload,
        actor=invocation.actor,
    )
    return await execute_lab_action(
        ctx.settings.labs_dir,
        action_req,
        lab_db,
        upload_sandbox_dir=ctx.settings.upload_sandbox_dir,
    )
