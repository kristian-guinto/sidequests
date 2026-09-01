# OpenNEM-SEA Development Guidelines & Invariants

## 1. Electricity Market Ingestion & Fuel Classification
* **No Blanket Peaker Fallback**: Power market generators (IEMOP, EMC, Single Buyer) must be categorized strictly according to official registered plant technology. Distillate/Oil must be reserved for true peaking diesel plants and power barges (~1-2% grid share).
* **Fuel Ordering Convention**: Stacked area charts must follow canonical OpenElectricity stacking:
  $$\text{Coal} \rightarrow \text{Distillate} \rightarrow \text{Gas} \rightarrow \text{Biomass} \rightarrow \text{Geothermal} \rightarrow \text{Battery} \rightarrow \text{Hydro} \rightarrow \text{Wind} \rightarrow \text{Solar}$$

## 2. Database Queries & Timezone Invariance
* **Local Timestamp Format**: All 5-minute dispatch rows store ISO 8601 strings with local timezone offset (e.g. `YYYY-MM-DDTHH:mm:ss+08:00`).
* **Timezone Continuity in SQL**: When generating SQL cutoff strings for range queries (`1d`, `3d`, `7d`, `30d`), never use `new Date().toISOString()`. Always use proper datetime formatting with timezone offset to preserve local timezone string comparability in DuckDB and MotherDuck.

## 3. High-Density Charting & Axis Alignment
* **Clock-Locked Ticks**: In 1D view (288 points), tick intervals must lock strictly to round 3-hour boundaries (`00:00`, `03:00`, `06:00`, `09:00`, `12:00`, `15:00`, `18:00`, `21:00`).
* **Grid Containment**: All vertically stacked charts must specify `containLabel: true`, `left: 55`, `right: 20`, and `bottom: 26` to guarantee zero text clipping and vertical gridline synchronization.
* **Chart Views**: Support both absolute capacity (MW / GWh) and normalized 100% Stacked share (`0% – 100%`).
* **Solid Area Contrast**: Stacked area charts must use solid 0.98 opacity with 0.3px boundary separators to preserve distinct fuel colors and contrast.

