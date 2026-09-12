import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
    try {
        const viteEnv = (import.meta && import.meta.env) ? (import.meta.env[`VITE_${key}`] as string) : undefined;
        if (viteEnv !== undefined) return viteEnv;

        const nodeEnv = (typeof process !== 'undefined' && process.env) ? process.env[`REACT_APP_${key}`] : undefined;
        if (nodeEnv !== undefined) return nodeEnv;
    } catch (e) {
        // Silent catch
    }
    return '';
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_KEY');

export const supabase: SupabaseClient | null =
    (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

