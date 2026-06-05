begin;

create table if not exists public.ordenes_pago (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  fecha date not null,
  beneficiario text,
  observaciones text not null default '',
  created_at timestamptz not null default now()
);

alter table public.pagos
  add column if not exists orden_pago_id uuid references public.ordenes_pago(id) on delete cascade;

create table if not exists public.ordenes_pago_medios (
  id uuid primary key default gen_random_uuid(),
  orden_pago_id uuid not null references public.ordenes_pago(id) on delete cascade,
  medio_pago text not null,
  importe numeric not null check (importe > 0),
  banco text not null default '',
  numero_operacion text not null default '',
  numero_cheque text not null default '',
  fecha_emision date,
  fecha_pago date,
  created_at timestamptz not null default now()
);

create table if not exists public.ordenes_pago_retenciones (
  id uuid primary key default gen_random_uuid(),
  orden_pago_id uuid not null references public.ordenes_pago(id) on delete cascade,
  tipo text not null,
  importe numeric not null check (importe > 0),
  created_at timestamptz not null default now()
);

create index if not exists pagos_orden_pago_id_idx
  on public.pagos(orden_pago_id);
create index if not exists ordenes_pago_medios_orden_idx
  on public.ordenes_pago_medios(orden_pago_id);
create index if not exists ordenes_pago_retenciones_orden_idx
  on public.ordenes_pago_retenciones(orden_pago_id);

-- Convierte cada pago historico sin agrupacion en una orden independiente.
do $$
declare
  pago_record record;
  nueva_orden_id uuid;
begin
  for pago_record in
    select *
    from public.pagos
    where orden_pago_id is null
    order by fecha, id
  loop
    insert into public.ordenes_pago (fecha, beneficiario, observaciones)
    values (
      pago_record.fecha,
      pago_record.beneficiario,
      coalesce(pago_record.observaciones, '')
    )
    returning id into nueva_orden_id;

    update public.pagos
    set orden_pago_id = nueva_orden_id
    where id = pago_record.id;

    insert into public.ordenes_pago_medios (
      orden_pago_id,
      medio_pago,
      importe,
      banco,
      numero_cheque,
      fecha_emision,
      fecha_pago
    )
    values (
      nueva_orden_id,
      coalesce(nullif(pago_record.medio_pago, ''), 'Otro'),
      greatest(abs(coalesce(pago_record.importe, 0)), 0.01),
      coalesce(pago_record.banco, ''),
      coalesce(pago_record.numero_cheque, ''),
      pago_record.fecha_emision,
      pago_record.fecha_pago
    );
  end loop;
end $$;

alter table public.pagos
  alter column orden_pago_id set not null;

commit;

select
  op.numero,
  op.fecha,
  op.beneficiario,
  count(distinct p.id) as imputaciones,
  count(distinct m.id) as medios_pago
from public.ordenes_pago op
left join public.pagos p on p.orden_pago_id = op.id
left join public.ordenes_pago_medios m on m.orden_pago_id = op.id
group by op.id, op.numero, op.fecha, op.beneficiario
order by op.numero desc;
