import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Info, TrendingUp, ShieldCheck, MapPin, Briefcase, Calendar } from 'lucide-react';
import { VirtualPollSurvey } from '@/types';
import { apiClient } from '@/api/client';

interface VirtualPollCardProps {
    topicId?: string;
}

export const VirtualPollCard: React.FC<VirtualPollCardProps> = ({ topicId = 'vp-2028-presidential' }) => {
    const [poll, setPoll] = useState<VirtualPollSurvey | null>(null);
    const [selectedDimension, setSelectedDimension] = useState<'region' | 'socioeconomic_class' | 'age_bracket'>('region');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPoll = async () => {
            setLoading(true);
            try {
                const data = await apiClient.getVirtualPoll(topicId);
                setPoll(data);
            } catch (err) {
                console.error('Error loading virtual poll:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPoll();
    }, [topicId]);

    if (loading) {
        return (
            <Card className="border-emerald-500/30 bg-card/60 backdrop-blur-sm animate-pulse mb-8">
                <CardHeader>
                    <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                </CardHeader>
                <CardContent>
                    <div className="h-28 bg-muted rounded w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!poll) return null;

    const filteredBreakdowns = poll.demographic_breakdowns.filter(
        (b) => b.dimension === selectedDimension
    );

    return (
        <Card className="border-emerald-500/40 bg-linear-to-br from-emerald-950/10 via-card to-background shadow-md mb-8">
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                            <Users className="w-3 h-3 mr-1" /> Virtual Demographic Panel
                        </Badge>
                        <Badge variant="outline" className="text-[11px] text-muted-foreground border-border">
                            N={poll.simulated_respondents.toLocaleString()} · ±{poll.margin_of_error}% MoE
                        </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Updated {poll.poll_date}
                    </span>
                </div>

                <CardTitle className="text-xl font-bold tracking-tight mt-2 text-foreground">
                    Virtual Demographic Sentiment Oracle
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Continuous synthetic population polling across Philippine demographic cohorts, calibrated to PSA Census baselines.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
                {/* Aggregate Scores Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border border-border/50">
                    <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                            Weighted Consensus
                        </span>
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {(poll.consensus_score * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                            Net Agreement
                        </span>
                        <span className={`text-2xl font-bold ${poll.net_agreement >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {poll.net_agreement > 0 ? `+${poll.net_agreement}%` : `${poll.net_agreement}%`}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                            Public Attention
                        </span>
                        <span className="text-2xl font-bold text-foreground">
                            {(poll.attention_score * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                            Panel Sampling
                        </span>
                        <span className="text-xs font-medium text-foreground flex items-center gap-1 mt-1">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" /> PSA Census Weighted
                        </span>
                    </div>
                </div>

                {/* Demographic Dimension Selector */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                            Demographic Stratification
                        </span>
                        <div className="flex gap-1">
                            <Button
                                size="xs"
                                variant={selectedDimension === 'region' ? 'default' : 'outline'}
                                onClick={() => setSelectedDimension('region')}
                                className="text-xs"
                            >
                                <MapPin className="w-3 h-3 mr-1" /> Regions
                            </Button>
                            <Button
                                size="xs"
                                variant={selectedDimension === 'socioeconomic_class' ? 'default' : 'outline'}
                                onClick={() => setSelectedDimension('socioeconomic_class')}
                                className="text-xs"
                            >
                                <Briefcase className="w-3 h-3 mr-1" /> Classes (ABC/D/E)
                            </Button>
                            <Button
                                size="xs"
                                variant={selectedDimension === 'age_bracket' ? 'default' : 'outline'}
                                onClick={() => setSelectedDimension('age_bracket')}
                                className="text-xs"
                            >
                                <Users className="w-3 h-3 mr-1" /> Age Brackets
                            </Button>
                        </div>
                    </div>

                    {/* Stratification Bars */}
                    <div className="space-y-2.5 pt-1">
                        {filteredBreakdowns.map((seg) => {
                            const isSupport = seg.support_percentage >= 50;
                            return (
                                <div key={seg.segment} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-medium text-foreground">
                                            {seg.segment}{' '}
                                            <span className="text-[10px] text-muted-foreground">
                                                ({(seg.sample_weight * 100).toFixed(0)}% pop.)
                                            </span>
                                        </span>
                                        <span className={`font-bold tabular-nums ${isSupport ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {seg.support_percentage.toFixed(1)}% support
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                                        <div
                                            className={`h-full transition-all duration-500 rounded-full ${isSupport ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                            style={{ width: `${Math.min(100, Math.max(0, seg.support_percentage))}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>

            <CardFooter className="pt-2 border-t text-[11px] text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1">
                    <Info className="w-3 h-3 text-muted-foreground" />
                    Multi-agent simulation conditioned on daily verified news and local discourse.
                </span>
                <span className="font-mono text-[10px]">v2.0-virtual-poll</span>
            </CardFooter>
        </Card>
    );
};

