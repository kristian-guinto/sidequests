---
name: blog-authoring
description: >-
  Co-pilot workflow and standard runbook for authoring interactive, data-backed
  blog articles on OpenElectricity. Enables AI-assisted chart generation from
  DuckDB / API telemetry and author-dominated editorial writing.
---

# OpenElectricity Blog Authoring & AI Co-Pilot Skill

This skill defines the standardized protocol for creating and publishing interactive articles for the **OpenElectricity Insights** blog.

The system is built on two core principles:
1. **Author-Dominated Prose**: The author's personal voice, engineering intuition, and authentic takeaways guide the article. The AI acts as an editorial assistant, structurer, and fact-checker—never a generic ghostwriter.
2. **AI-Assisted Chart Generation**: The AI queries the database (`open_nem_ph.duckdb` or the API `/api/energy`), discovers peak events/anomalies, and generates ready-to-embed interactive React/ECharts components.

---

## The 4-Phase Co-Pilot Protocol

### Phase 1: Data Discovery & Chart Generation
When the author wants to document an anomaly or topic:
1. **Query Telemetry**:
   Run `python3 scripts/query_blog_data.py --country <CODE> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>` to inspect:
   - Peak generation per fuel technology (MW).
   - Fuel share percentages (%).
   - Spot price extremes (minimums, ceilings, negative prices).
2. **Generate the MDX Chart Component**:
   Depending on the story, output the appropriate component:
   - **Time-Series Telemetry**:
     ```tsx
     <BlogEnergyChart
       country="PH"
       startDate="2026-07-01"
       endDate="2026-07-07"
       range="7d"
       type="both" // "generation" | "price" | "both"
       viewMode="stacked" // "stacked" | "percentage"
       paletteMode="clean-fossil" // "clean-fossil" | "detailed"
       title="Philippines Dispatch & Spot Price: 1–7 July 2026"
       caption="Toggle between Generation and Price tabs to observe midday solar suppression."
     />
     ```
   - **Immutable Snapshot** (for historical data):
     Run `python3 scripts/query_blog_data.py --country PH --start-date ... --end-date ... --export-snapshot src/content/blog/data/post-slug.json` and embed:
     ```tsx
     import snapshot from "./data/post-slug.json";
     <BlogEnergyChart snapshotData={snapshot} title="..." />
     ```

---

### Phase 2: Author Voice Elicitation
Before drafting prose, ask the author 2 to 3 concise, high-signal questions:
1. *What initially prompted you to investigate this event or timeframe?*
2. *What surprised you in the data compared to standard assumptions?*
3. *What is your primary takeaway for power system engineers or market participants?*

The author may reply with rough notes, fragmented bullets, or a quick stream of consciousness.

---

### Phase 3: AI Editorial Polish & Fact Check
Synthesize the author's notes into an engaging, authoritative MDX post in `src/content/blog/<slug>.mdx`:

1. **Preserve Authentic Voice**: Keep the author's first-person perspective, technical terminology, and distinct tone. Remove corporate fluff or generic filler phrases.
2. **Fact-Check Against Telemetry**: Cross-check every number mentioned in the prose (e.g. `3,170 MW peak solar`, `-₱10,611 price floor`) against the query output from Phase 1.
3. **Use Visual Callouts**:
   - `<StatCallout value="..." label="..." trend="up|down|neutral" change="..." variant="emerald|amber|rose|blue" />`
   - `<DataCallout type="insight|warning|methodology|takeaway" title="...">...</DataCallout>`
   - `<GridBadge country="PH" region="LUZON" />`
4. **Frontmatter Configuration**:
   ```yaml
   ---
   title: "Descriptive, Compelling Technical Title"
   slug: "url-friendly-slug"
   date: "YYYY-MM-DD"
   description: "1-2 sentence compelling summary for search and feed cards."
   country: "PH" # PH, SG, MY, TH, VN, ID
   author:
     name: "Ian"
     role: "Lead Systems Architect & Grid Researcher"
   tags: ["Philippines", "Solar", "WESM", "Grid Stability"]
   featured: false
   published: true
   ---
   ```

---

### Phase 4: Verification & Publishing

1. **Local Build & Test**:
   ```bash
   npm run build
   ```
   Ensure static generation passes for all blog routes (`/blog` and `/blog/[slug]`).
2. **Interactive Verification**:
   - Run `npm run dev` and open `http://localhost:3000/blog/<slug>`.
   - Verify:
     - Tooltips show correct timestamp wall-clock times.
     - Dark mode and light mode contrast.
     - Controls (MW vs %, Clean vs Detailed) toggle smoothly.
3. **Commit & Publish**:
   ```bash
   git add src/content/blog/<slug>.mdx
   git commit -m "feat(blog): add post on <topic>"
   ```

