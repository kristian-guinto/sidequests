#!/usr/bin/env python3
import http.server
import json
import os
import urllib.parse
from datetime import datetime

PORT = 3000
HOST = "127.0.0.1"
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "opportunities.json")

def load_opportunities():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_opportunities(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Opportunity Radar | Hardware-Software Arbitrage</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #121316;
      --card-bg: #1A1C21;
      --card-border: #282B33;
      --card-hover: #22252C;
      --text: #F3F4F6;
      --text-muted: #9CA3AF;
      --text-sub: #6B7280;
      --accent: #E0A96D;
      --accent-muted: rgba(224, 169, 109, 0.15);
      --green: #10B981;
      --green-bg: rgba(16, 185, 129, 0.12);
      --red: #F87171;
      --red-bg: rgba(248, 113, 113, 0.12);
      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-serif: 'Newsreader', Georgia, serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 1.25rem 1rem 4rem 1rem;
      max-width: 760px;
      margin: 0 auto;
    }

    header {
      padding-bottom: 1.5rem;
      margin-bottom: 1.75rem;
      border-bottom: 1px solid var(--card-border);
    }

    .badge-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      background: var(--green-bg);
      color: var(--green);
    }

    .status-badge::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--green);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    h1 {
      font-family: var(--font-serif);
      font-size: 2rem;
      font-weight: 500;
      letter-spacing: -0.02em;
      color: #FFF;
      margin-bottom: 0.35rem;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    /* Filters & Controls */
    .controls {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
      scrollbar-width: none;
    }
    .controls::-webkit-scrollbar { display: none; }

    .filter-btn {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 0.4rem 0.85rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .filter-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #121316;
      font-weight: 600;
    }

    /* Card List */
    .card-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 1.25rem;
      transition: border-color 0.2s ease, transform 0.15s ease;
    }

    .card:hover {
      border-color: rgba(224, 169, 109, 0.4);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }

    .card-category {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--accent);
    }

    .score-badge {
      background: var(--accent-muted);
      color: var(--accent);
      border: 1px solid rgba(224, 169, 109, 0.3);
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .card-title {
      font-family: var(--font-serif);
      font-size: 1.35rem;
      font-weight: 500;
      color: #FFF;
      line-height: 1.3;
      margin-bottom: 0.2rem;
    }

    .card-sub {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    /* Economics Box */
    .econ-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 8px;
      padding: 0.65rem 0.75rem;
      margin-bottom: 1rem;
    }

    .econ-item {
      display: flex;
      flex-direction: column;
    }

    .econ-label {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-sub);
      font-weight: 600;
    }

    .econ-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text);
    }
    .econ-val.margin {
      color: var(--green);
    }

    /* Accordion Details */
    .section-block {
      margin-bottom: 0.85rem;
    }

    .section-title {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .section-body {
      font-size: 0.88rem;
      color: #D1D5DB;
      line-height: 1.5;
    }

    .section-body.flaw {
      color: #FCA5A5;
      background: var(--red-bg);
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      border: 1px solid rgba(248, 113, 113, 0.2);
    }

    .links-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .link-chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      font-size: 0.78rem;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .link-chip:hover {
      background: var(--accent-muted);
      border-color: var(--accent);
      color: var(--accent);
    }

    /* Notes Section */
    .notes-block {
      margin-top: 1.15rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .notes-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .note-item {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
    }

    .note-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
    }

    .note-date {
      font-size: 0.68rem;
      color: var(--text-sub);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .note-del-btn {
      background: none;
      border: none;
      color: var(--text-sub);
      font-size: 1.1rem;
      cursor: pointer;
      padding: 0 0.25rem;
      line-height: 1;
    }
    .note-del-btn:hover { color: var(--red); }

    .note-text {
      font-size: 0.85rem;
      color: #E5E7EB;
      line-height: 1.45;
    }

    .add-note-form {
      display: flex;
      gap: 0.45rem;
      margin-top: 0.65rem;
    }

    .note-input {
      flex: 1;
      background: #121316;
      border: 1px solid var(--card-border);
      color: #FFF;
      padding: 0.5rem 0.7rem;
      border-radius: 7px;
      font-size: 0.84rem;
      font-family: inherit;
    }
    .note-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .note-submit-btn {
      background: var(--accent);
      color: #121316;
      border: none;
      padding: 0.5rem 0.85rem;
      border-radius: 7px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .note-submit-btn:active { transform: scale(0.96); }

    /* Philosophy Card */
    .philosophy-card {
      margin-top: 2.5rem;
      padding: 1.25rem;
      background: rgba(224, 169, 109, 0.04);
      border: 1px solid rgba(224, 169, 109, 0.15);
      border-radius: 14px;
    }
    .philosophy-card h3 {
      font-family: var(--font-serif);
      color: var(--accent);
      font-size: 1.15rem;
      margin-bottom: 0.5rem;
    }
    .philosophy-card p {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* Floating Add Trigger */
    .add-btn {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      background: var(--accent);
      color: #121316;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: none;
      font-size: 1.5rem;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s ease;
    }
    .add-btn:active { transform: scale(0.92); }

    /* Modal */
    .modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      padding: 1rem;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal.open { display: flex; }
    .modal-content {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      max-width: 520px;
      width: 100%;
      padding: 1.5rem;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-content h2 {
      font-family: var(--font-serif);
      font-size: 1.35rem;
      margin-bottom: 1rem;
      color: #FFF;
    }
    .form-group {
      margin-bottom: 0.85rem;
    }
    .form-group label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-sub);
      margin-bottom: 0.25rem;
    }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%;
      background: #121316;
      border: 1px solid var(--card-border);
      color: #FFF;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      font-family: inherit;
      font-size: 0.88rem;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.65rem;
      margin-top: 1.25rem;
    }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    .btn-secondary { background: var(--card-border); color: var(--text); }
    .btn-primary { background: var(--accent); color: #121316; }
  </style>
</head>
<body>

  <header>
    <div class="badge-bar">
      <div class="status-badge">Live</div>
      <span style="font-size: 0.75rem; color: var(--text-sub);">Port 3000</span>
    </div>
    <h1>Opportunity Radar</h1>
    <p class="subtitle">Hardware-Software Arbitrage Discovery & Vetting</p>
  </header>

  <div class="controls">
    <button class="filter-btn active" onclick="filterCards('all', this)">All Opportunities</button>
    <button class="filter-btn" onclick="filterCards('Commute & Focus', this)">Commute & Focus</button>
    <button class="filter-btn" onclick="filterCards('Sleep & Home', this)">Sleep & Home</button>
    <button class="filter-btn" onclick="filterCards('Candidate', this)">Candidates</button>
  </div>

  <main class="card-list" id="cards-container">
    <!-- Populated by JS -->
  </main>

  <div class="philosophy-card">
    <h3>Core Philosophy</h3>
    <p><strong>Hardware sets the pace:</strong> Natural materials (timber, linen, ceramic, paper) and stealth displays must pass the living room test before software is judged. Software is calm, respectful, and meets users where they already live without hostile rent-seeking.</p>
  </div>

  <button class="add-btn" onclick="openModal()" title="Add Opportunity">+</button>

  <!-- Add Opportunity Modal -->
  <div class="modal" id="addModal">
    <div class="modal-content">
      <h2>Log New Opportunity</h2>
      <form id="addForm" onsubmit="submitOpportunity(event)">
        <div class="form-group">
          <label>Product Name</label>
          <input type="text" id="mTitle" required placeholder="e.g. The Anti-Hatch Sunrise Lamp">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="mCategory">
            <option value="Sleep & Home">Sleep & Home</option>
            <option value="Commute & Focus">Commute & Focus</option>
            <option value="Family & Nursery">Family & Nursery</option>
            <option value="Everyday Utility">Everyday Utility</option>
          </select>
        </div>
        <div class="form-group">
          <label>25-Point Score (Est)</label>
          <input type="number" id="mScore" min="1" max="25" value="20">
        </div>
        <div class="form-group">
          <label>Landed BOM vs Retail</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" id="mCost" placeholder="BOM (e.g. $20)">
            <input type="text" id="mRetail" placeholder="Retail (e.g. $119)">
          </div>
        </div>
        <div class="form-group">
          <label>Customer Pain & Emotion</label>
          <textarea id="mPain" rows="2" placeholder="What makes consumers furious about current solutions?"></textarea>
        </div>
        <div class="form-group">
          <label>Aesthetic Hardware Base</label>
          <textarea id="mHw" rows="2" placeholder="What OEM Chinese hardware/materials (wood, linen, e-ink)?"></textarea>
        </div>
        <div class="form-group">
          <label>Identified Flaws / Risks</label>
          <textarea id="mFlaws" rows="2" placeholder="What could kill this idea?"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save to Radar</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let opportunities = [];

    async function fetchOpportunities() {
      try {
        const res = await fetch('/api/opportunities');
        opportunities = await res.json();
        renderCards(opportunities);
      } catch (e) {
        console.error('Fetch error:', e);
      }
    }

    function renderCards(items) {
      const container = document.getElementById('cards-container');
      container.innerHTML = '';

      if (!items || items.length === 0) {
        container.innerHTML = '<p style="color: var(--text-sub); text-align: center; padding: 2rem;">No opportunities logged yet.</p>';
        return;
      }

      items.forEach(item => {
        const notes = item.notes || [];
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
          <div class="card-top">
            <span class="card-category">${item.category || 'General'}</span>
            <span class="score-badge">${item.score || 0}/25</span>
          </div>
          <h2 class="card-title">${item.title}</h2>
          <div class="card-sub">${item.subtitle || ''}</div>

          <div class="econ-bar">
            <div class="econ-item">
              <span class="econ-label">Landed BOM</span>
              <span class="econ-val">${item.landed_cost || '--'}</span>
            </div>
            <div class="econ-item">
              <span class="econ-label">Target Retail</span>
              <span class="econ-val">${item.retail_price || '--'}</span>
            </div>
            <div class="econ-item">
              <span class="econ-label">Gross Margin</span>
              <span class="econ-val margin">${item.margin || '--'}</span>
            </div>
          </div>

          <div class="section-block">
            <div class="section-title">⚡ Customer Outrage & Pain</div>
            <div class="section-body">${item.customer_pain || ''}</div>
          </div>

          <div class="section-block">
            <div class="section-title">🪵 Material & Hardware Base</div>
            <div class="section-body">${item.hardware_base || ''}</div>
          </div>

          <div class="section-block">
            <div class="section-title">✨ Software Transformation</div>
            <div class="section-body">${item.software_transformation || ''}</div>
          </div>

          <div class="section-block">
            <div class="section-title">⚠️ Identified Flaws & Gotchas</div>
            <div class="section-body flaw">${item.identified_flaws || 'None recorded'}</div>
          </div>

          <div class="section-block notes-block">
            <div class="section-title">💬 Notes & Field Logs (${notes.length})</div>
            <div class="notes-list" id="notes-list-${item.id}">
              ${notes.length > 0 ? notes.map(n => `
                <div class="note-item" id="note-box-${n.id}">
                  <div class="note-header">
                    <span class="note-date">${n.created_at || ''}</span>
                    <button type="button" class="note-del-btn" onclick="deleteNote('${item.id}', '${n.id}')" title="Delete note">&times;</button>
                  </div>
                  <div class="note-text">${n.text}</div>
                </div>
              `).join('') : '<div style="font-size: 0.8rem; color: var(--text-sub); font-style: italic;">No notes yet. Add thoughts or sample test findings below.</div>'}
            </div>
            <form class="add-note-form" onsubmit="submitNote(event, '${item.id}')">
              <input type="text" class="note-input" id="note-input-${item.id}" placeholder="Write a note or observation..." required autocomplete="off">
              <button type="submit" class="note-submit-btn">Post Note</button>
            </form>
          </div>

          ${item.links && item.links.length ? `
            <div class="links-row">
              ${item.links.map(l => `<a class="link-chip" href="${l.url}" target="_blank" rel="noopener">${l.label} ↗</a>`).join('')}
            </div>
          ` : ''}
        `;
        container.appendChild(card);
      });
    }

    function filterCards(filter, btn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (filter === 'all') {
        renderCards(opportunities);
      } else {
        const filtered = opportunities.filter(o => o.category === filter || o.status === filter);
        renderCards(filtered);
      }
    }

    function openModal() { document.getElementById('addModal').classList.add('open'); }
    function closeModal() { document.getElementById('addModal').classList.remove('open'); }

    async function submitOpportunity(e) {
      e.preventDefault();
      const payload = {
        title: document.getElementById('mTitle').value,
        category: document.getElementById('mCategory').value,
        score: parseInt(document.getElementById('mScore').value) || 20,
        landed_cost: document.getElementById('mCost').value || '--',
        retail_price: document.getElementById('mRetail').value || '--',
        margin: '~50%',
        customer_pain: document.getElementById('mPain').value,
        hardware_base: document.getElementById('mHw').value,
        software_transformation: 'Clean, respectful firmware.',
        identified_flaws: document.getElementById('mFlaws').value,
        status: 'Candidate',
        notes: [],
        links: []
      };

      try {
        const res = await fetch('/api/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          closeModal();
          document.getElementById('addForm').reset();
          fetchOpportunities();
        }
      } catch (err) {
        alert('Failed to save opportunity');
      }
    }

    async function submitNote(e, oppId) {
      e.preventDefault();
      const input = document.getElementById(`note-input-${oppId}`);
      const text = input.value.trim();
      if (!text) return;

      try {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opportunity_id: oppId, text: text })
        });
        if (res.ok) {
          input.value = '';
          fetchOpportunities();
        }
      } catch (err) {
        alert('Failed to save note');
      }
    }

    async function deleteNote(oppId, noteId) {
      if (!confirm('Delete this note?')) return;
      try {
        const res = await fetch('/api/notes/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opportunity_id: oppId, note_id: noteId })
        });
        if (res.ok) {
          fetchOpportunities();
        }
      } catch (err) {
        alert('Failed to delete note');
      }
    }

    fetchOpportunities();
  </script>
</body>
</html>
"""

class RequestHandler(http.server.BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/" or parsed.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
        elif parsed.path == "/api/opportunities":
            data = load_opportunities()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/opportunities":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                new_item = json.loads(body)
                new_item["id"] = new_item.get("title", "opp").lower().replace(" ", "-") + "-" + str(int(datetime.now().timestamp()))
                new_item["created_at"] = datetime.now().strftime("%Y-%m-%d")
                if "notes" not in new_item:
                    new_item["notes"] = []
                
                data = load_opportunities()
                data.insert(0, new_item)
                save_opportunities(data)

                self.send_response(201)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "created", "item": new_item}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

        elif parsed.path == "/api/notes":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                payload = json.loads(body)
                opp_id = payload.get("opportunity_id")
                text = payload.get("text", "").strip()

                if opp_id and text:
                    data = load_opportunities()
                    found = False
                    for item in data:
                        if item.get("id") == opp_id:
                            if "notes" not in item or not isinstance(item["notes"], list):
                                item["notes"] = []
                            item["notes"].append({
                                "id": f"note-{int(datetime.now().timestamp())}",
                                "text": text,
                                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M")
                            })
                            found = True
                            break
                    if found:
                        save_opportunities(data)
                        self.send_response(201)
                        self.send_header("Content-Type", "application/json; charset=utf-8")
                        self.end_headers()
                        self.wfile.write(json.dumps({"status": "created"}).encode("utf-8"))
                    else:
                        self.send_response(404)
                        self.end_headers()
                else:
                    self.send_response(400)
                    self.end_headers()
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

        elif parsed.path == "/api/notes/delete":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                payload = json.loads(body)
                opp_id = payload.get("opportunity_id")
                note_id = payload.get("note_id")

                if opp_id and note_id:
                    data = load_opportunities()
                    for item in data:
                        if item.get("id") == opp_id and "notes" in item:
                            item["notes"] = [n for n in item["notes"] if n.get("id") != note_id]
                            break
                    save_opportunities(data)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "deleted"}).encode("utf-8"))
                else:
                    self.send_response(400)
                    self.end_headers()
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Keep logs clean
        pass

if __name__ == "__main__":
    print(f"Starting Opportunity Radar on {HOST}:{PORT}...")
    server = http.server.ThreadingHTTPServer((HOST, PORT), RequestHandler)
    server.serve_forever()
