import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://woquuneospuzwkqykkvt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcXV1bmVvc3B1endrcXlra3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzQ0MDMsImV4cCI6MjA5Mjk1MDQwM30.UWtlRPhH77CUs_1SPzkMOWfJPNE7bxtuiqVmBNUfN-Q'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
