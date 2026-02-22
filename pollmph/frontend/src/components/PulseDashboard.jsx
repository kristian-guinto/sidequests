import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Info, Calendar } from 'lucide-react';

// ============================================================================
// 1. DATA GENERATION & MOVING AVERAGE LOGIC
// ============================================================================

/**
 * Robust environment variable accessor to prevent "import.meta" 
 * compilation errors in ES2015/older target environments.
 */
const getEnv = (key) => {
    try {
        // Check for Vite's import.meta.env
        const viteEnv = (import.meta && import.meta.env) ? import.meta.env[`VITE_${key}`] : undefined;
        if (viteEnv !== undefined) return viteEnv;

        // Fallback to process.env (CRA/Node)
        const nodeEnv = (typeof process !== 'undefined' && process.env) ? process.env[`REACT_APP_${key}`] : undefined;
        if (nodeEnv !== undefined) return nodeEnv;
    } catch (e) {
        // Silent catch for environments where import.meta might throw
    }
    return '';
};

const calculateMovingAverage = (data, windowSize = 7) => {
    return data.map((val, idx, arr) => {
        if (idx < windowSize - 1) return { ...val, ma_consensus: val.consensus_value, ma_attention: val.attention_value };
        const window = arr.slice(idx - windowSize + 1, idx + 1);
        const sumC = window.reduce((acc, curr) => acc + curr.consensus_value, 0);
        const sumA = window.reduce((acc, curr) => acc + curr.attention_value, 0);
        return {
            ...val,
            ma_consensus: Number((sumC / windowSize).toFixed(3)),
            ma_attention: Number((sumA / windowSize).toFixed(3))
        };
    });
};

const generateMockHistory = (baseConsensus, baseAttention, volatility, startDateStr, days = 30) => {
    let rawData = [];
    let currentC = baseConsensus;
    let currentA = baseAttention;
    const start = new Date(startDateStr);

    for (let i = 0; i <= days; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        currentC = Math.max(0, Math.min(1, currentC + (Math.random() - 0.5) * volatility));
        currentA = Math.max(0, Math.min(1, currentA + (Math.random() - 0.5) * (volatility * 0.5)));

        rawData.push({
            shortDate: date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
            consensus_value: Number(currentC.toFixed(3)),
            attention_value: Number(currentA.toFixed(3)),
        });
    }
    return calculateMovingAverage(rawData, 7);
};

const MOCK_DATA = [
    {
        id: 'marcos_robredo_2028',
        proposition_text: 'Bongbong Marcos and Leni Robredo will team up for the 2028 Philippine Presidential Election',
        evaluations: generateMockHistory(0.22, 0.80, 0.12, '2024-04-10', 45)
    },
    {
        id: 'sarah_duterte_wins_2028',
        proposition_text: 'Sara Duterte will win the 2028 Philippine Presidential Election',
        evaluations: generateMockHistory(0.58, 0.90, 0.08, '2024-03-20', 60)
    }
];

// ============================================================================
// 2. SUB-COMPONENTS
// ============================================================================

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const maConsensus = payload.find(p => p.dataKey === "ma_consensus")?.value;
        const rawConsensus = payload.find(p => p.dataKey === "consensus_value")?.value;
        const attention = payload.find(p => p.dataKey === "ma_attention")?.value;

        return (
            <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xl min-w-[180px] z-50">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2 border-b border-slate-100 pb-1">
                    {label}
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">7D Trend</span>
                        <span className={`text-xs font-mono font-bold ${maConsensus >= 0.5 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {(maConsensus * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 italic">Raw Point</span>
                        <span className="text-[10px] font-mono text-slate-400">
                            {(rawConsensus * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                        <span className="text-xs text-slate-500">Attention</span>
                        <span className="text-xs font-mono font-bold text-slate-900">
                            {(attention * 100).toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const PropositionCard = ({ proposition }) => {
    const { proposition_text, evaluations } = proposition;
    const latest = evaluations[evaluations.length - 1];
    const previous = evaluations[evaluations.length - 2] || latest;

    const currentMA = latest.ma_consensus;
    const delta = currentMA - previous.ma_consensus;
    const isMajority = currentMA >= 0.5;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
            <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Calendar className="w-3 h-3" />
                    Tracking Since {evaluations[0].shortDate}
                </div>

                <h3 className="font-bold text-lg leading-snug text-slate-900 tracking-tight h-14 line-clamp-2">
                    {proposition_text}
                </h3>

                <div className="flex items-end justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Trend Consensus</span>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-4xl font-black tracking-tighter tabular-nums ${isMajority ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {(currentMA * 100).toFixed(0)}%
                            </span>
                            <span className={`text-sm font-bold flex items-center px-1.5 py-0.5 rounded-md ${delta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {delta >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                {Math.abs(delta * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Attention</span>
                        <div className="text-xl font-bold text-slate-800 tabular-nums">
                            {(latest.ma_attention * 100).toFixed(0)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-48 w-full bg-slate-50/30 border-y border-slate-100 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evaluations} margin={{ top: 20, right: 20, left: 20, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="shortDate" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} minTickGap={40} />
                        <YAxis domain={[0, 1]} hide />
                        <ReferenceLine y={0.5} stroke="#e2e8f0" strokeWidth={1} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} isAnimationActive={false} />
                        <Line type="monotone" dataKey="consensus_value" stroke="transparent" dot={{ r: 1.5, fill: isMajority ? '#a7f3d0' : '#fecdd3', strokeWidth: 0 }} isAnimationActive={false} />
                        <Line type="monotone" dataKey="ma_consensus" stroke={isMajority ? '#10b981' : '#f43f5e'} strokeWidth={3} dot={false} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: isMajority ? '#10b981' : '#f43f5e' }} />
                        <Line type="monotone" dataKey="ma_attention" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="p-4 flex items-center gap-2 bg-white">
                <Info className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                    7-Day Moving Average Trend Visualized
                </span>
            </div>
        </div>
    );
};

// ============================================================================
// 3. MAIN EXPORTED COMPONENT
// ============================================================================

const PulseDashboard = () => {
    return (
        <div className="w-full bg-slate-50 text-slate-900 font-sans p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="px-2 py-0.5 bg-emerald-100 rounded text-[9px] font-black text-emerald-700 uppercase tracking-widest">
                            Live Index
                        </div>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">
                        Pulse<span className="text-emerald-600">PH</span> Sentiment
                    </h1>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {MOCK_DATA.map(p => (
                        <PropositionCard key={p.id} proposition={p} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PulseDashboard;