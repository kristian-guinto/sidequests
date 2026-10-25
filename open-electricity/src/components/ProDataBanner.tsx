"use client";

import React, { useState } from "react";
import { CountryCode, SummaryMetrics, ProProductItem } from "@/lib/types";
import {
  Database,
  Download,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  Building2,
  ExternalLink,
  X,
  CheckCircle2,
  Sun,
  BatteryCharging,
  Leaf,
  Coins,
  ChevronRight,
  ArrowUpRight,
  Mail,
} from "lucide-react";

interface ProDataBannerProps {
  country: CountryCode;
  summary: SummaryMetrics | null;
  currencySymbol?: string;
  currencyCode?: string;
  isModalOpen?: boolean;
  onCloseModal?: () => void;
  onOpenModal?: () => void;
}

const DEFAULT_PRODUCTS: ProProductItem[] = [
  {
    id: "wesm-nodal-parquet",
    name: "WESM 5-Minute Nodal LMP & Unit Outage Dataset",
    priceUSD: 399,
    cadence: "one-time download + monthly updates",
    description:
      "Generator & Load nodal schedules, nodal LMPs, basis risk vs regional GWAP/LWAP, and curated plant catalog for Luzon, Visayas, and Mindanao.",
    features: [
      "5-minute interval nodal LMPs (2022–present)",
      "Generator dispatch schedules & reserve allocations",
      "Forced & planned unit outage timelines",
      "Nodal basis risk analysis vs regional GWAP/LWAP",
      "Delivered as Apache Parquet & compressed CSV",
    ],
    sampleFiles: ["wesm_nodal_lmp.parquet", "outages_ph.csv"],
    stripePaymentUrl: process.env.NEXT_PUBLIC_STRIPE_NODAL_PACK_URL || null,
    targetAudience: "IPP developers, energy traders, utility planners",
  },
  {
    id: "solar-bess-capture-pack",
    name: "Solar Capture Price & BESS Arbitrage Screening Pack",
    priceUSD: 149,
    cadence: "quarterly benchmark",
    description:
      "Fuel-specific capture prices, midday solar cannibalization ratios, and 2h/4h battery storage arbitrage spread durations across Luzon, Visayas, Mindanao, Singapore & Malaysia.",
    features: [
      "Solar, Wind, Coal, Gas diurnal capture price benchmarks",
      "Midday solar cannibalization discount ratios",
      "2-hour & 4-hour battery storage daily spread models",
      "Top 5% vs Bottom 5% price spreads (P95 - P5)",
      "Financial feasibility modeling template (XLSX + Python)",
    ],
    sampleFiles: ["capture_ratios_sea.csv", "bess_spread_model.xlsx"],
    stripePaymentUrl: process.env.NEXT_PUBLIC_STRIPE_SOLAR_BESS_URL || null,
    targetAudience: "BESS & Solar IPP developers, corporate offtakers, infrastructure funds",
  },
  {
    id: "scope2-carbon-intensity-pack",
    name: "Scope 2 Hourly Grid Carbon Intensity Pack (PH / SG / MY / TH)",
    priceUSD: 99,
    cadence: "annual license",
    description:
      "Auditable hourly and 5-minute gCO2/kWh emissions factors for corporate data center, industrial, and ESG GHG Protocol Scope 2 reporting.",
    features: [
      "5-minute & hourly marginal and average gCO2/kWh grid factors",
      "GHG Protocol Scope 2 Market-based & Location-based compliance",
      "Philippines (Luzon/Visayas/Mindanao), Singapore, Malaysia, Thailand",
      "Clean energy matching 24/7 CFE scorecards",
      "CSV and Parquet automated ingestion pipelines",
    ],
    sampleFiles: ["grid_carbon_intensity.parquet", "scope2_summary.csv"],
    stripePaymentUrl: process.env.NEXT_PUBLIC_STRIPE_CARBON_PACK_URL || null,
    targetAudience: "Hyperscale data centers, multinational ESG teams, sustainability consultants",
  },
];

export function isSafeStripeUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "buy.stripe.com" || u.hostname === "checkout.stripe.com")
    );
  } catch {
    return false;
  }
}

export function ProDataBanner({
  country,
  summary,
  currencySymbol = "₱",
  currencyCode = "PHP",
  isModalOpen = false,
  onCloseModal,
  onOpenModal,
}: ProDataBannerProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProProductItem | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [mailtoUrl, setMailtoUrl] = useState("");
  const [corporateEmail, setCorporateEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tinNumber, setTinNumber] = useState("");

  const activeModalProduct = selectedProduct || DEFAULT_PRODUCTS[0];

  const handleCheckout = (product: ProProductItem) => {
    if (product.stripePaymentUrl && isSafeStripeUrl(product.stripePaymentUrl)) {
      window.open(product.stripePaymentUrl, "_blank", "noopener,noreferrer");
    } else {
      setSelectedProduct(product);
      setSubmitted(false);
    }
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const salesEmail = process.env.NEXT_PUBLIC_SALES_EMAIL || "data@openelectricity.org";
    const subject = `[OpenElectricity Pro] ${activeModalProduct.name} ($${activeModalProduct.priceUSD} USD) — ${companyName}`;
    const bodyLines = [
      "OpenElectricity Pro Order Request",
      "----------------------------------------",
      `Product ID: ${activeModalProduct.id}`,
      `Package Title: ${activeModalProduct.name}`,
      `Price: $${activeModalProduct.priceUSD} USD (${activeModalProduct.cadence})`,
      `Work Email: ${corporateEmail}`,
      `Company Name: ${companyName}`,
      tinNumber.trim() ? `BIR TIN / Tax ID: ${tinNumber.trim()}` : null,
      "----------------------------------------",
      "Please dispatch the official pro-forma invoice and payment instructions.",
    ].filter(Boolean);
    const body = bodyLines.join("\n");

    const url = `mailto:${encodeURIComponent(salesEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    setMailtoUrl(url);
    if (typeof window !== "undefined") {
      window.location.href = url;
    }
    setSubmitted(true);
  };

  const handleInvoiceSubmit = handleSubmitRequest;

  const closeModal = () => {
    setSelectedProduct(null);
    setSubmitted(false);
    onCloseModal?.();
  };

  const showModal = isModalOpen || selectedProduct !== null;

  return (
    <section className="bg-gradient-to-b from-neutral-900 to-neutral-950 dark:from-[#0c0c0e] dark:to-[#08080a] border border-neutral-800 dark:border-[#27272A] rounded-xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800 pb-4 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
              <Database className="h-3 w-3 mr-1" />
              Pro Intelligence & Data Packs
            </span>
            <span className="text-xs text-neutral-400">Institutional Market Analytics</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-white mt-1">
            Self-Serve Wholesale Market Datasets & Commercial Analytics
          </h3>
          <p className="text-xs text-neutral-400 max-w-2xl mt-0.5">
            Direct Parquet and CSV extracts for Southeast Asian electricity markets. Designed for power developers, BESS asset operators, data center buyers, and quantitative energy traders.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setSelectedProduct(DEFAULT_PRODUCTS[0]);
              setSubmitted(false);
              onOpenModal?.();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-xs font-semibold text-neutral-200 transition cursor-pointer"
          >
            <Building2 className="h-3.5 w-3.5 text-neutral-400" />
            <span>Corporate Invoicing (BIR 2307)</span>
          </button>
        </div>
      </div>

      {/* Live Market Snapshot Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 text-xs font-mono">
        <div className="bg-neutral-800/60 border border-neutral-700/60 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-neutral-400 text-[10.5px]">
            <span>Solar Capture Price</span>
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {summary?.solarCapturePriceLocal != null
              ? `${currencySymbol}${Math.round(summary.solarCapturePriceLocal).toLocaleString()}/MWh`
              : "—"}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {summary?.solarCaptureRatio != null
              ? `${Math.round(summary.solarCaptureRatio * 100)}% of VWAP (Cannibalization)`
              : "Calculated per diurnal profile"}
          </div>
        </div>

        <div className="bg-neutral-800/60 border border-neutral-700/60 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-neutral-400 text-[10.5px]">
            <span>BESS Arbitrage Spread</span>
            <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {summary?.bessSpreadLocal != null && summary.bessSpreadLocal > 0
              ? `${currencySymbol}${Math.round(summary.bessSpreadLocal).toLocaleString()}/MWh`
              : "—"}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {summary?.bessSpreadUSD != null
              ? `P95 - P5 Spread ($${Math.round(summary.bessSpreadUSD)}/MWh)`
              : "Top 5% vs Bottom 5% Spot"}
          </div>
        </div>

        <div className="bg-neutral-800/60 border border-neutral-700/60 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-neutral-400 text-[10.5px]">
            <span>Grid Emissions Factor</span>
            <Leaf className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {summary?.emissionsIntensityGPerKWh != null && summary.emissionsIntensityGPerKWh > 0
              ? `${Math.round(summary.emissionsIntensityGPerKWh)} gCO₂/kWh`
              : "—"}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            Scope 2 GHG Protocol Ready
          </div>
        </div>

        <div className="bg-neutral-800/60 border border-neutral-700/60 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-neutral-400 text-[10.5px]">
            <span>Market VWAP</span>
            <Coins className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {summary?.avgPriceLocal != null && summary.avgPriceLocal > 0
              ? `${currencySymbol}${summary.avgPriceLocal.toLocaleString()}/MWh`
              : "—"}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {summary?.avgPriceUSD != null ? `$${summary.avgPriceUSD}/MWh USD` : "Volume-Weighted Average"}
          </div>
        </div>
      </div>

      {/* 3 Self-Serve Commercial Pack Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {DEFAULT_PRODUCTS.map((prod) => (
          <div
            key={prod.id}
            className="bg-neutral-850/80 dark:bg-[#141417] border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 flex flex-col justify-between transition-all duration-150 hover:shadow-lg group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  {prod.cadence}
                </span>
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-neutral-400">USD</span>
                  <span className="text-lg font-black text-white font-mono">
                    ${prod.priceUSD}
                  </span>
                </div>
              </div>

              <h4 className="text-sm font-bold text-neutral-100 group-hover:text-emerald-400 transition-colors mt-1.5 mb-1.5 leading-snug">
                {prod.name}
              </h4>

              <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
                {prod.description}
              </p>

              {/* Feature Checklist */}
              <ul className="space-y-1.5 mb-3 text-[11px] text-neutral-300">
                {prod.features.slice(0, 3).map((feat, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {/* Sample Files Pill Badges */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {prod.sampleFiles.map((sf, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700"
                  >
                    {sf.endsWith(".parquet") ? (
                      <FileCode className="h-3 w-3 text-cyan-400" />
                    ) : (
                      <FileSpreadsheet className="h-3 w-3 text-emerald-400" />
                    )}
                    <span>{sf}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
              <span className="text-[10px] text-neutral-400 truncate max-w-[140px]">
                {prod.targetAudience.split(",")[0]}
              </span>
              <button
                onClick={() => handleCheckout(prod)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer shrink-0"
              >
                <span>Order Pack</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Institutional Purchasing Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-5 sm:p-6 text-neutral-200 shadow-2xl relative animate-in fade-in-50 zoom-in-95">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                Enterprise & Corporate Orders
              </span>
              <span className="text-xs text-neutral-400 font-mono">OpenElectricity B2B</span>
            </div>

            <h3 className="text-lg font-bold text-white">
              {activeModalProduct.name}
            </h3>

            <p className="text-xs text-neutral-400 mt-1 mb-4 leading-relaxed">
              Immediate digital access via corporate card, or request an official Pro-Forma Invoice / BIR Form 2307 Withholding Tax compliance for Philippine & Southeast Asian corporations.
            </p>

            {submitted ? (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 sm:p-5 text-center space-y-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Order Inquiry Registered</h4>
                <p className="text-xs text-neutral-300 max-w-md mx-auto">
                  Our telemetry engineering desk has logged your request for <strong>{activeModalProduct.name}</strong>. An official pro-forma invoice and encrypted download link will be dispatched to <strong>{corporateEmail}</strong> within 1 business hour.
                </p>

                {/* Order Summary Details */}
                <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-3 text-left text-xs space-y-1.5 font-mono text-neutral-300 max-w-md mx-auto">
                  <div className="text-[11px] font-sans font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-1">
                    Order Summary
                  </div>
                  <div className="flex justify-between items-start gap-2 pt-0.5">
                    <span className="text-neutral-500 shrink-0 font-sans">Package:</span>
                    <span className="text-white font-medium text-right font-sans">{activeModalProduct.name}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-500 font-sans">Price:</span>
                    <span className="text-emerald-400 font-bold">${activeModalProduct.priceUSD} USD ({activeModalProduct.cadence})</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-500 font-sans">Work Email:</span>
                    <span className="text-neutral-200">{corporateEmail}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-neutral-500 font-sans">Company:</span>
                    <span className="text-neutral-200">{companyName}</span>
                  </div>
                  {tinNumber.trim() && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-neutral-500 font-sans">BIR TIN:</span>
                      <span className="text-neutral-200">{tinNumber.trim()}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                  {mailtoUrl && (
                    <a
                      href={mailtoUrl}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Re-open Email Draft</span>
                    </a>
                  )}
                  <button
                    onClick={closeModal}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitRequest} className="space-y-3.5 text-xs">
                <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-neutral-400 font-medium">Selected Dataset Pack</div>
                    <div className="text-xs font-bold text-white mt-0.5">{activeModalProduct.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-emerald-400 text-sm">
                      ${activeModalProduct.priceUSD} USD
                    </div>
                    <div className="text-[10px] text-neutral-400">{activeModalProduct.cadence}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Corporate Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={corporateEmail}
                      onChange={(e) => setCorporateEmail(e.target.value)}
                      placeholder="analyst@energy-utility.com"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Company / Organization Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Acme Power Generation Corp"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Tax Identification / BIR TIN (Optional for Philippine 2307 Withholding)
                  </label>
                  <input
                    type="text"
                    value={tinNumber}
                    onChange={(e) => setTinNumber(e.target.value)}
                    placeholder="000-000-000-000"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Used solely for official billing and tax invoicing. Sent directly via your email client and not stored on our servers.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-1.5 text-[11px] text-neutral-400">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Instant encrypted delivery & auditable receipt</span>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    {activeModalProduct.stripePaymentUrl && isSafeStripeUrl(activeModalProduct.stripePaymentUrl) && (
                      <a
                        href={activeModalProduct.stripePaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition"
                      >
                        <span>Card Checkout</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <button
                      type="submit"
                      className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer"
                    >
                      <span>Request Invoice & PO</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
