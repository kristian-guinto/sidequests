/**
 * Typed API Client for pollmph
 * 
 * Interacts with the FastAPI backend (/api/v1) with fallback to direct Supabase 
 * queries when the backend server is offline.
 */

import {
    Proposition,
    PropositionDashboardCardData,
    Sentiment,
    MovingAveragePoint,
    WeeklySummary,
    VirtualPollSurvey,
    VirtualPollTopic
} from '../types';
import { supabase } from '../supabaseClient';

const API_BASE_URL =
    (import.meta && import.meta.env && import.meta.env.VITE_API_URL) ||
    'http://localhost:8000/api/v1';

// Helper for rolling moving average calculation in fallback mode
function calculateMovingAverage(data: any[], windowSize = 7): MovingAveragePoint[] {
    const sortedData = [...data].sort(
        (a, b) => new Date(a.date_generated).getTime() - new Date(b.date_generated).getTime()
    );

    return sortedData.map((val, idx, arr) => {
        const dateObj = new Date(val.date_generated);
        const shortDate = dateObj.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

        const base: MovingAveragePoint = {
            date_generated: val.date_generated,
            shortDate,
            consensus_value: val.consensus_value,
            attention_value: val.attention_value,
            ma_consensus: val.consensus_value,
            ma_attention: val.attention_value,
        };

        if (idx < windowSize - 1) return base;

        const window = arr.slice(idx - windowSize + 1, idx + 1);
        const sumC = window.reduce((acc, curr) => acc + curr.consensus_value, 0);
        const sumA = window.reduce((acc, curr) => acc + curr.attention_value, 0);

        return {
            ...base,
            ma_consensus: Number((sumC / windowSize).toFixed(3)),
            ma_attention: Number((sumA / windowSize).toFixed(3)),
        };
    });
}

export const apiClient = {
    /**
     * Fetch all proposition dashboard cards with pre-calculated moving averages.
     */
    async getDashboardCards(): Promise<PropositionDashboardCardData[]> {
        try {
            const res = await fetch(`${API_BASE_URL}/propositions/dashboard`, {
                headers: { 'Accept': 'application/json' },
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            console.warn('FastAPI backend unavailable, falling back to direct database query:', e);
        }

        // Fallback to direct Supabase query
        if (!supabase) {
            throw new Error('Neither FastAPI backend nor Supabase client is available.');
        }

        const { data: propsData, error: propsError } = await supabase
            .from('propositions')
            .select('proposition_id, proposition_text')
            .eq('is_archived', false);

        if (propsError) throw propsError;
        if (!propsData || propsData.length === 0) return [];

        const propositionIds = propsData.map((p) => p.proposition_id);
        const propositionMap = propsData.reduce((acc: Record<string, string>, curr) => {
            acc[curr.proposition_id] = curr.proposition_text;
            return acc;
        }, {});

        const { data: sentimentsData, error: sentimentsError } = await supabase
            .from('sentiments')
            .select('proposition_id, consensus_value, attention_value, date_generated')
            .in('proposition_id', propositionIds)
            .order('date_generated', { ascending: true });

        if (sentimentsError) throw sentimentsError;
        if (!sentimentsData) return [];

        const grouped = sentimentsData.reduce((acc: Record<string, any[]>, curr) => {
            if (!acc[curr.proposition_id]) acc[curr.proposition_id] = [];
            acc[curr.proposition_id].push(curr);
            return acc;
        }, {});

        return Object.entries(grouped).map(([id, evaluations]) => {
            const evalsWithMA = calculateMovingAverage(evaluations, 7);
            const latest = evalsWithMA[evalsWithMA.length - 1];
            const prev = evalsWithMA[evalsWithMA.length - 2] || latest;
            const delta = latest && prev ? latest.ma_consensus - prev.ma_consensus : 0;

            return {
                id,
                proposition_text: propositionMap[id] || id,
                latest_consensus: latest ? latest.ma_consensus : null,
                latest_attention: latest ? latest.ma_attention : null,
                delta_consensus: delta,
                tracking_since: evalsWithMA[0]?.shortDate || null,
                latest_date: latest?.shortDate || null,
                evaluations: evalsWithMA,
            };
        });
    },

    /**
     * Retrieve single proposition details.
     */
    async getProposition(id: string): Promise<Proposition | null> {
        try {
            const res = await fetch(`${API_BASE_URL}/propositions/${id}`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('FastAPI proposition detail fallback:', e);
        }

        if (supabase) {
            const { data, error } = await supabase
                .from('propositions')
                .select('*')
                .eq('proposition_id', id)
                .single();
            if (!error && data) return data as Proposition;
        }

        return null;
    },

    /**
     * Retrieve sentiment history and moving averages for a proposition.
     */
    async getSentimentHistory(id: string): Promise<{ items: Sentiment[]; moving_averages: MovingAveragePoint[] }> {
        try {
            const res = await fetch(`${API_BASE_URL}/sentiments/${id}?limit=60`);
            if (res.ok) {
                const data = await res.json();
                return {
                    items: data.items,
                    moving_averages: data.moving_averages,
                };
            }
        } catch (e) {
            console.warn('FastAPI sentiments fallback:', e);
        }

        if (supabase) {
            const { data } = await supabase
                .from('sentiments')
                .select('*')
                .eq('proposition_id', id)
                .order('date_generated', { ascending: false })
                .limit(60);

            const items: Sentiment[] = (data || []).reverse();
            const moving_averages = calculateMovingAverage(items, 7);
            return { items, moving_averages };
        }

        return { items: [], moving_averages: [] };
    },

    /**
     * Retrieve latest weekly summary for a proposition.
     */
    async getLatestSummary(id: string): Promise<WeeklySummary | null> {
        try {
            const res = await fetch(`${API_BASE_URL}/summaries/${id}/latest`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('FastAPI summary fallback:', e);
        }

        if (supabase) {
            const { data } = await supabase
                .from('weekly_summaries')
                .select('*')
                .eq('proposition_id', id)
                .order('week_end', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (data) return data as WeeklySummary;
        }

        return null;
    },

    /**
     * Retrieve Virtual Poll topics.
     */
    async getVirtualPollTopics(): Promise<VirtualPollTopic[]> {
        try {
            const res = await fetch(`${API_BASE_URL}/virtual-poll/topics`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('FastAPI virtual poll topics fallback:', e);
        }

        return [
            {
                topic_id: 'vp-2028-presidential',
                title: '2028 Philippine Presidential Preference',
                category: 'Electoral',
                active: true,
                latest_run: new Date().toISOString().split('T')[0],
            },
        ];
    },

    /**
     * Retrieve Virtual Poll survey breakdown for a topic.
     */
    async getVirtualPoll(topicId: string): Promise<VirtualPollSurvey | null> {
        try {
            const res = await fetch(`${API_BASE_URL}/virtual-poll/${topicId}`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('FastAPI virtual poll fallback:', e);
        }

        return null;
    },
};

