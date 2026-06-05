begin;

-- Los gastos pagados directamente por Planaris no pertenecen a un usuario.
-- La clave foranea se conserva para validar los gastos que si tienen usuario.
alter table public.gastos
  alter column usuario_id drop not null;

commit;

select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'gastos'
  and column_name = 'usuario_id';
