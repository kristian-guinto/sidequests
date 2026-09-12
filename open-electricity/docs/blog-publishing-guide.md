# OpenElectricity Blog Publishing Runbook

This guide details the complete process for creating, writing, verifying, and publishing an interactive blog post on OpenElectricity.

---

## The Co-Pilot Philosophy

1. **Your Words, Front and Center**: The blog is meant to reflect your genuine observations and technical takeaways from building the platform and exploring grid telemetry. AI helps with formatting, structuring, and fact-checking, but your voice drives the content.
2. **AI-Assisted Chart Generation**: Instead of manually munging CSVs or writing complex chart options, the AI assistant extracts telemetry directly from DuckDB/API and generates plug-and-play MDX chart components.

---

## 6-Step Publishing Workflow

```
[1. Spot Finding] ➔ [2. Extract Data & Chart] ➔ [3. Jot Notes] ➔ [4. AI Polish] ➔ [5. Preview] ➔ [6. Publish]
```

### Step 1: Spot an Interesting Finding
While observing live data on OpenElectricity or querying DuckDB, identify a compelling event:
- A steep solar ramp causing negative prices.
- A sudden generator outage triggering a spot price spike.
- A comparison of fuel shares between seasons (monsoon vs. dry).
- A data engineering nuance in wholesale market telemetry.

---

### Step 2: Extract Telemetry & Generate Charts with AI

You can ask the AI agent:
> *"Query the Philippines database for the first week of July 2026. Show me peak solar generation, coal baseline, and price spikes, and generate an interactive chart component for a blog post."*

Or run the CLI assistant directly:
```bash
python3 scripts/query_blog_data.py --country PH --start-date 2026-07-01 --end-date 2026-07-07
```

Output:
```
Fuel Technology  | Total MWh    | Share (%)  | Avg MW     | Peak MW   
--------------------------------------------------------------------
coal             | 2,413,808.4  | 47.0     % | 3,592.0    | 8,103.1   
solar            | 357,627.5    | 7.0      % | 532.2      | 3,171.7   
...
Spot Price Dynamics:
Average Price: ₱9,901.40 | Min: -₱10,611.39 | Max: ₱102,619.93
```

The AI generates the `<BlogEnergyChart />` snippet:
```tsx
<BlogEnergyChart
  country="PH"
  startDate="2026-07-01"
  endDate="2026-07-07"
  range="7d"
  type="both"
  viewMode="stacked"
  paletteMode="clean-fossil"
  title="Philippines Dispatch & Spot Price: 1–7 July 2026"
  caption="Toggle between Generation and Price to see midday price suppression."
/>
```

---

### Step 3: Jot Down Your Authentic Thoughts & Findings

Write 3–5 bullet points in your own words. For example:
- *"I noticed negative prices (-₱10,611) whenever solar peaked above 3,100 MW at noon."*
- *"The real issue is the evening ramp from 5:30 to 7:30 PM when 3 GW of solar drops just as demand rises."*
- *"Because peakers have to ramp up fast, spot prices hit ₱102,600/MWh."*
- *"Geothermal is steady at 350 MW, but we clearly need battery storage to arbitrage this spread."*

---

### Step 4: AI Co-Pilot Editorial Polish & Fact Check

Ask the AI to synthesize your notes into a draft:
> *"Draft the blog post in `src/content/blog/my-post-slug.mdx` using my bullet points and the chart above. Keep my voice, add appropriate callouts, and ensure the numbers match the query."*

The AI generates the `.mdx` file with:
- Frontmatter metadata (`title`, `description`, `country`, `author`, `tags`, `readingTime`, `published: true`).
- Formatted sections with `<StatCallout />` and `<DataCallout />`.
- Embedded interactive charts.

---

### Step 5: Local Preview & Verification

Start the Next.js development server:
```bash
npm run dev
```
Open `http://localhost:3000/blog` to see the post in the index grid, and click into `http://localhost:3000/blog/my-post-slug`.

**Verification Checklist**:
- [ ] Responsive on both desktop and mobile viewports.
- [ ] Light and dark mode colors look crisp.
- [ ] Hover tooltips on charts display exact MW and prices.
- [ ] Mode toggles (MW vs %, Clean vs Detailed) work smoothly.

---

### Step 6: Commit & Publish

Once satisfied:
```bash
git add src/content/blog/my-post-slug.mdx
git commit -m "feat(blog): publish post on <title>"
git push
```

The Next.js build pipeline statically renders your new article automatically.

