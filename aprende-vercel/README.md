# Aprende+ — login, colaborador e RH

Aplicação Next.js para Vercel, com Gemini no servidor, autenticação Supabase e planos persistentes. Esta instalação corresponde a **uma empresa por projeto Supabase**.

## O que existe

- `/login`: entrar, criar conta e terminar sessão. Novas contas são sempre de colaborador.
- `/`: gerar planos com Gemini e guardá-los automaticamente no perfil.
- `/perfil`: editar nome, função, departamento, objetivo, competências e disponibilidade; consultar o histórico; declarar um plano em curso, em pausa ou concluído.
- `/rh`: apenas para contas RH. Contagem de colaboradores registados, com/sem plano, em curso e com o último plano concluído; pesquisa por nome/email/departamento; consulta dos planos de cada colaborador.
- Persistência real no Supabase. Não há dados fictícios no painel RH; o catálogo de formações continua fictício.
- Chave Gemini só no servidor. O antigo código partilhado `APP_ACCESS_CODE` foi substituído por login individual.

## Ativar — passos necessários depois de receber o código

### 1. Criar o projeto de dados

No Supabase, cria um projeto novo para esta aplicação. Em **SQL Editor**, executa todo o ficheiro `supabase/schema.sql`. Depois executa `supabase/verify-security.sql` para verificar as permissões.

O SQL cria as tabelas `profiles` e `learning_plans`, o perfil automático no registo e as políticas Row Level Security. Não concede aos colaboradores permissão para se promoverem a RH.

### 2. Variáveis na Vercel

A Root Directory deste repositório deve ser **aprende-vercel**.

Em Settings > Environment Variables, define:

| Variável | Valor |
| --- | --- |
| `GEMINI_API_KEY` | Chave Gemini já usada pela aplicação |
| `GEMINI_MODEL` | Opcional: ID de um modelo disponível; vazio escolhe automaticamente |
| `SUPABASE_URL` | URL HTTPS do projeto, por exemplo `https://REFERENCIA.supabase.co` |
| `SUPABASE_ANON_KEY` | Chave publishable/anon do projeto Supabase; **não usar service_role** |
| `REGISTRATION_CODE` | Recomendado: código privado que só a equipa recebe para criar contas |

Os dois valores Supabase encontram-se nas definições/API do projeto. Não uses prefixo NEXT_PUBLIC_ nestas variáveis e não publiques chaves reais. O código não precisa da chave administrativa service_role. Remove APP_ACCESS_CODE se ainda existir; deixou de ser usada.

Guarda as variáveis nos ambientes pretendidos e faz **Redeploy**. Sem configuração Supabase, o login apresenta uma mensagem de configuração em falta e as APIs não permitem acesso anónimo.

### 3. Configuração de email

Em Supabase Authentication > URL Configuration, define Site URL para `https://TEU-SITE.vercel.app/login`. Mantém a confirmação de email e usa configuração SMTP adequada para utilizadores reais. Depois do email de confirmação, volta ao login e entra com email/palavra-passe. O serviço Supabase aplica limites de tentativas/envio de emails.

### 4. Criar o primeiro RH

Cria e confirma normalmente a tua conta na página de registo. Depois, como administrador do projeto, executa no SQL Editor:

```sql
update public.profiles
set role = 'rh'
where email = 'O-TEU-EMAIL@empresa.pt';
```

Substitui pelo email real, em minúsculas. Não há escolha pública de perfil RH. O servidor consulta o papel guardado na base de dados em cada pedido. Após a promoção, abre `/rh` ou entra novamente. Para retirar o acesso RH, muda role para `colaborador` pelo SQL Editor.

### 5. Testar com contas distintas

1. Cria duas contas de colaborador e uma RH.
2. O colaborador A gera um plano e consulta-o em `/perfil`.
3. O colaborador B não deve ver os planos de A; um ID copiado de A não lhe dá acesso.
4. O colaborador B não pode abrir `/rh` ou consultar `/api/hr` (403).
5. O RH deve ver dois colaboradores, um com plano e outro sem plano, e os detalhes do plano de A.
6. Termina sessão: `/api/plans`, `/api/models` e `/api/recommend` devem responder 401.
7. Se houver erro ao guardar, a interface avisa: o resultado gerado pode ser exportado e não é apresentado como guardado.

## Estrutura

| Pasta / ficheiro | Responsabilidade |
| --- | --- |
| `app/login`, `app/perfil`, `app/rh` | Páginas de login, perfil e RH |
| `app/api/auth/[action]` | Entrar, registar, sair e consultar/renovar sessão |
| `app/api/profile` | Consultar e editar o próprio perfil |
| `app/api/plans` | Consultar os próprios planos e atualizar o estado |
| `app/api/hr` | Relatório e consulta de colaboradores, só RH |
| `app/api/recommend` | Gemini, validação, planeamento e gravação do plano |
| `app/api/models` | Verificação de modelos Gemini, exige login |
| `lib/auth.ts` | Sessão, cookies HttpOnly, autorização e acesso Supabase com token do utilizador |
| `lib/planner.ts` | Pré-requisitos e limites de tempo |
| `lib/gemini-models.ts` | Modelos disponíveis e erros Google |
| `lib/catalogo.json` | 15 formações fictícias |
| `public/` | JavaScript e estilos da interface |
| `supabase/` | Instalação SQL e verificação de permissões |
| `scripts/` | Testes sem credenciais reais |

## Executar localmente

Node.js 22.13 ou superior:

```bash
npm install
cp .env.example .env.local
# Preenche .env.local com os valores do teu projeto.
npm run dev
```

Verificações:

```bash
npm test
npm run build
```

Os testes automáticos usam chamadas Supabase/Gemini simuladas e cobrem: sessão em falta, atualização de sessão, cookies HttpOnly, acesso RH negado ao colaborador, campos de perfil sem promoção de privilégios, filtros de propriedade dos planos, convite de registo, carga horária e alternativas do catálogo. A instalação real do SQL e o envio de emails precisam de ser testados no teu projeto Supabase.

## Âmbito e limitações

- Os colaboradores são contas registadas, não uma lista importada de todos os trabalhadores da empresa.
- O painel usa o plano mais recente para contar estados. O estado é declarado pelo colaborador e não certifica competências.
- Histórico do perfil e detalhes RH mostram até 100 planos por pessoa. O relatório global pagina os registos e interrompe explicitamente acima de 50 mil linhas por tabela.
- Todos os RH desta instalação podem consultar os colaboradores desta empresa. Não existe segregação entre várias empresas no mesmo projeto.
- Os novos planos são guardados; resultados anteriores ao login não são importados automaticamente.
- Planos gerados no modo Demonstração são locais e não são guardados nem contabilizados pelo RH.
- Reajustes consideram progresso zero. Não há controlo de aulas individuais concluídas.
- Recuperação de palavra-passe não tem página própria nesta entrega; o administrador pode usar as ferramentas de gestão Supabase.
- Um site público para utilização continuada deve acrescentar limites persistentes para os pedidos Gemini e políticas de adesão mais específicas. O login e as políticas de dados já impedem acesso anónimo e acesso cruzado entre colaboradores.

Documentação: https://supabase.com/docs/guides/auth/passwords e https://supabase.com/docs/guides/database/postgres/row-level-security
