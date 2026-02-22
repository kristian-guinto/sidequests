import { createClient } from '@supabase/supabase-js';

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
export const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
