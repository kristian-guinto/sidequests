import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';

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

// Initialize Supabase client
const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_KEY');
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const calculateMovingAverage = (data, windowSize = 7) => {
    // Ensure data is sorted by date before calculating MA
    const sortedData = [...data].sort((a, b) => new Date(a.date_generated) - new Date(b.date_generated));
    
    return sortedData.map((val, idx, arr) => {
        // Create date object for formatting
        const dateObj = new Date(val.date_generated);
        const shortDate = dateObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        
        const base = { 
            ...val, 
            shortDate,
            ma_consensus: val.consensus_value, 
            ma_attention: val.attention_value 
        };

        if (idx < windowSize - 1) return base;

        const window = arr.slice(idx - windowSize + 1, idx + 1);
        const sumC = window.reduce((acc, curr) => acc + curr.consensus_value, 0);
        const sumA = window.reduce((acc, curr) => acc + curr.attention_value, 0);
        
        return {
            ...base,
            ma_consensus: Number((sumC / windowSize).toFixed(3)),
            ma_attention: Number((sumA / windowSize).toFixed(3))
        };
    });
};

// ============================================================================
// 2. SUB-COMPONENTS
// ============================================================================

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const maConsensus = payload.find(p => p.dataKey === "ma_consensus")?.value;
        const rawConsensus = payload.find(p => p.dataKey === "consensus_value")?.value;
        const maAttention = payload.find(p => p.dataKey === "ma_attention")?.value;
        
        const isMajority = maConsensus >= 0.5;
        const lineColor = isMajority ? 'rgb(5, 150, 105)' : 'rgb(225, 29, 72)';

        return (
            <div className="bg-card border shadow-xl rounded-md p-2 min-w-[160px]">
                <div className="text-[10px] font-semibold text-foreground mb-2 pb-1.5 border-b">{label}</div>
                
                <div className="space-y-1.5">
                    {/* Main Consensus (7d MA) */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: lineColor }}></div>
                            <span className="text-[10px] font-medium text-foreground">Consensus</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums" style={{ color: lineColor }}>
                            {(maConsensus * 100).toFixed(1)}%
                        </span>
                    </div>
                    
                    {/* Raw Value */}
                    <div className="flex items-center justify-between gap-3 pl-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full opacity-40" style={{ backgroundColor: lineColor }}></div>
                            <span className="text-[10px] text-muted-foreground">Raw</span>
                        </div>
                        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                            {(rawConsensus * 100).toFixed(1)}%
                        </span>
                    </div>
                    
                    {/* Attention */}
                    <div className="flex items-center justify-between gap-3 pt-1 mt-1 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-0.5 rounded-full bg-muted-foreground opacity-50"></div>
                            <span className="text-[10px] font-medium text-foreground">Attention</span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                            {(maAttention * 100).toFixed(0)}%
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
        <Card className="group cursor-pointer hover:border-primary/50 transition-colors duration-200 bg-muted/30">
            <CardHeader className="pb-4 space-y-2">
                <CardTitle className="text-base font-medium leading-snug line-clamp-2">
                    {proposition_text}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Tracking since {evaluations[0].shortDate}
                </p>
            </CardHeader>
            
            <CardContent className="space-y-4">
                {/* Metrics Row */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Consensus</span>
                        <div className="flex items-center gap-2.5">
                            <span className={`text-3xl font-bold tabular-nums leading-none ${isMajority ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {(currentMA * 100).toFixed(0)}%
                            </span>
                            {delta !== 0 && (
                                <Badge 
                                    variant="secondary"
                                    className={`h-5 text-[11px] font-semibold ${delta > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'}`}
                                >
                                    {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 items-end">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Attention</span>
                        <div className="flex items-center gap-1.5 text-foreground">
                            <Activity className="w-3.5 h-3.5" />
                            <span className="text-lg font-semibold tabular-nums">
                                {(latest.ma_attention * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="h-32 w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evaluations} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                            <defs>
                                <linearGradient id={`gradient-${proposition.id}-green`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgb(5, 150, 105)" stopOpacity={0.1}/>
                                    <stop offset="100%" stopColor="rgb(5, 150, 105)" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id={`gradient-${proposition.id}-red`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgb(225, 29, 72)" stopOpacity={0.1}/>
                                    <stop offset="100%" stopColor="rgb(225, 29, 72)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis dataKey="shortDate" hide />
                            <YAxis domain={[0, 1]} hide />
                            {/* Boundary lines */}
                            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} opacity={0.4} />
                            <ReferenceLine y={1} stroke="hsl(var(--border))" strokeWidth={1} opacity={0.4} />
                            <ReferenceLine y={0.5} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 5" opacity={0.5} />
                            <Tooltip 
                                content={<CustomTooltip />} 
                                cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} 
                                isAnimationActive={false} 
                            />
                            {/* Raw data points (subtle dots) */}
                            <Line 
                                type="monotone" 
                                dataKey="consensus_value" 
                                stroke="transparent"
                                strokeWidth={0}
                                dot={{ r: 2, fill: isMajority ? 'rgb(5, 150, 105)' : 'rgb(225, 29, 72)', stroke: 'none', opacity: 0.3 }}
                                activeDot={false}
                                isAnimationActive={false}
                            />
                            {/* Attention line (subtle background) */}
                            <Line 
                                type="monotone" 
                                dataKey="ma_attention" 
                                stroke="hsl(var(--muted-foreground))" 
                                strokeWidth={1.5} 
                                strokeOpacity={0.5}
                                strokeDasharray="5 5"
                                dot={false}
                                activeDot={{ r: 3, stroke: 'hsl(var(--card))', strokeWidth: 2, fill: 'hsl(var(--muted-foreground))' }}
                                isAnimationActive={false}
                            />
                            {/* Consensus line (main - 7d average) */}
                            <Line 
                                type="monotone" 
                                dataKey="ma_consensus" 
                                stroke={isMajority ? 'rgb(5, 150, 105)' : 'rgb(225, 29, 72)'}
                                strokeWidth={2.5} 
                                dot={false}
                                activeDot={{ r: 4, stroke: 'hsl(var(--card))', strokeWidth: 2, fill: isMajority ? 'rgb(5, 150, 105)' : 'rgb(225, 29, 72)' }}
                                fill={isMajority ? `url(#gradient-${proposition.id}-green)` : `url(#gradient-${proposition.id}-red)`}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
            
            <CardFooter className="pt-4 border-t">
                <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                    <span>Latest: {latest.shortDate}</span>
                    <span>{(latest.ma_consensus * 100).toFixed(1)}% consensus · {(latest.ma_attention * 100).toFixed(0)}% attention</span>
                </div>
            </CardFooter>
        </Card>
    );
};

// ============================================================================
// 3. MAIN EXPORTED COMPONENT
// ============================================================================

const PulseDashboard = () => {
    const [propositions, setPropositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!supabase) {
                setError("Supabase client not initialized. Check environment variables.");
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch Propositions (text and ID)
                const { data: propsData, error: propsError } = await supabase
                    .from('propositions')
                    .select('proposition_id, proposition_text');

                if (propsError) throw propsError;

                const propositionMap = propsData.reduce((acc, curr) => {
                    acc[curr.proposition_id] = curr.proposition_text;
                    return acc;
                }, {});

                // 2. Fetch Sentiments
                const { data: sentimentsData, error: sentimentsError } = await supabase
                    .from('sentiments')
                    .select('*')
                    .neq('proposition_id', 'demo-prop')
                    .order('date_generated', { ascending: true });

                if (sentimentsError) throw sentimentsError;

                if (!sentimentsData || sentimentsData.length === 0) {
                    setPropositions([]);
                    return;
                }

                // Group by proposition_id
                const grouped = sentimentsData.reduce((acc, curr) => {
                    if (!acc[curr.proposition_id]) {
                        acc[curr.proposition_id] = [];
                    }
                    acc[curr.proposition_id].push(curr);
                    return acc;
                }, {});

                // Transform to component format
                const formattedPropositions = Object.entries(grouped)
                    .map(([id, evaluations]) => {
                        // Use text from propositions table, fallback to ID if not found
                        const text = propositionMap[id] || id; 
                        
                        // Sort evaluations by date
                        evaluations.sort((a, b) => new Date(a.date_generated) - new Date(b.date_generated));
                        
                        return {
                            id,
                            proposition_text: text,
                            evaluations: calculateMovingAverage(evaluations, 7)
                        };
                    });

                setPropositions(formattedPropositions);

            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-background text-muted-foreground font-medium text-sm animate-pulse">
                Loading data...
            </div>
        );
    }

    if (error) {
         return (
            <div className="w-full h-screen flex items-center justify-center bg-background text-destructive font-medium p-4 text-center">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 md:py-12">
                <header className="mb-10 flex items-start justify-between">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
                            poll<span className="text-primary">mph</span>
                        </h1>
                        <p className="text-muted-foreground text-sm">Philippine political sentiment tracker</p>
                    </div>
                    <ThemeToggle />
                </header>

                {propositions.length === 0 ? (
                    <div className="text-center text-muted-foreground py-20">No data available</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {propositions.map(p => (
                            <PropositionCard key={p.id} proposition={p} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PulseDashboard;