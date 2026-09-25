-- Publish the non-sensitive launch catalogue without creating demo users or
-- production credentials. Administrators can maintain these rows through the API.

insert into public.service_subcategories (id, category, name, scope_schema, active)
values
  ('00000000-0000-4000-8000-000000000101', 'Finance & accounting', 'Bookkeeping', '{"required":["description","deadline"]}', true),
  ('00000000-0000-4000-8000-000000000102', 'Finance & accounting', 'Tax filing & compliance', '{"required":["description","deadline"]}', true),
  ('00000000-0000-4000-8000-000000000103', 'Business operations', 'Payroll management', '{"required":["description","deadline"]}', true),
  ('00000000-0000-4000-8000-000000000104', 'Legal & compliance', 'Business registration', '{"required":["description","deadline"]}', true),
  ('00000000-0000-4000-8000-000000000105', 'Technology', 'Website development', '{"required":["description","deadline"]}', true),
  ('00000000-0000-4000-8000-000000000106', 'Creative services', 'Brand & graphic design', '{"required":["description","deadline"]}', true)
on conflict (name) do nothing;

insert into public.price_bands (id, subcategory_id, client_type, minimum, maximum, currency)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'individual', 150000, 1200000, 'UGX'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101', 'business', 225000, 1800000, 'UGX'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000102', 'individual', 250000, 2500000, 'UGX'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000102', 'business', 375000, 3750000, 'UGX'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000103', 'individual', 200000, 1800000, 'UGX'),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000103', 'business', 300000, 2700000, 'UGX'),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000104', 'individual', 200000, 1800000, 'UGX'),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000104', 'business', 300000, 2700000, 'UGX'),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000105', 'individual', 400000, 5000000, 'UGX'),
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000105', 'business', 600000, 7500000, 'UGX'),
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000106', 'individual', 150000, 2500000, 'UGX'),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000106', 'business', 225000, 3750000, 'UGX')
on conflict (subcategory_id, client_type) do nothing;
