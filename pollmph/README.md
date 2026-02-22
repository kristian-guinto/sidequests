# pollmph: AI-Powered Sentiment Oracle

pollmph is an automated sentiment analysis engine designed to track Philippine socio-political discourse. It acts as a "Predictive Market Oracle" by validating specific propositions against real-time web and social media data.

## 🚀 Concept

The core idea is to obtain objective, quantitative metrics for subjective political narratives. Instead of relying on traditional polling which is slow and expensive, pollmph uses Large Language Models (LLMs) with web access to perform instant, daily analysis.

### How It Works

1.  **Proposition Validation**: The system tracks specific claims or future events (e.g., *"Sara Duterte will win the 2028 election"*).
2.  **LLM Analysis**: A daily pipeline triggers an LLM (Grok/xAI) to perform deep web searches on the topic.
3.  **Scoring**: The model evaluates the gathered data on two strictly defined metrics:
    *   **Consensus (0.00 - 1.00)**: Does the public agree with the proposition?
    *   **Attention (0.00 - 1.00)**: How loudly is the public talking about it?
4.  **Visualization**: Results are stored and visualized in an interactive dashboard to show trends over time.

## 🛠 Tech Stack & Architecture

This project is designed to be **serverless and effectively cost-free** by leveraging the free tiers of modern infrastructure providers.

*   **LLM Intelligence**: [Grok-beta (xAI)](https://x.ai/api) for high-speed reasoning and real-time web search capabilities.
*   **Database**: [Supabase](https://supabase.com) (PostgreSQL) for storing propositions and sentiment history.
*   **Frontend**: React + Vite + Tailwind CSS, hosted on [Vercel](https://vercel.com).
*   **Automation**: [GitHub Actions](https://github.com/features/actions) runs the Python analysis pipeline daily at 11:59 PM PHT.
*   **Package Management**: `uv` for extremely fast Python dependency management.

## 🧠 System Prompt

Transparency is key. The [System Prompt](pipeline/system_prompt.txt) used to strictly instruct the AI enables it to act as an objective market oracle rather than a chatbot. It enforces strict JSON output and specific scoring rubrics to ensure consistency across days.

## 📦 Project Structure

*   `frontend/`: The React application dashboard.
*   `pipeline/`: Python scripts for backfilling data and running daily analysis.
*   `supabase/`: Database migrations and configuration.
*   `.github/workflows/`: Automated cron jobs for daily updates.

## 🏃‍♂️ Getting Started

### Prerequisites
*   Node.js 20+
*   Python 3.13+
*   Reference to a Supabase project
*   xAI API Key

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
    cp .env.example .env # Add your VITE_SUPABASE keys
    npm run dev
    ```
3.  **Setup Pipeline**
    ```bash
    # using uv (recommended)
    uv sync
    
    # Set up environment variables
    # Create a .env file in root with:
    # SUPABASE_URL=...
    # SUPABASE_KEY=...
    # XAI_API_KEY=...
    
    # Run a backfill
    uv run pipeline/main.py --backfill-start 2024-01-01 --backfill-end 2024-01-31
    ```

## 📄 License
MIT
