begin;

alter table public.ordenes_pago_medios
  add column if not exists cobro_origen_id uuid references public.cobros(id);

create unique index if not exists ordenes_pago_medios_cobro_origen_unique_idx
  on public.ordenes_pago_medios(cobro_origen_id)
  where cobro_origen_id is not null;

commit;

select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'ordenes_pago_medios'
  and column_name = 'cobro_origen_id';
