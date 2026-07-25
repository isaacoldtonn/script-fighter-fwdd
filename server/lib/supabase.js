const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder_service_key';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || supabaseUrl === 'your_supabase_project_url') {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing or using default placeholder in environment.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabase;
