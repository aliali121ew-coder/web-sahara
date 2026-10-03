import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from localStorage or environment variables
const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const supabaseUrl = localStorage.getItem('sahara_supabase_url') || env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = localStorage.getItem('sahara_supabase_anon_key') || env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
