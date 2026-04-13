import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Chave pública do Supabase (anon)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbnVjaXZycnhwYmNsdWZ2c29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzgwODksImV4cCI6MjA5MTYxNDA4OX0.tRZFWTug0-7SwtNhf6-5HrvctuUV6QkT_u4LEx9ngZ4';

// URL do projeto Supabase
const SUPABASE_URL = 'https://bgnucivrrxpbclufvsos.supabase.co';

// Cliente Supabase público (para leitura)
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Cliente com service role (para admin - só usar no servidor)
export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Exporta auth do Supabase
export const supabaseAuth = supabase.auth;