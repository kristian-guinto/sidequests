# pollmph (poll-em PH): AI-Powered Sentiment Oracle
 
> Deployed app available [here.](https://pollmph.vercel.app/)

pollmph is an automated sentiment analysis engine designed to track Philippine socio-political discourse. It acts as a "Predictive Market Oracle" by validating specific propositions against real-time web and social media data.

## 🚀 Concept

The core idea is to obtain objective, quantitative metrics for subjective political narratives. Instead of relying on traditional polling which is slow and expensive, pollmph uses Large Language Models (LLMs) with web access to perform instant, daily analysis.

### How It Works

1.  **Proposition Validation**: The system tracks specific claims or future events (e.g., *"Sara Duterte will win the 2028 election"*).
2.  **LLM Analysis**: A daily pipeline triggers an LLM (Google Gemini) to perform deep web searches and social discourse analysis via Google Search grounding.
3.  **Scoring**: The model evaluates the gathered data on two strictly defined metrics:
    *   **Consensus (0.00 - 1.00)**: Does the public agree with the proposition?
    *   **Attention (0.00 - 1.00)**: How loudly is the public talking about it?
4.  **Visualization**: Results are stored and visualized in an interactive dashboard to show trends over time.

## ✨ Features

- **Interactive Dashboard**: Browse all tracked propositions with real-time sentiment trends
- **Detailed Analysis Pages**: Dive deep into individual propositions with full analysis history
- **Trend Visualization**: 7-day moving average charts with raw data points and attention metrics
- **Daily Analysis Cards**: View consensus rationale, attention analysis, and movement insights for each day

## 🛠 Tech Stack & Architecture

This project is designed to be **serverless and effectively cost-free** by leveraging the free tiers of modern infrastructure providers.

*   **LLM Intelligence**: [Google Gemini](https://ai.google.dev/) (`gemini-2.5-flash`) for reasoning and real-time Google Search grounding.
*   **Database**: [Supabase](https://supabase.com) (PostgreSQL) for storing propositions and sentiment history with indexed queries.
*   **Frontend** (vibe-coded): React 19 + Vite + Tailwind CSS 4 + shadcn/ui components, hosted on [Vercel](https://vercel.com).
*   **Automation**: [GitHub Actions](https://github.com/features/actions) runs the Python analysis pipeline daily at 11:59 PM PHT.
*   **Package Management**: `uv` for extremely fast Python dependency management.

## 🔑 How to Generate a Google Gemini API Key

The Google Gemini API offers a generous **Free Tier** (up to 15 requests/min and 1,500 requests/day at $0 cost, no credit card / GCP billing required):

1. Go to **[Google AI Studio](https://aistudio.google.com/)**.
2. Sign in with your Google account.
3. Click on **"Get API key"** in the left sidebar (or go directly to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
4. Click **"Create API key"**.
5. Select **"Create API key in new project"** (or select an existing project).
6. Copy the generated key (starts with `AIzaSy...`) and add it to your `.env` file as `GEMINI_API_KEY`.

---

## 🏃‍♂️ Getting Started

### Prerequisites
*   Node.js 18+
*   Python 3.13+
*   Reference to a Supabase project
*   Google Gemini API Key

### Local Setup

1.  **Clone the repo**
    ```bash
    git clone https://github.com/GoldFish88/pollmph.git
    cd pollmph
    ```
2.  **Setup Frontend**
    ```bash
    cd frontend
    npm install
    
    # Configure environment files
    # Add your Supabase credentials to:
    # .env.development (for local Supabase)
    # .env.production (for production Supabase)
    
    # Run with development keys
    npm run dev
    
    # Or run with production keys
    npm run dev:prod
    ```
3.  **Setup Pipeline**
    ```bash
    # using uv (recommended)
    uv sync
    
    # Set up environment variables
    # Create a .env file in root with:
    # SUPABASE_URL=...
    # SUPABASE_KEY=...
    # GEMINI_API_KEY=...
    
    # Run sentiment analysis for today
    uv run pollmph run-today --limit 5 --llm gemini
    
    # Backfill sentiment over past N days
    uv run pollmph backfill --days-back 7 --llm gemini
    ```

## 📄 License
MIT
