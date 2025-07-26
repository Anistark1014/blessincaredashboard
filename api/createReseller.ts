import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY! // Don't expose this on frontend
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, phone, region } = req.body;

  try {
    // 1. Create Auth User
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: Math.random().toString(36).slice(-8),
      email_confirm: true,
    });

    if (authError) throw authError;

    // 2. Add to users table
    const { error: insertError } = await supabase.from('users').insert({
      id: authUser.user.id,
      name,
      email,
      role: 'reseller',
      region,
      contact_info: { phone },
      is_active: true,
    });

    if (insertError) throw insertError;

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
