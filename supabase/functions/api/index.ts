import { createClient } from 'npm:@supabase/supabase-js@2.117.0';

type Role = 'client' | 'expert' | 'admin';
type Profile = {
  id: string;
  auth_user_id: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: string;
  client_type: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = resolveServiceKey();
const db = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const expertResponseHours = numberEnv('EXPERT_RESPONSE_HOURS', 24);
const escrowReleaseHours = numberEnv('ESCROW_RELEASE_HOURS', 72);
const commissionRate = numberEnv('PLATFORM_COMMISSION_RATE', 0.1);

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function resolveServiceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!keys) throw new Error('Supabase server key is unavailable');
  const parsed = JSON.parse(keys) as Record<string, string>;
  const key = parsed.default ?? Object.values(parsed)[0];
  if (!key) throw new Error('Supabase server key is unavailable');
  return key;
}

function numberEnv(name: string, fallback: number): number {
  const parsed = Number(Deno.env.get(name));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) throw new ApiError(status, message);
}

async function payload<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, 'A valid JSON request body is required');
  }
}

function apiPath(request: Request): string {
  const pathname = new URL(request.url).pathname.replace(/\/$/, '') || '/';
  for (const prefix of ['/functions/v1/api', '/api']) {
    if (pathname === prefix) return '/';
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return pathname;
}

function minutesFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function throwDatabase(error: { message: string; code?: string } | null): void {
  if (!error) return;
  const status = error.code === '23505' || error.code === 'P0001'
    ? 409
    : error.code === 'P0002'
      ? 404
      : error.code === '42501'
        ? 403
        : 422;
  throw new ApiError(status, error.message);
}

async function currentProfile(request: Request): Promise<Profile> {
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  fail(token && token !== authorization, 401, 'Authentication required');

  const { data: auth, error: authError } = await db.auth.getUser(token);
  fail(!authError && auth.user, 401, 'Invalid or expired authentication token');
  const { data: profile, error } = await db
    .from('users')
    .select('id,auth_user_id,email,phone,role,status,client_type')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();
  throwDatabase(error);
  fail(profile && profile.status === 'active', 401, 'Account is unavailable');
  return profile as Profile;
}

function requireRole(profile: Profile, ...roles: Role[]): void {
  fail(roles.includes(profile.role), 403, 'This account cannot perform that action');
}

async function serviceExists(id: string): Promise<boolean> {
  const { data, error } = await db.from('service_subcategories').select('id').eq('id', id).maybeSingle();
  throwDatabase(error);
  return Boolean(data);
}

async function requestFor(profile: Profile, id: string): Promise<Record<string, any>> {
  let query = db.from('service_requests').select('*').eq('id', id);
  if (profile.role === 'client') query = query.eq('client_id', profile.id);
  if (profile.role === 'expert') query = query.eq('assigned_expert_id', profile.id);
  const { data, error } = await query.maybeSingle();
  throwDatabase(error);
  fail(data, 404, 'Request not found');
  return data;
}

async function assignmentHistory(requestId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from('request_assignment_logs')
    .select('expert_id')
    .eq('request_id', requestId);
  throwDatabase(error);
  return new Set((data ?? []).map((row) => row.expert_id).filter(Boolean));
}

async function assignRequest(
  requestId: string,
  subcategoryId: string,
  excluded = new Set<string>(),
): Promise<{ expertId: string | null; status: string; responseDueAt: string | null }> {
  const { data: candidates, error } = await db
    .from('expert_subcategories')
    .select('expert_id,updated_at')
    .eq('subcategory_id', subcategoryId)
    .eq('status', 'approved')
    .eq('is_available', true)
    .order('updated_at', { ascending: true });
  throwDatabase(error);
  const expertId = (candidates ?? []).find((row) => !excluded.has(row.expert_id))?.expert_id ?? null;
  const status = expertId ? 'matching' : 'closed';
  const responseDueAt = expertId ? minutesFromNow(expertResponseHours) : null;
  const { error: updateError } = await db
    .from('service_requests')
    .update({ assigned_expert_id: expertId, response_due_at: responseDueAt, status })
    .eq('id', requestId);
  throwDatabase(updateError);
  const { error: logError } = await db.from('request_assignment_logs').insert({
    id: crypto.randomUUID(),
    request_id: requestId,
    expert_id: expertId,
    action: expertId ? 'assigned' : 'experts_exhausted',
  });
  throwDatabase(logError);
  return { expertId, status, responseDueAt };
}

async function walletFor(userId: string): Promise<Record<string, any>> {
  const existing = await db.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  throwDatabase(existing.error);
  if (existing.data) return existing.data;
  const created = await db
    .from('wallets')
    .insert({ id: crypto.randomUUID(), user_id: userId, balance: 0, currency: 'UGX' })
    .select('*')
    .single();
  throwDatabase(created.error);
  return created.data;
}

async function pesapalToken(): Promise<string> {
  const key = Deno.env.get('PESAPAL_CONSUMER_KEY');
  const secret = Deno.env.get('PESAPAL_CONSUMER_SECRET');
  fail(key && secret, 503, 'Pesapal credentials are not configured');
  const result = await fetch(`${pesapalBaseUrl()}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });
  fail(result.ok, 503, 'Pesapal authentication failed');
  const body = await result.json();
  fail(body.token, 503, 'Pesapal did not return an access token');
  return body.token;
}

function pesapalBaseUrl(): string {
  return Deno.env.get('PESAPAL_ENVIRONMENT') === 'production'
    ? 'https://pay.pesapal.com/v3/api'
    : 'https://cybqa.pesapal.com/pesapalv3/api';
}

async function handlePublicServices(): Promise<Response> {
  const { data, error } = await db
    .from('service_subcategories')
    .select('id,category,name,scope_schema,active')
    .eq('active', true)
    .order('name');
  throwDatabase(error);
  return response(data ?? []);
}

async function handlePesapalIpn(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const body = request.method === 'POST' ? await request.clone().json().catch(() => ({})) : {};
  const trackingId = url.searchParams.get('OrderTrackingId') ?? body.OrderTrackingId;
  const merchantReference =
    url.searchParams.get('OrderMerchantReference') ?? body.OrderMerchantReference ?? '';
  fail(trackingId, 400, 'OrderTrackingId is required');
  const token = await pesapalToken();
  const statusResult = await fetch(
    `${pesapalBaseUrl()}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(trackingId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  fail(statusResult.ok, 503, 'Pesapal status check failed');
  const details = await statusResult.json();
  if (details.payment_status_description === 'Completed') {
    const completed = await db.rpc('kaziledger_complete_topup', { p_tracking_id: trackingId });
    throwDatabase(completed.error);
  }
  return response({
    orderNotificationType: 'IPNCHANGE',
    orderTrackingId: trackingId,
    orderMerchantReference: merchantReference,
    status: 200,
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const path = apiPath(request);
    const method = request.method.toUpperCase();
    if (method === 'GET' && path === '/health') return response({ status: 'ok', runtime: 'supabase-edge' });
    if (method === 'GET' && path === '/services') return await handlePublicServices();
    if (path === '/payments/pesapal/ipn' && ['GET', 'POST'].includes(method)) {
      return await handlePesapalIpn(request);
    }

    const profile = await currentProfile(request);
    if (method === 'GET' && path === '/auth/me') return response(profile);
    return await handleProtected(request, path, method, profile);
  } catch (reason) {
    if (reason instanceof ApiError) return response({ detail: reason.message }, reason.status);
    console.error(reason);
    return response({ detail: 'Unexpected server error' }, 500);
  }
});

async function handleProtected(
  request: Request,
  path: string,
  method: string,
  profile: Profile,
): Promise<Response> {
  if (path === '/requests' && method === 'GET') return listRequests(profile);
  if (path === '/requests' && method === 'POST') return createRequest(request, profile);
  if (path === '/quotes' && method === 'GET') return listQuotes(profile);
  if (path === '/quotes' && method === 'POST') return createQuote(request, profile);
  if (path === '/wallet' && method === 'GET') return getWallet(profile);
  if (path === '/wallet/topups/pesapal' && method === 'POST') return startTopup(request, profile);
  if (path === '/wallet/withdrawals' && method === 'POST') return withdraw(request, profile);
  if (path === '/expert/applications' && method === 'GET') return listApplications(profile);
  if (path === '/expert/applications' && method === 'POST') return createApplication(request, profile);
  if (path === '/disputes' && method === 'GET') return listDisputes(profile);
  if (path === '/admin/services' && method === 'GET') return adminServices(profile);
  if (path === '/admin/services' && method === 'POST') return createService(request, profile);
  if (path === '/admin/price-bands' && method === 'POST') return createPriceBand(request, profile);
  if (path === '/admin/users' && method === 'GET') return adminUsers(profile);
  if (path === '/admin/withdrawals' && method === 'GET') return adminWithdrawals(profile);
  if (path === '/admin/jobs/process' && method === 'POST') return processJobs(profile);

  let match = path.match(/^\/requests\/([0-9a-f-]+)$/i);
  if (match && method === 'GET') return getRequest(profile, match[1]);
  match = path.match(/^\/requests\/([0-9a-f-]+)\/(respond|information|resubmit|deliver|complete|disputes)$/i);
  if (match && method === 'POST') return requestAction(request, profile, match[1], match[2]);
  match = path.match(/^\/quotes\/([0-9a-f-]+)\/(decision|charge)$/i);
  if (match && method === 'POST') return quoteAction(request, profile, match[1], match[2]);
  match = path.match(/^\/expert\/services\/([0-9a-f-]+)\/availability$/i);
  if (match && method === 'PATCH') return updateAvailability(request, profile, match[1]);
  match = path.match(/^\/admin\/applications\/([0-9a-f-]+)\/review$/i);
  if (match && method === 'POST') return reviewApplication(request, profile, match[1]);
  match = path.match(/^\/admin\/services\/([0-9a-f-]+)$/i);
  if (match && method === 'PATCH') return updateService(request, profile, match[1]);
  match = path.match(/^\/admin\/users\/([0-9a-f-]+)\/role$/i);
  if (match && method === 'PATCH') return updateUserRole(request, profile, match[1]);
  match = path.match(/^\/admin\/withdrawals\/([0-9a-f-]+)\/review$/i);
  if (match && method === 'POST') return reviewWithdrawal(request, profile, match[1]);
  match = path.match(/^\/admin\/disputes\/([0-9a-f-]+)\/resolve$/i);
  if (match && method === 'POST') return resolveDispute(request, profile, match[1]);

  throw new ApiError(404, 'Endpoint not found');
}

async function listRequests(profile: Profile): Promise<Response> {
  let query = db.from('service_requests').select('*').order('created_at', { ascending: false });
  if (profile.role === 'client') query = query.eq('client_id', profile.id);
  if (profile.role === 'expert') query = query.eq('assigned_expert_id', profile.id);
  const { data, error } = await query;
  throwDatabase(error);
  return response(data ?? []);
}

async function createRequest(request: Request, profile: Profile): Promise<Response> {
  requireRole(profile, 'client');
  const body = await payload<{ subcategory_id: string; scope_details: Record<string, unknown> }>(request);
  fail(body.subcategory_id && (await serviceExists(body.subcategory_id)), 404, 'Service not found');
  const id = crypto.randomUUID();
  const inserted = await db.from('service_requests').insert({
    id,
    client_id: profile.id,
    subcategory_id: body.subcategory_id,
    scope_details: body.scope_details ?? {},
    status: 'closed',
    rejection_count: 0,
  });
  throwDatabase(inserted.error);
  const assigned = await assignRequest(id, body.subcategory_id);
  return response(
    {
      id,
      status: assigned.status,
      assigned_expert_id: assigned.expertId,
      response_due_at: assigned.responseDueAt,
    },
    201,
  );
}

async function getRequest(profile: Profile, id: string): Promise<Response> {
  const item = await requestFor(profile, id);
  const logs = await db
    .from('request_assignment_logs')
    .select('action,reason,expert_id,timestamp')
    .eq('request_id', id)
    .order('timestamp');
  throwDatabase(logs.error);
  const quote = await db
    .from('quotes')
    .select('id,request_id,expert_id,amount,currency,status,expires_at')
    .eq('request_id', id)
    .maybeSingle();
  throwDatabase(quote.error);
  return response({
    id: item.id,
    status: item.status,
    scope_details: item.scope_details,
    rejection_count: item.rejection_count,
    response_due_at: item.response_due_at,
    logs: logs.data ?? [],
    quote: quote.data,
  });
}

async function requestAction(
  request: Request,
  profile: Profile,
  id: string,
  action: string,
): Promise<Response> {
  const item = await requestFor(profile, id);
  if (action === 'respond') {
    requireRole(profile, 'expert');
    fail(['matching', 'needs_info'].includes(item.status), 409, 'This request is no longer awaiting an expert response');
    const body = await payload<{ action: string; reason: string }>(request);
    fail(['more_info', 'reject'].includes(body.action), 422, 'Invalid response action');
    if (body.action === 'more_info') {
      const update = await db
        .from('service_requests')
        .update({ status: 'needs_info', response_due_at: null })
        .eq('id', id);
      throwDatabase(update.error);
      throwDatabase(
        (await db.from('request_assignment_logs').insert({
          id: crypto.randomUUID(), request_id: id, expert_id: profile.id,
          action: 'more_info', reason: body.reason,
        })).error,
      );
      return response({ id, status: 'needs_info', rejection_count: item.rejection_count, assigned_expert_id: profile.id });
    }
    const count = Number(item.rejection_count) + 1;
    throwDatabase(
      (await db.from('request_assignment_logs').insert({
        id: crypto.randomUUID(), request_id: id, expert_id: profile.id,
        action: 'reject', reason: body.reason,
      })).error,
    );
    if (count >= 3) {
      throwDatabase((await db.from('service_requests').update({
        rejection_count: count, assigned_expert_id: null, response_due_at: null, status: 'closed',
      }).eq('id', id)).error);
      return response({ id, status: 'closed', rejection_count: count, assigned_expert_id: null });
    }
    throwDatabase((await db.from('service_requests').update({ rejection_count: count }).eq('id', id)).error);
    const assigned = await assignRequest(id, item.subcategory_id, await assignmentHistory(id));
    return response({ id, status: assigned.status, rejection_count: count, assigned_expert_id: assigned.expertId });
  }

  if (action === 'information' || action === 'resubmit') {
    requireRole(profile, 'client');
    const expected = action === 'information' ? 'needs_info' : 'closed';
    fail(item.status === expected, 409, action === 'information' ? 'This request is not waiting for information' : 'Only closed requests can be resubmitted');
    const body = await payload<{ scope_details: Record<string, unknown> }>(request);
    if (action === 'information') {
      const due = minutesFromNow(expertResponseHours);
      throwDatabase((await db.from('service_requests').update({
        scope_details: body.scope_details, status: 'matching', response_due_at: due,
      }).eq('id', id)).error);
      throwDatabase((await db.from('request_assignment_logs').insert({
        id: crypto.randomUUID(), request_id: id, expert_id: item.assigned_expert_id,
        action: 'client_replied',
      })).error);
      return response({ id, status: 'matching', assigned_expert_id: item.assigned_expert_id });
    }
    throwDatabase((await db.from('service_requests').update({
      scope_details: body.scope_details, rejection_count: 0,
    }).eq('id', id)).error);
    const assigned = await assignRequest(id, item.subcategory_id);
    return response({ id, status: assigned.status, assigned_expert_id: assigned.expertId });
  }

  if (action === 'deliver') {
    requireRole(profile, 'expert');
    fail(['funded', 'in_progress'].includes(item.status), 409, 'This request cannot be delivered yet');
    const body = await payload<{ evidence?: unknown[] }>(request);
    throwDatabase((await db.from('service_requests').update({
      status: 'delivered',
      scope_details: { ...(item.scope_details ?? {}), delivery_evidence: body.evidence ?? [] },
    }).eq('id', id)).error);
    return response({ id, status: 'delivered' });
  }

  if (action === 'complete') {
    requireRole(profile, 'client');
    const result = await db.rpc('kaziledger_complete_request', {
      p_user_id: profile.id, p_request_id: id, p_commission_rate: commissionRate,
    });
    throwDatabase(result.error);
    return response(result.data);
  }

  requireRole(profile, 'client');
  fail(['funded', 'in_progress', 'delivered'].includes(item.status), 409, 'This request is outside its dispute window');
  const body = await payload<{ reason: string; evidence?: unknown[] }>(request);
  const disputeId = crypto.randomUUID();
  throwDatabase((await db.from('disputes').insert({
    id: disputeId, request_id: id, raised_by_id: profile.id,
    reason: body.reason, evidence: body.evidence ?? [], status: 'open',
  })).error);
  throwDatabase((await db.from('service_requests').update({ status: 'disputed' }).eq('id', id)).error);
  throwDatabase((await db.from('escrow_transactions').update({ status: 'disputed' }).eq('request_id', id).in('status', ['funded', 'pending'])).error);
  return response({ id: disputeId, status: 'open' }, 201);
}

async function listQuotes(profile: Profile): Promise<Response> {
  let query = db.from('quotes').select('*').order('created_at', { ascending: false });
  if (profile.role === 'expert') query = query.eq('expert_id', profile.id);
  if (profile.role === 'client') {
    const requests = await db.from('service_requests').select('id').eq('client_id', profile.id);
    throwDatabase(requests.error);
    const ids = (requests.data ?? []).map((item) => item.id);
    if (!ids.length) return response([]);
    query = query.in('request_id', ids);
  }
  const { data, error } = await query;
  throwDatabase(error);
  return response(data ?? []);
}

async function createQuote(request: Request, profile: Profile): Promise<Response> {
  requireRole(profile, 'expert');
  const body = await payload<{ request_id: string; amount: number | string }>(request);
  const item = await requestFor(profile, body.request_id);
  fail(item.status === 'matching', 409, 'This request is not accepting quotes');
  const client = await db.from('users').select('client_type').eq('id', item.client_id).single();
  throwDatabase(client.error);
  fail(client.data, 404, 'Client profile not found');
  const band = await db
    .from('price_bands')
    .select('*')
    .eq('subcategory_id', item.subcategory_id)
    .eq('client_type', client.data.client_type)
    .maybeSingle();
  throwDatabase(band.error);
  const amount = Number(body.amount);
  fail(band.data && amount >= Number(band.data.minimum) && amount <= Number(band.data.maximum), 422, 'Quote must be within the applicable price band');
  const id = crypto.randomUUID();
  const quote = await db.from('quotes').insert({
    id, request_id: item.id, expert_id: profile.id, amount,
    currency: band.data.currency, status: 'pending', expires_at: minutesFromNow(48),
  }).select('*').single();
  throwDatabase(quote.error);
  throwDatabase((await db.from('service_requests').update({ status: 'quoted' }).eq('id', item.id)).error);
  return response(quote.data, 201);
}

async function quoteAction(
  request: Request,
  profile: Profile,
  id: string,
  action: string,
): Promise<Response> {
  if (action === 'charge') {
    requireRole(profile, 'client');
    const result = await db.rpc('kaziledger_charge_wallet', {
      p_user_id: profile.id, p_quote_id: id, p_release_hours: escrowReleaseHours,
    });
    throwDatabase(result.error);
    return response(result.data);
  }
  requireRole(profile, 'client');
  const body = await payload<{ action: 'accept' | 'reject' }>(request);
  fail(['accept', 'reject'].includes(body.action), 422, 'Invalid quote decision');
  const quote = await db.from('quotes').select('*').eq('id', id).maybeSingle();
  throwDatabase(quote.error);
  fail(quote.data, 404, 'Quote not found');
  const item = await requestFor(profile, quote.data.request_id);
  fail(quote.data.status === 'pending' && (!quote.data.expires_at || new Date(quote.data.expires_at) > new Date()), 409, 'Quote is no longer available');
  const quoteStatus = body.action === 'accept' ? 'accepted' : 'rejected';
  throwDatabase((await db.from('quotes').update({ status: quoteStatus }).eq('id', id)).error);
  if (body.action === 'reject') {
    throwDatabase((await db.from('service_requests').update({ status: 'closed' }).eq('id', item.id)).error);
  }
  return response({ id, status: quoteStatus, request_status: body.action === 'reject' ? 'closed' : item.status });
}

async function getWallet(profile: Profile): Promise<Response> {
  const wallet = await walletFor(profile.id);
  const transactions = await db
    .from('wallet_transactions')
    .select('id,type,amount,status,provider,provider_ref,created_at')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false });
  throwDatabase(transactions.error);
  const topups = await db
    .from('wallet_topups')
    .select('id,amount,status,created_at')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false });
  throwDatabase(topups.error);
  return response({
    balance: Number(wallet.balance), currency: wallet.currency,
    transactions: transactions.data ?? [], topups: topups.data ?? [],
  });
}

async function startTopup(request: Request, profile: Profile): Promise<Response> {
  requireRole(profile, 'client');
  const body = await payload<Record<string, string>>(request);
  const amount = Number(body.amount);
  fail(amount > 0 && body.email && body.phone, 422, 'Valid payment details are required');
  const wallet = await walletFor(profile.id);
  const id = crypto.randomUUID();
  throwDatabase((await db.from('wallet_topups').insert({
    id, wallet_id: wallet.id, amount, status: 'pending',
  })).error);
  try {
    const token = await pesapalToken();
    const orderResult = await fetch(`${pesapalBaseUrl()}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `WAL-${id}`,
        currency: 'UGX',
        amount,
        description: 'KaziLedger wallet top-up',
        callback_url: Deno.env.get('PESAPAL_CALLBACK_URL'),
        notification_id: Deno.env.get('PESAPAL_IPN_ID'),
        billing_address: {
          email_address: body.email,
          phone_number: body.phone,
          country_code: 'UG',
          first_name: body.first_name,
          last_name: body.last_name,
        },
      }),
    });
    fail(orderResult.ok, 503, 'Pesapal order creation failed');
    const order = await orderResult.json();
    throwDatabase((await db.from('wallet_topups').update({
      pesapal_tracking_id: order.order_tracking_id,
    }).eq('id', id)).error);
    return response({ id, redirect_url: order.redirect_url, tracking_id: order.order_tracking_id }, 201);
  } catch (reason) {
    await db.from('wallet_topups').delete().eq('id', id);
    throw reason;
  }
}

async function withdraw(request: Request, profile: Profile): Promise<Response> {
  requireRole(profile, 'expert');
  const body = await payload<{ amount: number | string; provider: string }>(request);
  fail(['mtn', 'airtel'].includes(body.provider), 422, 'Unsupported payout provider');
  const result = await db.rpc('kaziledger_withdraw', {
    p_user_id: profile.id, p_amount: Number(body.amount), p_provider: body.provider,
  });
  throwDatabase(result.error);
  return response(result.data, 202);
}

async function listApplications(profile: Profile): Promise<Response> {
  requireRole(profile, 'expert', 'admin');
  let query = db.from('expert_subcategories').select('*').order('created_at', { ascending: false });
  if (profile.role === 'expert') query = query.eq('expert_id', profile.id);
  const { data, error } = await query;
  throwDatabase(error);
  return response(data ?? []);
}

async function createApplication(request: Request, profile: Profile): Promise<Response> {
  requireRole(profile, 'expert');
  const body = await payload<{ subcategory_id: string; documents?: unknown[] }>(request);
  fail(await serviceExists(body.subcategory_id), 404, 'Service not found');
  const existing = await db
    .from('expert_subcategories')
    .select('id')
    .eq('expert_id', profile.id)
    .eq('subcategory_id', body.subcategory_id)
    .in('status', ['pending', 'approved'])
    .limit(1)
    .maybeSingle();
  throwDatabase(existing.error);
  fail(!existing.data, 409, 'An active application already exists for this service');
  const created = await db.from('expert_subcategories').insert({
    id: crypto.randomUUID(), expert_id: profile.id, subcategory_id: body.subcategory_id,
    status: 'pending', documents: body.documents ?? [], is_available: false,
  }).select('*').single();
  throwDatabase(created.error);
  return response(created.data, 201);
}

async function updateAvailability(request: Request, profile: Profile, id: string): Promise<Response> {
  requireRole(profile, 'expert');
  const body = await payload<{ is_available: boolean }>(request);
  const updated = await db.from('expert_subcategories').update({ is_available: body.is_available })
    .eq('id', id).eq('expert_id', profile.id).eq('status', 'approved').select('id,is_available').maybeSingle();
  throwDatabase(updated.error);
  fail(updated.data, 404, 'Approved service not found');
  return response(updated.data);
}

async function listDisputes(profile: Profile): Promise<Response> {
  requireRole(profile, 'admin');
  const result = await db.from('disputes').select('*').order('created_at', { ascending: false });
  throwDatabase(result.error);
  return response(result.data ?? []);
}

async function adminServices(profile: Profile): Promise<Response> {
  requireRole(profile, 'admin');
  const result = await db.from('service_subcategories').select('*').order('category').order('name');
  throwDatabase(result.error);
  return response(result.data ?? []);
}

async function createService(request: Request, profile: Profile): Promise<Response> {
  requireRole(profile, 'admin');
  const body = await payload<Record<string, any>>(request);
  fail(typeof body.name === 'string' && body.name.trim(), 422, 'Service name is required');
  const created = await db.from('service_subcategories').insert({
    id: crypto.randomUUID(), name: body.name.trim(),
    category: body.category?.trim() || 'Professional services',
    scope_schema: body.scope_schema ?? {}, active: true,
  }).select('*').single();
  throwDatabase(created.error);
  return response(created.data, 201);
}

async function updateService(request: Request, profile: Profile, id: string): Promise<Response> {
  requireRole(profile, 'admin');
  const body = await payload<Record<string, any>>(request);
  const changes: Record<string, unknown> = {};
  for (const key of ['name', 'category', 'scope_schema', 'active']) {
    if (key in body) changes[key] = body[key];
  }
  const updated = await db.from('service_subcategories').update(changes).eq('id', id).select('*').maybeSingle();
  throwDatabase(updated.error);
  fail(updated.data, 404, 'Service not found');
  return response(updated.data);
}

async function createPriceBand(request: Request, profile: Profile): Promise<Response> {
  requireRole(profile, 'admin');
  const body = await payload<Record<string, any>>(request);
  const minimum = Number(body.minimum);
  const maximum = Number(body.maximum);
  fail(minimum >= 0 && maximum > minimum, 422, 'Minimum must be below maximum');
  const created = await db.from('price_bands').insert({
    id: crypto.randomUUID(), subcategory_id: body.subcategory_id,
    client_type: body.client_type, minimum, maximum, currency: body.currency ?? 'UGX',
  }).select('*').single();
  throwDatabase(created.error);
  return response(created.data, 201);
}

async function adminUsers(profile: Profile): Promise<Response> {
  requireRole(profile, 'admin');
  const result = await db.from('users').select('id,email,phone,role,status').order('created_at', { ascending: false });
  throwDatabase(result.error);
  return response(result.data ?? []);
}

async function updateUserRole(request: Request, profile: Profile, id: string): Promise<Response> {
  requireRole(profile, 'admin');
  const body = await payload<{ role: Role }>(request);
  fail(['client', 'expert', 'admin'].includes(body.role), 422, 'Invalid role');
  const updated = await db.from('users').update({ role: body.role }).eq('id', id).select('id,role').maybeSingle();
  throwDatabase(updated.error);
  fail(updated.data, 404, 'User not found');
  return response(updated.data);
}

async function reviewApplication(request: Request, profile: Profile, id: string): Promise<Response> {
  requireRole(profile, 'admin');
  const body = await payload<Record<string, any>>(request);
  fail(['approve', 'reject'].includes(body.action), 422, 'Invalid review action');
  fail(body.action !== 'reject' || body.reason, 422, 'A rejection reason is required');
  const updated = await db.from('expert_subcategories').update({
    status: body.action === 'approve' ? 'approved' : 'rejected',
    is_available: body.action === 'approve',
    interview_outcome: body.interview_outcome ?? body.reason ?? null,
    interview_scheduled_at: body.interview_scheduled_at ?? null,
  }).eq('id', id).select('*').maybeSingle();
  throwDatabase(updated.error);
  fail(updated.data, 404, 'Application not found');
  return response({ id, status: updated.data.status, reason: updated.data.interview_outcome });
}

async function adminWithdrawals(profile: Profile): Promise<Response> {
  requireRole(profile, 'admin');
  const result = await db.from('wallet_transactions').select('*')
    .eq('type', 'withdrawal').eq('status', 'pending').order('created_at');
  throwDatabase(result.error);
  return response(result.data ?? []);
}

async function reviewWithdrawal(request: Request, profile: Profile, id: string): Promise<Response> {
  requireRole(profile, 'admin');
  const body = await payload<{ action: string; provider_ref?: string }>(request);
  fail(['confirm', 'fail'].includes(body.action), 422, 'Invalid review action');
  const result = await db.rpc('kaziledger_review_withdrawal', {
    p_transaction_id: id, p_action: body.action, p_provider_ref: body.provider_ref ?? null,
  });
  throwDatabase(result.error);
  return response(result.data);
}

async function resolveDispute(request: Request, profile: Profile, id: string): Promise<Response> {
  requireRole(profile, 'admin');
  const body = await payload<Record<string, any>>(request);
  fail(['release', 'refund', 'partial'].includes(body.resolution), 422, 'Invalid resolution');
  const result = await db.rpc('kaziledger_resolve_dispute', {
    p_admin_id: profile.id,
    p_dispute_id: id,
    p_resolution: body.resolution,
    p_note: body.note ?? null,
    p_amount_to_expert: body.amount_to_expert ?? null,
    p_commission_rate: commissionRate,
  });
  throwDatabase(result.error);
  return response(result.data);
}

async function processJobs(profile: Profile): Promise<Response> {
  requireRole(profile, 'admin');
  const now = new Date().toISOString();
  const timedOut = await db.from('service_requests').select('*')
    .eq('status', 'matching').lt('response_due_at', now);
  throwDatabase(timedOut.error);
  for (const item of timedOut.data ?? []) {
    const count = Number(item.rejection_count) + 1;
    throwDatabase((await db.from('request_assignment_logs').insert({
      id: crypto.randomUUID(), request_id: item.id, expert_id: item.assigned_expert_id,
      action: 'timeout', reason: 'Expert response window expired',
    })).error);
    if (count >= 3) {
      throwDatabase((await db.from('service_requests').update({
        rejection_count: count, assigned_expert_id: null, response_due_at: null, status: 'closed',
      }).eq('id', item.id)).error);
    } else {
      throwDatabase((await db.from('service_requests').update({ rejection_count: count }).eq('id', item.id)).error);
      await assignRequest(item.id, item.subcategory_id, await assignmentHistory(item.id));
    }
  }
  const expired = await db.from('quotes').select('id,request_id').eq('status', 'pending').lt('expires_at', now);
  throwDatabase(expired.error);
  for (const quote of expired.data ?? []) {
    throwDatabase((await db.from('quotes').update({ status: 'expired' }).eq('id', quote.id)).error);
    throwDatabase((await db.from('service_requests').update({ status: 'closed' }).eq('id', quote.request_id).eq('status', 'quoted')).error);
  }
  const released = await db.rpc('kaziledger_release_due_escrows', {
    p_commission_rate: commissionRate,
  });
  throwDatabase(released.error);
  return response({
    timed_out: timedOut.data?.length ?? 0,
    expired_quotes: expired.data?.length ?? 0,
    released_escrows: released.data ?? 0,
  });
}
