# Opportunity Radar

A lightweight, distraction-free mobile web dashboard for tracking, vetting, and discovering **hardware-software arbitrage** opportunities.

## Features
- **Mobile-First Design:** Clean, responsive interface optimized for reviewing opportunities on mobile and desktop.
- **Fast & Zero Dependencies:** Uses Python standard library (`http.server`), starts instantly, consumes <15MB RAM.
- **Scored Opportunity Cards:** Landed BOM vs. Retail price, margin calculations, customer outrage quotes, OEM hardware references, and candid flaws.
- **Notes & Field Logs:** Log observations, testing results, or sample updates directly on each opportunity card.
- **Quick-Add Feature:** Log new ideas or notes while on the go.
- **Core Philosophy Embedded:** Quick-reference card for material honesty and inverted discovery rules.

## Operations
- **Start:** `./start.sh`
- **Stop:** `pkill -f "python3.*opportunity-radar/server.py"`
