import os
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()


def setup_supabase():
    import supabase as sb

    url: str | None = os.environ.get("SUPABASE_URL")
    key: str | None = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError(
            "Supabase URL and Key must be set in environment variables SUPABASE_URL and SUPABASE_KEY"
        )

    return sb.create_client(url, key)


def fetch_data():
    """Fetch sentiment data from Supabase."""
    supabase = setup_supabase()
    try:
        response = supabase.table("sentiments").select("*").execute()
        data = response.data
        if not data:
            print("No data found in 'sentiments' table.")
            return pd.DataFrame()

        df = pd.DataFrame(data)
        # Convert date_generated to datetime
        df["date_generated"] = pd.to_datetime(df["date_generated"])

        # Filter out seed data
        df = df[df["proposition_id"] != "demo-prop"]

        return df.sort_values(by=["proposition_id", "date_generated"])
    except Exception as e:
        print(f"Error fetching data: {e}")
        return pd.DataFrame()


def visualize_consensus_attention(df):
    """
    Create a single figure with subplots for each proposition.
    """
    if df.empty:
        return

    propositions = df["proposition_id"].unique()
    num_props = len(propositions)

    # Define specs for secondary y-axis for each subplot
    specs = [[{"secondary_y": True}] for _ in range(num_props)]

    fig = make_subplots(
        rows=num_props,
        cols=1,
        specs=specs,
        subplot_titles=propositions,
        vertical_spacing=0.1,
    )

    for i, prop_id in enumerate(propositions):
        prop_df = df[df["proposition_id"] == prop_id]
        row_idx = i + 1

        # Add trace for Consensus
        fig.add_trace(
            go.Scatter(
                x=prop_df["date_generated"],
                y=prop_df["consensus_value"],
                name="Consensus",
                mode="lines+markers",
                line=dict(color="blue"),
                showlegend=(i == 0),  # Only show legend once if consistent
            ),
            row=row_idx,
            col=1,
            secondary_y=False,
        )

        # Add trace for Attention
        fig.add_trace(
            go.Scatter(
                x=prop_df["date_generated"],
                y=prop_df["attention_value"],
                name="Attention",
                mode="lines+markers",
                line=dict(color="orange", dash="dot"),
                showlegend=(i == 0),  # Only show legend once if consistent
            ),
            row=row_idx,
            col=1,
            secondary_y=True,
        )

        # Set y-axes titles
        fig.update_yaxes(
            title_text="Consensus",
            range=[-0.1, 1.1],
            row=row_idx,
            col=1,
            secondary_y=False,
        )
        fig.update_yaxes(
            title_text="Attention",
            range=[-0.1, 1.1],
            row=row_idx,
            col=1,
            secondary_y=True,
        )

    fig.update_layout(
        title_text="Sentiment Analysis: Per-Proposition Trends",
        height=300 * num_props,  # Adjust height based on number of plots
        xaxis_title="Date",
    )

    fig.show()


def visualize_combined_trends(df):
    """
    Visualize trends comparing all propositions on one chart.
    """
    if df.empty:
        return

    # Consensus comparison
    fig_consensus = px.line(
        df,
        x="date_generated",
        y="consensus_value",
        color="proposition_id",
        title="Consensus Trends by Proposition",
        markers=True,
        labels={"consensus_value": "Consensus Value", "date_generated": "Date"},
    )
    fig_consensus.show()

    # Attention comparison
    fig_attention = px.line(
        df,
        x="date_generated",
        y="attention_value",
        color="proposition_id",
        title="Attention Trends by Proposition",
        markers=True,
        labels={"attention_value": "Attention Value", "date_generated": "Date"},
    )
    fig_attention.show()


if __name__ == "__main__":
    print("Fetching data from Supabase...")
    df = fetch_data()

    if not df.empty:
        print(f"Loaded {len(df)} records.")
        print("Generating visualizations...")

        # Option 1: Detailed per-proposition view (Single plot with subplots)
        visualize_consensus_attention(df)
