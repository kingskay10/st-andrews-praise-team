/// <reference path="./runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const roles = ['member', 'secretary', 'music_director', 'band_director', 'prayer_director', 'chair'];

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'Sign in as chair to invite members.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const siteUrl = Deno.env.get('SITE_URL');
  if (!url || !anonKey || !serviceKey || !siteUrl) return response({ error: 'Invite function is not configured.' }, 500);

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return response({ error: 'Your session expired. Sign in again.' }, 401);

  const { data: callerRole, error: roleError } = await adminClient
    .from('roles').select('role').eq('user_id', user.id).maybeSingle();
  if (roleError || callerRole?.role !== 'chair') return response({ error: 'Only the chair can invite members.' }, 403);

  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch { return response({ error: 'Invalid request.' }, 400); }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const role = typeof input.role === 'string' ? input.role : '';
  if (!name || name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150 || !roles.includes(role)) {
    return response({ error: 'Enter a name, valid email, and supported role.' }, 400);
  }

  const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${siteUrl.replace(/\/$/, '')}/set-password.html?invite=1`,
  });
  if (inviteError || !invitation.user) return response({ error: inviteError?.message || 'Invitation could not be sent.' }, 400);

  const memberId = invitation.user.id;
  const profile = {
    id: memberId,
    name,
    email,
    position: cleanText(input.position, 100),
    phone: cleanText(input.phone, 30),
    location: cleanText(input.location, 150),
    social_media: cleanText(input.social_media, 150),
    marital_status: input.marital_status === 'single' || input.marital_status === 'married' ? input.marital_status : null,
  };
  const [{ error: profileError }, { error: roleUpdateError }] = await Promise.all([
    adminClient.from('profiles').upsert(profile),
    adminClient.from('roles').upsert({ user_id: memberId, role }),
  ]);
  if (profileError || roleUpdateError) {
    await adminClient.auth.admin.deleteUser(memberId);
    return response({ error: 'Invitation was rolled back because the member profile could not be saved.' }, 500);
  }

  return response({ message: `Invitation sent to ${email}. They will sign in using that email after accepting the invitation.` }, 200);
});

function cleanText(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maximum) : null;
}

function response(body: Record<string, string>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
