"""Tasks and Operations Router

Endpoints for triggering pipelines and LLM operations via HTTP.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pollmph.api.schemas import (
    TaskTriggerRequest,
    BackfillTriggerRequest,
    EvaluateTriggerRequest,
    TaskExecutionResult,
)
from pollmph.cli import adapter_map

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("/run-today", response_model=TaskExecutionResult)
def trigger_run_today(
    payload: TaskTriggerRequest,
    background_tasks: BackgroundTasks,
):
    """Trigger sentiment evaluation for today's scheduled propositions."""
    from pollmph.workflow import run_today as _run_today

    adapter = adapter_map[payload.llm]()

    # Run in background tasks
    background_tasks.add_task(
        _run_today,
        daily_limit=payload.limit,
        adapter=adapter,
        no_db=payload.no_db,
        verbose=payload.verbose,
    )

    return TaskExecutionResult(
        task="run-today",
        status="queued",
        message=f"Sentiment analysis for up to {payload.limit} propositions queued with adapter '{payload.llm}'",
    )


@router.post("/backfill", response_model=TaskExecutionResult)
def trigger_backfill(
    payload: BackfillTriggerRequest,
    background_tasks: BackgroundTasks,
):
    """Trigger backfill across past days for specified propositions."""
    from pollmph.workflow import run_backfill_sentiment

    adapter = adapter_map[payload.llm]()

    background_tasks.add_task(
        run_backfill_sentiment,
        proposition_ids=payload.ids,
        days_back=payload.days_back,
        adapter=adapter,
        no_db=payload.no_db,
        verbose=payload.verbose,
    )

    return TaskExecutionResult(
        task="backfill",
        status="queued",
        message=f"Backfill for {payload.days_back} days queued with adapter '{payload.llm}'",
        details={"proposition_ids": payload.ids, "days_back": payload.days_back},
    )


@router.post("/evaluate", response_model=TaskExecutionResult)
def evaluate_proposition_statement(
    payload: EvaluateTriggerRequest,
):
    """Synchronously evaluate whether a proposition has enough public traction."""
    from pollmph.task import EvaluatePropositionTask

    adapter = adapter_map[payload.llm]()
    task = EvaluatePropositionTask(adapter=adapter)
    _, result = task.run(proposition_text=payload.text)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LLM failed to return evaluation output",
        )

    return TaskExecutionResult(
        task="evaluate",
        status="completed",
        message="Evaluation completed successfully",
        details={
            "attention_value": result.attention_value,
            "is_worth_tracking": result.is_worth_tracking,
            "suggested_text": result.suggested_proposition_text,
            "rationale": result.rationale_attention,
            "queries_used": result.search_queries_used,
        },
    )
