#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KRILLION_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
export PATH="/root/.local/bin:/usr/local/bin:/usr/bin:/bin:${PATH}"

echo "=========================================="
echo "🌊 Krillion PH Daily Dive Generator Cron"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=========================================="

cd "${KRILLION_DIR}"

# 1. Fetch next day metadata
INFO_JSON=$(npx tsx scripts/get-next-dive-info.ts)
NEXT_DAY=$(echo "${INFO_JSON}" | jq -r '.nextDayNumber')
NEXT_DATE=$(echo "${INFO_JSON}" | jq -r '.nextDate')
RECENT_PROMPTS=$(echo "${INFO_JSON}" | jq -r '.recentPromptTexts | join("; ")')

echo "Next Day Number: ${NEXT_DAY}"
echo "Next Date: ${NEXT_DATE}"

PROMPT="Generate Day #${NEXT_DAY} (date: \"${NEXT_DATE}\") of Krillion PH trivia.
Krillion is a daily 7-prompt reverse-rarity trivia game themed around diving into the Philippine Trench (Emden Deep).
Requirements:
1. Exactly 7 prompts (numbered 1 to 7 with IDs \"day${NEXT_DAY}-p1\" through \"day${NEXT_DAY}-p7\").
2. 50/50 balance: 3 or 4 prompts MUST be Filipino everyday/pop-culture context (category: 'filipino'), and the remaining 3 or 4 prompts MUST be Universal categories calibrated for how Filipinos think and answer (category: 'universal').
3. Avoid duplicating recent prompts: ${RECENT_PROMPTS}.
4. For EACH of the 7 prompts, provide at least 25-35 valid answers spread across all 6 rarity tiers:
   - plankton (10 pts): The 4-8 most obvious answers everyone blurts out immediately.
   - tooclever (15 pts): 2-4 textbook 'obscure' picks that people think are deep cuts but everyone reaches for. Include a humorous quip!
   - schooler (30 pts): 8-12 solid, common answers that swim with the school.
   - rare (60 pts): 6-10 genuinely uncommon pulls.
   - deepcut (85 pts): 4-8 deep trench memory or niche valid answers.
   - krillion (100 pts): 1-3 designated 'One in a Krillion' gems with a witty, culturally resonant quip!
5. Provide aliases (alternate spellings, Tagalog & English translations) where applicable.

Output ONLY valid JSON matching the schema."

OUTPUT_RAW="${SCRIPT_DIR}/generated_day_${NEXT_DAY}_raw.json"
OUTPUT_FILE="${SCRIPT_DIR}/generated_day_${NEXT_DAY}.json"

echo "🤖 Launching headless agy CLI with gemini-3.8-flash-low..."
agy -p "${PROMPT}" \
  --output-format json \
  --json-schema "${SCRIPT_DIR}/schema-daily.json" \
  --dangerously-skip-permissions \
  --disable-slash-commands \
  --model gemini-3.8-flash-low \
  > "${OUTPUT_RAW}"

echo "📝 Processing and validating generated JSON..."
if [ ! -s "${OUTPUT_RAW}" ]; then
  echo "❌ Error: Output file is empty!"
  exit 1
fi

# Extract structured_output from agy json response
if jq -e '.structured_output' "${OUTPUT_RAW}" >/dev/null 2>&1; then
  jq '.structured_output' "${OUTPUT_RAW}" > "${OUTPUT_FILE}"
elif jq -e '.prompts' "${OUTPUT_RAW}" >/dev/null 2>&1; then
  jq . "${OUTPUT_RAW}" > "${OUTPUT_FILE}"
else
  echo "❌ Error: Could not extract structured_output from agy output!"
  cat "${OUTPUT_RAW}" | head -n 20
  exit 1
fi

PROMPT_COUNT=$(jq '.prompts | length' "${OUTPUT_FILE}")
echo "Generated ${PROMPT_COUNT} prompts for Day #${NEXT_DAY}."

# 2. Insert into Neon Postgres
echo "🚀 Uploading Day #${NEXT_DAY} to Neon Postgres..."
npx tsx scripts/insert-daily.ts "${OUTPUT_FILE}"

echo "✅ Done! Day #${NEXT_DAY} successfully created and active in Neon."
