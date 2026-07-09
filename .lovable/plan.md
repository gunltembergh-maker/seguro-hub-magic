## Promover alessandro.oliveira@lavoroseguros.com.br a ADMIN

Rodar via ferramenta de inserção de dados (não é mudança de schema):

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'ADMIN' FROM auth.users
WHERE email = 'alessandro.oliveira@lavoroseguros.com.br'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles
SET blocked = false,
    active = true,
    perfil_id = (SELECT id FROM public.perfis_acesso WHERE nome = 'Admin' LIMIT 1)
WHERE email = 'alessandro.oliveira@lavoroseguros.com.br';
```

Efeito: concede role ADMIN, desbloqueia o profile e associa ao perfil "Admin". Após aprovação, basta relogar em `/auth` para entrar no Hub com acesso total.

Pré-requisito: a conta já deve ter sido criada em `/auth` (sign-up) antes — senão o `SELECT id FROM auth.users` retorna vazio e nada acontece.
