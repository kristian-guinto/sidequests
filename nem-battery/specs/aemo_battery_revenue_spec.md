# AEMO Battery Revenue Calculation — Implementation Spec

> **Purpose:** This document describes the correct methodology for computing daily battery revenue from AEMO public data. Use it to verify whether the implementation in the codebase matches the expected approach.

---

## 1. Data Sources

All three files are **next-day public** — unit-level data is confidential on the day and becomes publicly available after close of business the previous day (i.e. data for day T is available from ~04:00 on day T+1).

| File | Source table | What it contains | Key columns |
|---|---|---|---|
| `DISPATCHLOAD` | MMS / NEMweb Next Day Dispatch | 5-min dispatch targets and FCAS enablement per DUID | `SETTLEMENTDATE`, `DUID`, `TOTALCLEARED`, `INITIALMW`, `RAISE6SEC`, `RAISE60SEC`, `RAISE5MIN`, `RAISEREG`, `LOWER6SEC`, `LOWER60SEC`, `LOWER5MIN`, `LOWERREG`, `*FLAGS` columns |
| `DISPATCHPRICE` | MMS / NEMweb Next Day Dispatch | 5-min energy RRP and 8 FCAS prices per region | `SETTLEMENTDATE`, `REGIONID`, `RRP`, `RAISE6SECRRP`, `RAISE60SECRRP`, `RAISE5MINRRP`, `RAISEREGRRP`, `LOWER6SECRRP`, `LOWER60SECRRP`, `LOWER5MINRRP`, `LOWERREGRRP` |
| `DISPATCH_UNIT_SCADA` | MMS / NEMweb Next Day Dispatch | Actual metered output per DUID | `SETTLEMENTDATE`, `DUID`, `SCADAVALUE` |

### Which MW column to use for settlement

- **`TOTALCLEARED`** (from `DISPATCHLOAD`) — the dispatch instruction; this is what financial settlement is based on. Use this for revenue calculations that aim to replicate the settlement outcome.
- **`SCADAVALUE`** (from `DISPATCH_UNIT_SCADA`) — the actual telemetered/metered MW. Use this if the goal is to measure actual physical output rather than the settled quantity. These can differ due to ramp rate constraints and AGC.

### Do not use TRADINGLOAD

Since Five-Minute Settlement (5MS) commenced on **1 October 2021**, settlement aligns with 5-minute dispatch intervals. `TRADINGLOAD` (30-minute trading intervals) is no longer relevant for revenue calculations.

---

## 2. Interval Structure

- Each trading day has **288 dispatch intervals** (5 minutes each, 24 hours × 12).
- `SETTLEMENTDATE` in `DISPATCHLOAD` represents the **end** of each 5-minute interval.
- The trading day starts at **04:05** and ends at **04:00** the following calendar day.
- To convert MW to MWh for a 5-minute interval: multiply by `1/12`.

---

## 3. Energy Revenue Calculation

### Battery DUID registration

Batteries may be registered in one of two configurations:

- **Pre-IESS (dual DUID):** Separate generator DUID (discharging) and load DUID (charging). Revenue must be computed for both and netted.
- **Post-IESS (single DUID):** A single IRP DUID covers both charging and discharging. `TOTALCLEARED` is positive when generating, negative when consuming.

### Formula (per 5-minute interval)

```
Energy_Revenue_interval =
    TOTALCLEARED_MW × (1/12) × RRP × MLF
```

Where:
- `TOTALCLEARED_MW` — from `DISPATCHLOAD` for the battery's generator DUID (positive = generating)
- `RRP` — from `DISPATCHPRICE`, matched on `SETTLEMENTDATE` and `REGIONID`
- `MLF` — Marginal Loss Factor for the connection point (applied at settlement; sourced separately from AEMO's annual MLF publication)

For **dual-DUID batteries**, the net energy revenue per interval is:

```
Net_Energy_Revenue_interval =
    (Generator_TOTALCLEARED × (1/12) × RRP × MLF_gen)
  - (Load_TOTALCLEARED    × (1/12) × RRP × MLF_load)
```

### Daily total

```
Daily_Energy_Revenue = SUM over all 288 intervals of Energy_Revenue_interval
```

---

## 4. FCAS Revenue Calculation

### The 8 FCAS markets

| Service | `DISPATCHLOAD` column | `DISPATCHPRICE` column |
|---|---|---|
| Raise Regulation | `RAISEREG` | `RAISEREGRRP` |
| Lower Regulation | `LOWERREG` | `LOWERREGRRP` |
| Raise Very Fast (R1) | *(post-Nov 2023 only)* | `RAISE1SECRRP` |
| Raise Fast (R6) | `RAISE6SEC` | `RAISE6SECRRP` |
| Raise Slow (R60) | `RAISE60SEC` | `RAISE60SECRRP` |
| Raise Delayed (R5) | `RAISE5MIN` | `RAISE5MINRRP` |
| Lower Very Fast (L1) | *(post-Nov 2023 only)* | `LOWER1SECRRP` |
| Lower Fast (L6) | `LOWER6SEC` | `LOWER6SECRRP` |
| Lower Slow (L60) | `LOWER60SEC` | `LOWER60SECRRP` |
| Lower Delayed (L5) | `LOWER5MIN` | `LOWER5MINRRP` |

> **Note:** The 1-second contingency FCAS markets (R1/L1) were introduced in November 2023. Check whether the codebase handles these services and from what date they are included.

### Formula (per service, per 5-minute interval)

```
FCAS_Revenue_interval =
    Enabled_MW × FCAS_Price ($/MW/hr) × (1/12)
```

Where:
- `Enabled_MW` — the relevant FCAS column from `DISPATCHLOAD` (e.g. `RAISE6SEC`)
- `FCAS_Price` — the corresponding price from `DISPATCHPRICE` (e.g. `RAISE6SECRRP`), in $/MW/hr

### Enablement flags

Each FCAS service has a corresponding `*FLAGS` column (e.g. `RAISE6SECFLAGS`) that indicates whether the unit was:

| Flag value | Meaning |
|---|---|
| `1` | Enabled (available, contributing to revenue) |
| `3` | Trapped (enabled but causing energy market constraint) |
| `4` | Stranded (outside FCAS trapezium, not enabled) |
| `0` | Not enabled |

**Check:** Does the codebase filter on `FLAGS = 1` (or odd values, i.e. `FLAGS % 2 == 1`) before applying FCAS revenue? Stranded units (`FLAGS = 4`) should contribute zero FCAS revenue.

### Daily total

```
Daily_FCAS_Revenue = SUM over all 8 services × all 288 intervals of FCAS_Revenue_interval
```

---

## 5. Total Daily Revenue

```
Daily_Total_Revenue = Daily_Energy_Revenue + Daily_FCAS_Revenue
```

---

## 6. Key Checks for the Codebase

Use this checklist when reviewing the implementation:

- [ ] **Data source:** Is the code reading from `DISPATCHLOAD`, `DISPATCHPRICE`, and optionally `DISPATCH_UNIT_SCADA`? Not from `TRADINGLOAD`.
- [ ] **Lag awareness:** Does the code account for the fact that unit-level data is only available from T+1? Is there a risk of accidentally using incomplete intraday data for day T?
- [ ] **5MS alignment:** Does the code operate at the 5-minute interval level (288 intervals/day)? Or is it incorrectly aggregating to 30-minute trading intervals?
- [ ] **MW to MWh conversion:** Is there a `× (1/12)` applied to convert MW dispatch targets to MWh per interval?
- [ ] **FCAS price units:** FCAS prices from `DISPATCHPRICE` are in **$/MW/hr**. Is the conversion to per-interval revenue applied correctly (i.e. `× 1/12`)?
- [ ] **DUID registration:** Does the code handle both dual-DUID (pre-IESS) and single-DUID (post-IESS) batteries? When is the cutover date applied?
- [ ] **MLF application:** Are Marginal Loss Factors applied? From which source? Are they the correct annual MLFs for the relevant financial year?
- [ ] **FCAS flag filtering:** Are FCAS enablement flags (`*FLAGS` columns) checked before computing FCAS revenue? Units with `FLAGS = 4` (stranded) should not earn FCAS revenue.
- [ ] **1-second FCAS markets:** Are R1/L1 markets included? Are they only applied from their introduction date (November 2023)?
- [ ] **Join key:** Is `DISPATCHLOAD` joined to `DISPATCHPRICE` on both `SETTLEMENTDATE` **and** `REGIONID`? Joining on `SETTLEMENTDATE` alone will produce incorrect results in multi-region queries.
- [ ] **Settlement vs. metered:** Is the code using `TOTALCLEARED` (settlement basis) or `SCADAVALUE` (metered)? Is this consistent with the intended purpose?
- [ ] **Caveats not modelled:** The following are typically not captured in this bottom-up approach and may explain discrepancies with actual settlement invoices: causer-pays FCAS adjustments, uplift payments, and detailed metering reconciliation.

---

## 7. Formula Reference Summary

```
# Per 5-minute interval (i):

Energy_Revenue[i]  = TOTALCLEARED[i] × (1/12) × RRP[i] × MLF

FCAS_Revenue[i]    = SUM over services s of:
                       FCAS_Enabled_MW[i,s] × FCAS_Price[i,s] × (1/12)
                       (only where FLAGS[i,s] is odd, i.e. unit is enabled)

Total_Revenue[i]   = Energy_Revenue[i] + FCAS_Revenue[i]

# Daily:

Daily_Revenue = SUM over i=1..288 of Total_Revenue[i]
```
