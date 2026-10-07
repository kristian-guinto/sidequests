import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { VirtualPollCard } from '@/components/VirtualPollCard';
import { PropositionDashboardCardData } from '@/types';
import { apiClient } from '@/api/client';

// ============================================================================
// 1. TOOLTIP SUB-COMPONENT
// ============================================================================

interface CustomTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const dataPoint = payload[0]?.payload;
        const maConsensus = dataPoint?.ma_consensus ?? dataPoint?.consensus_value;
        const maAttention = dataPoint?.ma_attention ?? dataPoint?.attention_value;

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

// ============================================================================
// 2. PROPOSITION CARD
// ============================================================================

interface PropositionCardProps {
    proposition: PropositionDashboardCardData;
    onClick: () => void;
}

const PropositionCard: React.FC<PropositionCardProps> = ({ proposition, onClick }) => {
    const { proposition_text, evaluations } = proposition;
    const latest = evaluations[evaluations.length - 1];
    const previous = evaluations[evaluations.length - 2] || latest;

    if (!latest) {
        return (
            <Card
                className="group cursor-pointer hover:border-primary/50 transition-colors duration-200 bg-muted/30"
                onClick={onClick}
            >
                <CardHeader className="pb-4 space-y-2">
                    <CardTitle className="text-base font-medium leading-snug line-clamp-2">
                        {proposition_text}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Awaiting sentiment run</p>
                </CardHeader>
            </Card>
        );
    }

    const currentMA = latest.ma_consensus;
    const delta = previous ? currentMA - previous.ma_consensus : 0;
    const isMajority = currentMA >= 0.5;

    return (
        <Card
            className="group cursor-pointer hover:border-primary/50 transition-colors duration-200 bg-muted/30"
            onClick={onClick}
        >
            <CardHeader className="pb-4 space-y-2">
                <CardTitle className="text-base font-medium leading-snug line-clamp-2">
                    {proposition_text}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Tracking since {evaluations[0]?.shortDate || 'recent'}
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
                                    <stop offset="0%" stopColor="rgb(5, 150, 105)" stopOpacity={0.1} />
                                    <stop offset="100%" stopColor="rgb(5, 150, 105)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id={`gradient-${proposition.id}-red`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgb(225, 29, 72)" stopOpacity={0.1} />
                                    <stop offset="100%" stopColor="rgb(225, 29, 72)" stopOpacity={0} />
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
// 3. MAIN EXPORTED DASHBOARD
// ============================================================================

export const PulseDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [propositions, setPropositions] = useState<PropositionDashboardCardData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const data = await apiClient.getDashboardCards();
                setPropositions(data);
            } catch (err: any) {
                console.error("Error loading dashboard data:", err);
                setError(err.message || 'Failed to fetch propositions data');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-background">
                <div className="max-w-7xl mx-auto px-4 py-8 md:px-6 md:py-12">
                    <header className="mb-10 flex items-start justify-between">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
                                <span className="text-foreground">pollm</span><span className="text-emerald-600 dark:text-emerald-400">ph</span>
                            </h1>
                            <p className="text-muted-foreground text-sm italic">poll-em PH</p>
                            <p className="text-muted-foreground text-xs mt-2 max-w-sm">
                                Tracks public consensus and media attention on Philippine political propositions.
                                Scores generated via FastAPI backend architecture and Google Gemini grounding.
                            </p>
                        </div>
                        <ThemeToggle />
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <Card key={i} className="bg-muted/30 animate-pulse">
                                <CardHeader className="pb-4 space-y-2">
                                    <div className="h-5 bg-muted rounded w-3/4" />
                                    <div className="h-3 bg-muted rounded w-1/3" />
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between">
                                        <div className="h-10 bg-muted rounded w-24" />
                                        <div className="h-10 bg-muted rounded w-20" />
                                    </div>
                                    <div className="h-32 bg-muted rounded" />
                                </CardContent>
                                <CardFooter className="pt-4 border-t">
                                    <div className="h-3 bg-muted rounded w-full" />
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
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
                            <span className="text-foreground">pollm</span><span className="text-emerald-600 dark:text-emerald-400">ph</span>
                        </h1>
                        <p className="text-muted-foreground text-sm italic">poll-em PH</p>
                        <p className="text-muted-foreground text-xs mt-2 max-w-sm">
                            Tracks public consensus and media attention on Philippine political propositions.
                            Scores generated via FastAPI backend architecture and Google Gemini grounding.
                        </p>
                    </div>
                    <ThemeToggle />
                </header>

                {/* Virtual Polling Showcase Panel */}
                <VirtualPollCard topicId="vp-2028-presidential" />

                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Tracked Propositions</h2>
                    <Badge variant="outline" className="text-xs font-mono">{propositions.length} Active</Badge>
                </div>

                {propositions.length === 0 ? (
                    <div className="text-center text-muted-foreground py-20">No proposition data available</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {propositions.map(p => (
                            <PropositionCard
                                key={p.id}
                                proposition={p}
                                onClick={() => navigate(`/proposition/${p.id}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PulseDashboard;

