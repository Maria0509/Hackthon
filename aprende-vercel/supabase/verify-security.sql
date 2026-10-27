-- Executar no SQL Editor após schema.sql. Não altera dados.
do $$
begin
 if has_column_privilege('authenticated','public.profiles','role','UPDATE') then raise exception 'Falha: utilizadores podem alterar role'; end if;
 if has_table_privilege('authenticated','public.profiles','INSERT') then raise exception 'Falha: utilizadores podem criar perfis arbitrários'; end if;
 if has_table_privilege('anon','public.profiles','SELECT') then raise exception 'Falha: perfis expostos sem login'; end if;
 if has_table_privilege('anon','public.learning_plans','SELECT') then raise exception 'Falha: planos expostos sem login'; end if;
 if not (select relrowsecurity from pg_class where oid='public.profiles'::regclass) then raise exception 'RLS desativada em profiles'; end if;
 if not (select relrowsecurity from pg_class where oid='public.learning_plans'::regclass) then raise exception 'RLS desativada em learning_plans'; end if;
 raise notice 'Permissões e RLS verificadas. Testar também com duas contas colaborador e uma RH.';
end;$$;
