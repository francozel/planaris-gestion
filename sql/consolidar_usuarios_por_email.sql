begin;

-- La identidad de acceso siempre se guarda normalizada por email.
update public.usuarios
set email = lower(trim(email))
where email is not null
  and email is distinct from lower(trim(email));

-- Conserva los perfiles indicados y absorbe perfiles con el mismo nombre o email.
do $$
declare
  v_target_email text;
  v_target_id public.usuarios.id%type;
  v_target_name text;
  v_duplicate_id public.usuarios.id%type;
  v_fk record;
begin
  foreach v_target_email in array array[
    'lprofita@gmail.com',
    'francozel@outlook.com'
  ]
  loop
    v_target_id := null;
    v_target_name := null;

    select id, nombre
    into v_target_id, v_target_name
    from public.usuarios
    where email = v_target_email
    order by id::text
    limit 1;

    if v_target_id is null then
      raise exception 'No existe el usuario a conservar: %', v_target_email;
    end if;

    for v_duplicate_id in
      select id
      from public.usuarios
      where id <> v_target_id
        and (
          email = v_target_email
          or (
            v_target_name is not null
            and lower(trim(nombre)) = lower(trim(v_target_name))
          )
        )
    loop
      for v_fk in
        select
          ns.nspname as schema_name,
          cls.relname as table_name,
          att.attname as column_name
        from pg_constraint con
        join pg_class cls on cls.oid = con.conrelid
        join pg_namespace ns on ns.oid = cls.relnamespace
        join pg_class refcls on refcls.oid = con.confrelid
        join pg_namespace refns on refns.oid = refcls.relnamespace
        join lateral unnest(con.conkey) with ordinality cols(attnum, ord)
          on true
        join lateral unnest(con.confkey) with ordinality refcols(attnum, ord)
          on refcols.ord = cols.ord
        join pg_attribute att
          on att.attrelid = con.conrelid and att.attnum = cols.attnum
        join pg_attribute refatt
          on refatt.attrelid = con.confrelid and refatt.attnum = refcols.attnum
        where con.contype = 'f'
          and refns.nspname = 'public'
          and refcls.relname = 'usuarios'
          and refatt.attname = 'id'
      loop
        execute format(
          'update %I.%I set %I = $1 where %I = $2',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name,
          v_fk.column_name
        )
        using v_target_id, v_duplicate_id;
      end loop;

      delete from public.usuarios where id = v_duplicate_id;
    end loop;
  end loop;
end
$$;

-- Consolida cualquier otro perfil repetido por email antes de bloquear duplicados.
do $$
declare
  v_email text;
  v_target_id public.usuarios.id%type;
  v_duplicate_id public.usuarios.id%type;
  v_fk record;
begin
  for v_email in
    select email
    from public.usuarios
    where email is not null
    group by email
    having count(*) > 1
  loop
    select id
    into v_target_id
    from public.usuarios
    where email = v_email
    order by id::text
    limit 1;

    for v_duplicate_id in
      select id
      from public.usuarios
      where email = v_email and id <> v_target_id
    loop
      for v_fk in
        select
          ns.nspname as schema_name,
          cls.relname as table_name,
          att.attname as column_name
        from pg_constraint con
        join pg_class cls on cls.oid = con.conrelid
        join pg_namespace ns on ns.oid = cls.relnamespace
        join pg_class refcls on refcls.oid = con.confrelid
        join pg_namespace refns on refns.oid = refcls.relnamespace
        join lateral unnest(con.conkey) with ordinality cols(attnum, ord)
          on true
        join lateral unnest(con.confkey) with ordinality refcols(attnum, ord)
          on refcols.ord = cols.ord
        join pg_attribute att
          on att.attrelid = con.conrelid and att.attnum = cols.attnum
        join pg_attribute refatt
          on refatt.attrelid = con.confrelid and refatt.attnum = refcols.attnum
        where con.contype = 'f'
          and refns.nspname = 'public'
          and refcls.relname = 'usuarios'
          and refatt.attname = 'id'
      loop
        execute format(
          'update %I.%I set %I = $1 where %I = $2',
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name,
          v_fk.column_name
        )
        using v_target_id, v_duplicate_id;
      end loop;

      delete from public.usuarios where id = v_duplicate_id;
    end loop;
  end loop;
end
$$;

create unique index if not exists usuarios_email_unique_idx
  on public.usuarios (email);

-- Los reintegros asociados a usuarios muestran y conservan el email como identidad.
update public.pagos as pago
set beneficiario = usuario.email
from public.gastos as gasto
join public.usuarios as usuario on usuario.id = gasto.usuario_id
where pago.tipo = 'gasto'
  and pago.referencia_id = gasto.id
  and gasto.usuario_id is not null
  and pago.beneficiario is distinct from usuario.email;

commit;

select id, nombre, email, rol, activo
from public.usuarios
where email in ('lprofita@gmail.com', 'francozel@outlook.com')
order by email;
