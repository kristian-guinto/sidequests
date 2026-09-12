/**
 * TypeScript Data Models for pollmph
 * 
 * Synchronized with FastAPI Backend Schemas.
 */

export interface Proposition {
    proposition_id: string;
    proposition_text: string;
    search_queries?: string[] | null;
    next_run_date?: string | null;
    is_archived?: boolean;
}

export interface Sentiment {
    id?: number;
    proposition_id: string;
    date_generated: string;
    consensus_value: number;
    attention_value: number;
    movement_analysis?: string | null;
    rationale_consensus: string;
    rationale_attention: string;
    data_quality?: number | null;
}

export interface MovingAveragePoint {
    date_generated: string;
    shortDate: string;
    consensus_value: number;
    attention_value: number;
    ma_consensus: number;
    ma_attention: number;
}

export interface PropositionDashboardCardData {
    id: string;
    proposition_text: string;
    is_archived?: boolean;
    latest_consensus?: number | null;
    latest_attention?: number | null;
    delta_consensus?: number | null;
    tracking_since?: string | null;
    latest_date?: string | null;
    evaluations: MovingAveragePoint[];
}

export interface WeeklySummary {
    id?: number;
    proposition_id: string;
    week_start: string;
    week_end: string;
    summary: string;
    key_drivers: string;
    trend_verdict: 'rising' | 'falling' | 'stable' | 'volatile';
    outlook: string;
    created_at?: string;
}

export interface DemographicBreakdown {
    dimension: 'region' | 'socioeconomic_class' | 'age_bracket';
    segment: string;
    support_percentage: number;
    attention_score: number;
    sample_weight: number;
}

export interface VirtualPollSurvey {
    poll_id: string;
    topic_id: string;
    poll_date: string;
    simulated_respondents: number;
    margin_of_error: number;
    consensus_score: number;
    attention_score: number;
    net_agreement: number;
    demographic_breakdowns: DemographicBreakdown[];
    methodology_note?: string;
}

export interface VirtualPollTopic {
    topic_id: string;
    title: string;
    category: string;
    active: boolean;
    latest_run: string;
}

