-- Atomic operations used by the Supabase Edge Function API. These functions
-- are callable only with Supabase's server-side service role.

create or replace function public.kaziledger_charge_wallet(
  p_user_id uuid,
  p_quote_id uuid,
  p_release_hours integer default 72
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  quote_row public.quotes%rowtype;
  request_row public.service_requests%rowtype;
  wallet_row public.wallets%rowtype;
  escrow_id uuid := gen_random_uuid();
begin
  select * into quote_row from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;

  select * into request_row from public.service_requests
  where id = quote_row.request_id and client_id = p_user_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if quote_row.status <> 'accepted' then
    raise exception 'Accept the quote before charging your wallet' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.escrow_transactions
    where request_id = request_row.id and status in ('pending', 'funded', 'disputed')
  ) then
    raise exception 'This request already has funded escrow' using errcode = 'P0001';
  end if;

  select * into wallet_row from public.wallets where user_id = p_user_id for update;
  if not found then
    insert into public.wallets (id, user_id, balance, currency)
    values (gen_random_uuid(), p_user_id, 0, quote_row.currency)
    returning * into wallet_row;
  end if;
  if wallet_row.balance < quote_row.amount then
    raise exception 'Insufficient wallet balance' using errcode = '22003';
  end if;

  update public.wallets set balance = balance - quote_row.amount, updated_at = now()
  where id = wallet_row.id returning * into wallet_row;
  insert into public.escrow_transactions (id, request_id, amount, status, release_at)
  values (
    escrow_id,
    request_row.id,
    quote_row.amount,
    'funded',
    now() + make_interval(hours => p_release_hours)
  );
  insert into public.wallet_transactions (
    id, wallet_id, type, amount, status, escrow_id
  ) values (
    gen_random_uuid(), wallet_row.id, 'escrow_hold', -quote_row.amount, 'confirmed', escrow_id
  );
  update public.quotes set status = 'funded', updated_at = now() where id = quote_row.id;
  update public.service_requests set status = 'funded'::public.requeststatus, updated_at = now()
  where id = request_row.id;

  return jsonb_build_object(
    'id', escrow_id,
    'status', 'funded',
    'wallet_balance', wallet_row.balance
  );
end;
$$;

create or replace function public.kaziledger_complete_request(
  p_user_id uuid,
  p_request_id uuid,
  p_commission_rate numeric default 0.10
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  request_row public.service_requests%rowtype;
  escrow_row public.escrow_transactions%rowtype;
  wallet_row public.wallets%rowtype;
  commission numeric(18,2);
  net numeric(18,2);
begin
  select * into request_row from public.service_requests
  where id = p_request_id and client_id = p_user_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if request_row.status <> 'delivered'::public.requeststatus then
    raise exception 'The request is not ready for completion' using errcode = 'P0001';
  end if;
  select * into escrow_row from public.escrow_transactions
  where request_id = request_row.id and status = 'funded' for update;
  if not found or request_row.assigned_expert_id is null then
    raise exception 'The request is not ready for completion' using errcode = 'P0001';
  end if;

  commission := round(escrow_row.amount * p_commission_rate, 2);
  net := escrow_row.amount - commission;
  select * into wallet_row from public.wallets
  where user_id = request_row.assigned_expert_id or expert_id = request_row.assigned_expert_id
  order by (user_id is not null) desc limit 1 for update;
  if not found then
    insert into public.wallets (id, expert_id, user_id, balance, currency)
    values (
      gen_random_uuid(), request_row.assigned_expert_id,
      request_row.assigned_expert_id, 0, 'UGX'
    ) returning * into wallet_row;
  end if;
  update public.wallets set balance = balance + net, user_id = request_row.assigned_expert_id,
    updated_at = now() where id = wallet_row.id returning * into wallet_row;
  insert into public.wallet_transactions (id, wallet_id, type, amount, status, escrow_id)
  values (gen_random_uuid(), wallet_row.id, 'escrow_release', net, 'confirmed', escrow_row.id);
  update public.escrow_transactions set status = 'released', updated_at = now()
  where id = escrow_row.id;
  update public.service_requests set status = 'completed'::public.requeststatus, updated_at = now()
  where id = request_row.id;

  return jsonb_build_object(
    'status', 'released', 'amount_to_expert', net, 'commission', commission
  );
end;
$$;

create or replace function public.kaziledger_withdraw(
  p_user_id uuid,
  p_amount numeric,
  p_provider text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  wallet_row public.wallets%rowtype;
  transaction_id uuid := gen_random_uuid();
begin
  if p_amount <= 0 then raise exception 'Amount must be positive' using errcode = '22003'; end if;
  select * into wallet_row from public.wallets where user_id = p_user_id for update;
  if not found or wallet_row.balance < p_amount then
    raise exception 'Insufficient available balance' using errcode = '22003';
  end if;
  update public.wallets set balance = balance - p_amount, updated_at = now()
  where id = wallet_row.id;
  insert into public.wallet_transactions (
    id, wallet_id, type, amount, status, provider
  ) values (
    transaction_id, wallet_row.id, 'withdrawal', -p_amount, 'pending', p_provider
  );
  return jsonb_build_object(
    'id', transaction_id,
    'status', 'pending',
    'provider', p_provider,
    'message', 'Payout queued for gateway confirmation'
  );
end;
$$;

create or replace function public.kaziledger_review_withdrawal(
  p_transaction_id uuid,
  p_action text,
  p_provider_ref text default null
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  transaction_row public.wallet_transactions%rowtype;
  next_status text;
begin
  select * into transaction_row from public.wallet_transactions
  where id = p_transaction_id and type = 'withdrawal' and status = 'pending' for update;
  if not found then raise exception 'Pending withdrawal not found' using errcode = 'P0002'; end if;
  next_status := case when p_action = 'confirm' then 'confirmed' else 'failed' end;
  update public.wallet_transactions set status = next_status, provider_ref = p_provider_ref
  where id = transaction_row.id;
  if next_status = 'failed' then
    update public.wallets set balance = balance + abs(transaction_row.amount), updated_at = now()
    where id = transaction_row.wallet_id;
  end if;
  return jsonb_build_object('id', transaction_row.id, 'status', next_status);
end;
$$;

create or replace function public.kaziledger_complete_topup(
  p_tracking_id text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  topup_row public.wallet_topups%rowtype;
begin
  select * into topup_row from public.wallet_topups
  where pesapal_tracking_id = p_tracking_id for update;
  if not found then raise exception 'Wallet top-up not found' using errcode = 'P0002'; end if;
  if topup_row.status <> 'completed' then
    update public.wallets set balance = balance + topup_row.amount, updated_at = now()
    where id = topup_row.wallet_id;
    update public.wallet_topups set status = 'completed', updated_at = now()
    where id = topup_row.id;
    insert into public.wallet_transactions (
      id, wallet_id, type, amount, status, provider, provider_ref
    ) values (
      gen_random_uuid(), topup_row.wallet_id, 'top_up', topup_row.amount,
      'confirmed', 'pesapal', p_tracking_id
    );
  end if;
  return jsonb_build_object('id', topup_row.id, 'status', 'completed');
end;
$$;

create or replace function public.kaziledger_resolve_dispute(
  p_admin_id uuid,
  p_dispute_id uuid,
  p_resolution text,
  p_note text default null,
  p_amount_to_expert numeric default null,
  p_commission_rate numeric default 0.10
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  dispute_row public.disputes%rowtype;
  request_row public.service_requests%rowtype;
  escrow_row public.escrow_transactions%rowtype;
  expert_wallet public.wallets%rowtype;
  client_wallet public.wallets%rowtype;
  gross numeric(18,2) := 0;
  commission numeric(18,2) := 0;
  net numeric(18,2) := 0;
  refund numeric(18,2) := 0;
begin
  if not exists (
    select 1 from public.users where id = p_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;
  if p_resolution not in ('release', 'refund', 'partial') then
    raise exception 'Invalid dispute resolution' using errcode = '22023';
  end if;

  select * into dispute_row from public.disputes
  where id = p_dispute_id and status = 'open' for update;
  if not found then raise exception 'Open dispute not found' using errcode = 'P0002'; end if;

  select * into request_row from public.service_requests
  where id = dispute_row.request_id for update;
  if not found or request_row.assigned_expert_id is null then
    raise exception 'The escrow has no assigned expert' using errcode = 'P0001';
  end if;

  select * into escrow_row from public.escrow_transactions
  where request_id = request_row.id and status in ('funded', 'disputed')
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Active escrow not found' using errcode = 'P0002'; end if;

  if p_resolution = 'release' then
    gross := escrow_row.amount;
  elsif p_resolution = 'partial' then
    if p_amount_to_expert is null or p_amount_to_expert < 0 or p_amount_to_expert > escrow_row.amount then
      raise exception 'Invalid partial release amount' using errcode = '22003';
    end if;
    gross := p_amount_to_expert;
  end if;
  refund := escrow_row.amount - gross;

  if gross > 0 then
    commission := round(gross * p_commission_rate, 2);
    net := gross - commission;
    select * into expert_wallet from public.wallets
    where user_id = request_row.assigned_expert_id or expert_id = request_row.assigned_expert_id
    order by (user_id is not null) desc limit 1 for update;
    if not found then
      insert into public.wallets (id, expert_id, user_id, balance, currency)
      values (
        gen_random_uuid(), request_row.assigned_expert_id,
        request_row.assigned_expert_id, 0, 'UGX'
      ) returning * into expert_wallet;
    end if;
    update public.wallets
    set balance = balance + net,
        user_id = coalesce(user_id, request_row.assigned_expert_id),
        updated_at = now()
    where id = expert_wallet.id returning * into expert_wallet;
    insert into public.wallet_transactions (id, wallet_id, type, amount, status, escrow_id)
    values (gen_random_uuid(), expert_wallet.id, 'escrow_release', net, 'confirmed', escrow_row.id);
  end if;

  if refund > 0 then
    select * into client_wallet from public.wallets
    where user_id = request_row.client_id for update;
    if not found then
      insert into public.wallets (id, user_id, balance, currency)
      values (gen_random_uuid(), request_row.client_id, 0, 'UGX')
      returning * into client_wallet;
    end if;
    update public.wallets set balance = balance + refund, updated_at = now()
    where id = client_wallet.id returning * into client_wallet;
    insert into public.wallet_transactions (id, wallet_id, type, amount, status, escrow_id)
    values (gen_random_uuid(), client_wallet.id, 'escrow_refund', refund, 'confirmed', escrow_row.id);
  end if;

  update public.escrow_transactions
  set status = case when gross = 0 then 'refunded' else 'released' end, updated_at = now()
  where id = escrow_row.id;
  update public.service_requests
  set status = case
      when gross = 0 then 'closed'::public.requeststatus
      else 'completed'::public.requeststatus
    end,
    updated_at = now()
  where id = request_row.id;
  update public.disputes
  set status = 'resolved', resolution = p_resolution, resolution_note = p_note, updated_at = now()
  where id = dispute_row.id;

  return jsonb_build_object(
    'id', dispute_row.id,
    'status', case when gross = 0 then 'refunded' else 'released' end,
    'amount_to_expert', net,
    'amount_refunded', refund,
    'commission', commission
  );
end;
$$;

create or replace function public.kaziledger_release_due_escrows(
  p_commission_rate numeric default 0.10
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  escrow_row public.escrow_transactions%rowtype;
  request_row public.service_requests%rowtype;
  wallet_row public.wallets%rowtype;
  commission numeric(18,2);
  net numeric(18,2);
  released_count integer := 0;
begin
  for escrow_row in
    select * from public.escrow_transactions
    where status = 'funded' and release_at is not null and release_at < now()
    order by release_at for update skip locked
  loop
    select * into request_row from public.service_requests
    where id = escrow_row.request_id for update;
    if not found or request_row.assigned_expert_id is null then
      continue;
    end if;

    commission := round(escrow_row.amount * p_commission_rate, 2);
    net := escrow_row.amount - commission;
    select * into wallet_row from public.wallets
    where user_id = request_row.assigned_expert_id or expert_id = request_row.assigned_expert_id
    order by (user_id is not null) desc limit 1 for update;
    if not found then
      insert into public.wallets (id, expert_id, user_id, balance, currency)
      values (
        gen_random_uuid(), request_row.assigned_expert_id,
        request_row.assigned_expert_id, 0, 'UGX'
      ) returning * into wallet_row;
    end if;
    update public.wallets
    set balance = balance + net,
        user_id = coalesce(user_id, request_row.assigned_expert_id),
        updated_at = now()
    where id = wallet_row.id;
    insert into public.wallet_transactions (id, wallet_id, type, amount, status, escrow_id)
    values (gen_random_uuid(), wallet_row.id, 'escrow_release', net, 'confirmed', escrow_row.id);
    update public.escrow_transactions set status = 'released', updated_at = now()
    where id = escrow_row.id;
    update public.service_requests set status = 'completed'::public.requeststatus, updated_at = now()
    where id = request_row.id;
    released_count := released_count + 1;
  end loop;
  return released_count;
end;
$$;

revoke all on function public.kaziledger_charge_wallet(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.kaziledger_complete_request(uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.kaziledger_withdraw(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.kaziledger_review_withdrawal(uuid, text, text) from public, anon, authenticated;
revoke all on function public.kaziledger_complete_topup(text) from public, anon, authenticated;
revoke all on function public.kaziledger_resolve_dispute(uuid, uuid, text, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.kaziledger_release_due_escrows(numeric) from public, anon, authenticated;

grant execute on function public.kaziledger_charge_wallet(uuid, uuid, integer) to service_role;
grant execute on function public.kaziledger_complete_request(uuid, uuid, numeric) to service_role;
grant execute on function public.kaziledger_withdraw(uuid, numeric, text) to service_role;
grant execute on function public.kaziledger_review_withdrawal(uuid, text, text) to service_role;
grant execute on function public.kaziledger_complete_topup(text) to service_role;
grant execute on function public.kaziledger_resolve_dispute(uuid, uuid, text, text, numeric, numeric) to service_role;
grant execute on function public.kaziledger_release_due_escrows(numeric) to service_role;
