
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://virbnugthhbunxxxsizw.supabase.co';
const supabaseKey = 'sb_secret_gbPgle5UYLzTpNIes0ZPTQ_bAGVtTdL'; // Replace with your anon/public key if needed
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExpense() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', '5f1ff720-58ee-46ad-90b0-a962848aca08');
  console.log('data:', data);
  console.log('error:', error);
}

checkExpense();
