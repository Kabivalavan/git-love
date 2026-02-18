-- Fix function search path warnings
create or replace function public.generate_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_number text;
begin
  new_number := 'ORD' || to_char(now(), 'YYYYMMDD') || lpad(floor(random() * 10000)::text, 4, '0');
  return new_number;
end;
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;