import json
from datetime import datetime
from pathlib import Path
from typing import Annotated, Optional

import typer

from pollmph.util import get_gemini_adapter

app = typer.Typer(name="pollmph", help="Philippine political sentiment tracker.")

_mock_opt = typer.Option(
    "--mock", help="Use mock adapter instead of real LLM (no API cost)."
)


@app.command()
def run_today(
    limit: Annotated[
        int, typer.Option("--limit", "-l", help="Max propositions to process.")
    ] = 5,
    mock: Annotated[bool, _mock_opt] = False,
):
    """Run sentiment analysis for today's scheduled propositions."""
    from pollmph.workflow import run_today as _run_today
    from pollmph.util import get_mock_adapter

    if mock:
        adapter = get_mock_adapter()
    else:
        adapter = get_gemini_adapter(model="gemini-2.5-pro")
    _run_today(daily_limit=limit, adapter=adapter)


@app.command()
def backfill(
    ids: Annotated[
        Optional[list[str]],
        typer.Option("--id", help="Proposition ID to backfill. Repeatable."),
    ] = None,
    days_back: Annotated[
        int, typer.Option("--days-back", help="Number of past days to backfill.")
    ] = 7,
    mock: Annotated[bool, _mock_opt] = False,
):
    """Backfill sentiment for one or more propositions over past N days."""
    from pollmph.workflow import run_backfill_sentiment
    from pollmph.util import get_mock_adapter

    run_backfill_sentiment(
        proposition_ids=ids or None,
        days_back=days_back,
        adapter=get_mock_adapter() if mock else None,
    )


@app.command()
def weekly_summary(
    ids: Annotated[
        Optional[list[str]],
        typer.Option("--id", help="Proposition ID to summarise. Repeatable."),
    ] = None,
    verbose: Annotated[
        bool, typer.Option("--verbose", "-v", help="Stream LLM output to terminal.")
    ] = False,
    mock: Annotated[bool, _mock_opt] = False,
):
    """Generate weekly narrative summaries for propositions."""
    from pollmph.workflow import run_weekly_summary
    from pollmph.util import get_mock_adapter

    run_weekly_summary(
        target_date=datetime.now(),
        proposition_ids=ids or None,
        verbose=verbose,
        adapter=get_mock_adapter() if mock else None,
    )


@app.command()
def add(
    file: Annotated[
        Optional[Path],
        typer.Option("--file", "-f", help="JSON file with proposition details."),
    ] = None,
    backfill_days: Annotated[
        Optional[int],
        typer.Option(
            "--backfill-days", help="Days of sentiment to backfill after adding."
        ),
    ] = None,
    mock: Annotated[bool, _mock_opt] = False,
):
    """Add a new proposition to the database."""
    from pollmph.db import create_proposition
    from pollmph.models import PropositionModel
    from pollmph.util import get_supabase_client

    if file:
        with open(file) as f:
            data = json.load(f)
        typer.echo(f"proposition_id:   {data['proposition_id']}")
        typer.echo(f"proposition_text: {data['proposition_text']}")
        typer.echo(f"search_queries:   {', '.join(data['search_queries'])}")
    else:
        proposition_id = typer.prompt("Proposition ID")
        proposition_text = typer.prompt("Proposition text")
        raw_queries = typer.prompt("Search queries (comma-separated)")
        data = {
            "proposition_id": proposition_id,
            "proposition_text": proposition_text,
            "search_queries": [q.strip() for q in raw_queries.split(",")],
        }

    proposition = PropositionModel.model_validate(data)
    sb_client = get_supabase_client()
    result = create_proposition(sb_client, proposition)

    if result is None:
        typer.echo("Failed to add proposition.", err=True)
        raise typer.Exit(1)

    if backfill_days:
        from pollmph.workflow import run_backfill_sentiment
        from pollmph.util import get_mock_adapter

        run_backfill_sentiment(
            proposition_ids=[proposition.proposition_id],
            days_back=backfill_days,
            adapter=get_mock_adapter() if mock else None,
        )


@app.command()
def evaluate(
    text: Annotated[
        Optional[str], typer.Option("--text", "-t", help="The proposition statement.")
    ] = None,
    id: Annotated[
        Optional[str], typer.Option("--id", help="Unique ID for the proposition.")
    ] = None,
    out: Annotated[
        Optional[Path],
        typer.Option(
            "--out", "-o", help="Output path for generated JSON (for use with `add`)."
        ),
    ] = None,
    verbose: Annotated[
        bool, typer.Option("--verbose", "-v", help="Stream LLM output to terminal.")
    ] = False,
    mock: Annotated[bool, _mock_opt] = False,
):
    """Evaluate whether a proposition has enough public attention to track."""
    from pollmph.task import EvaluatePropositionTask
    from pollmph.util import get_xai_adapter, get_mock_evaluate_adapter

    if not text:
        text = typer.prompt("Proposition text")
    if not id:
        id = typer.prompt("Proposition ID")

    adapter = (
        get_mock_evaluate_adapter()
        if mock
        else get_xai_adapter(model="grok-4-1-fast-reasoning")
    )
    task = EvaluatePropositionTask(adapter=adapter, verbose=verbose)
    _, result = task.run(proposition_text=text)

    if result is None:
        typer.echo("Evaluation failed - no output from LLM.", err=True)
        raise typer.Exit(1)

    typer.echo(f"\nAttention:      {result.attention_value:.2f}")
    typer.echo(f"Worth tracking: {result.is_worth_tracking}")
    typer.echo(f"Suggested text: {result.suggested_proposition_text}")
    typer.echo(f"Rationale:      {result.rationale_attention}")
    typer.echo(f"Queries used:   {', '.join(result.search_queries_used)}")

    if result.is_worth_tracking:
        output_data = {
            "proposition_id": id,
            "proposition_text": result.suggested_proposition_text,
            "search_queries": result.search_queries_used,
        }
        save_path = out or Path(f"{id}.json")
        with open(save_path, "w") as f:
            json.dump(output_data, f, indent=4)
        typer.echo(
            f"\nSaved to {save_path}. Run `pollmph add --file {save_path}` to add it."
        )
    else:
        typer.echo("\nThis proposition does not have enough traction yet.")
