begin;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.usuarios'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%rol%'
  loop
    execute format(
      'alter table public.usuarios drop constraint %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table public.usuarios
  add constraint usuarios_rol_valido
  check (rol in ('socio', 'administracion', 'usuario', 'admin'));

commit;

select rol, count(*)
from public.usuarios
group by rol
order by rol;
