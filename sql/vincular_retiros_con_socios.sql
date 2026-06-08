begin;

alter table public.retiros_socios
  add column if not exists usuario_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.retiros_socios'::regclass
      and conname = 'retiros_socios_usuario_id_fkey'
  ) then
    alter table public.retiros_socios
      add constraint retiros_socios_usuario_id_fkey
      foreign key (usuario_id)
      references public.usuarios(id);
  end if;
end $$;

create index if not exists retiros_socios_usuario_id_idx
  on public.retiros_socios(usuario_id);

commit;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'retiros_socios'
order by ordinal_position;
