# API Backend - Coletor Patrimonial

Backend da aplicacao **Coletor Patrimonial**, desenvolvido em **Node.js + Express** com persistencia local em **SQLite**.

Este servico expoe:
- autenticacao JWT
- cadastro e login de usuarios
- gerenciamento de itens de inventario
- sincronizacao em lote
- catalogos de locais, situacoes e estados
- endpoint de health check

## Tecnologias e dependencias

Principais dependencias usadas no projeto:
- `express`
- `better-sqlite3`
- `jsonwebtoken`
- `bcryptjs`
- `cors`
- `helmet`
- `compression`
- `morgan`
- `express-validator`
- `express-rate-limit`
- `firebase-admin` (opcional)

Requisitos:
- Node.js `>= 16`
- npm

## Instalacao

Entre na pasta da API e instale as dependencias:

```bash
cd api
npm install
```

## Configuracao

Crie um arquivo `.env` dentro da pasta `api` com base no exemplo abaixo.

### Exemplo de `.env`

```env
PORT=3000
NODE_ENV=development

# Obrigatorio: defina uma chave forte e unica. O valor de exemplo abaixo e invalido.
JWT_SECRET=troque-esta-chave-em-producao
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=*

# Recomenda-se usar caminho relativo a partir da pasta /api
DB_PATH=./data/database.sqlite

# Em desenvolvimento o rate limit ja fica desligado por padrao.
# Use true ou false para sobrescrever esse comportamento.
RATE_LIMIT_ENABLED=false

# Firebase e opcional
FIREBASE_CREDENTIALS_PATH=
FIREBASE_SERVICE_ACCOUNT_JSON=
GOOGLE_APPLICATION_CREDENTIALS=
FIREBASE_DATABASE_URL=
```

### Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `PORT` | Nao | Porta do servidor. Padrao: `3000`. |
| `NODE_ENV` | Nao | Ambiente de execucao. Use `development` localmente. |
| `JWT_SECRET` | Sim | Chave usada para assinar os tokens JWT. A API nao inicia sem esse valor no `.env`. |
| `JWT_EXPIRES_IN` | Nao | Expiracao do token de acesso. Padrao: `24h`. |
| `JWT_REFRESH_EXPIRES_IN` | Nao | Expiracao do refresh token. Padrao: `7d`. |
| `CORS_ORIGIN` | Nao | Origem liberada no CORS. Padrao: `*`. |
| `DB_PATH` | Recomendado | Caminho do arquivo SQLite. Recomendado: `./data/database.sqlite`. |
| `RATE_LIMIT_ENABLED` | Nao | Liga ou desliga o rate limit manualmente. |
| `FIREBASE_CREDENTIALS_PATH` | Nao | Caminho para o JSON do service account do Firebase Admin. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Nao | Conteudo JSON inline do service account. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Nao | Alternativa padrao suportada pelo SDK do Google. |
| `FIREBASE_DATABASE_URL` | Nao | URL do projeto Firebase. |

## Como executar

### Desenvolvimento

```bash
cd api
npm run dev
```

### Producao

```bash
cd api
npm start
```

### Testes

```bash
cd api
npm test
```

## Documentacao OpenAPI (Swagger)

Com a API em execucao, a documentacao fica disponivel em:

- Swagger UI: `http://localhost:3000/api/docs`
- Spec OpenAPI JSON: `http://localhost:3000/api/docs/openapi.json`

O arquivo-fonte da especificacao versionada no projeto e:

- `api/api-docs.json`

## Banco de dados

- O banco usado pela API e **SQLite**.
- As tabelas sao criadas automaticamente na inicializacao.
- O arquivo do banco e criado no caminho definido em `DB_PATH`.
- Se o diretorio nao existir, a API cria automaticamente.

Tabelas principais criadas pela API:
- `users`
- `inventory`
- `audit_logs`

## Autenticacao

As rotas protegidas usam **JWT** no header:

```http
Authorization: Bearer SEU_TOKEN
```

Importante:
- o token precisa conter `uid` e `tenantId`
- o login e registro aceitam `tenantId`, `tenant_id` ou `cnpj`
- o header `x-tenant-id` tambem pode ser usado em alguns fluxos de autenticacao

## Endpoints principais

### Health check

- `GET /health`

### Autenticacao

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Inventario

- `GET /api/inventory`
- `POST /api/inventory`
- `POST /api/inventory/sync`
- `GET /api/inventory/resultado`
- `GET /api/inventory/:id`
- `PUT /api/inventory/:id`
- `DELETE /api/inventory/:id`
- `GET /api/inventory/code/:code`
- `PUT /api/inventory/code/:code`
- `DELETE /api/inventory/by-inventario`
- `DELETE /api/inventory/tenant`

### Catalogos

- `GET /api/catalogs/locais`
- `GET /api/catalogs/situacoes`
- `GET /api/catalogs/estados`

### Usuario autenticado

- `GET /api/users/profile`
- `PATCH /api/users/me`
- `DELETE /api/users/:id`

## Rate limit

- Em `development`, o rate limit fica **desativado por padrao**.
- Em outros ambientes, ele fica **ativado por padrao**.
- Se precisar forcar o comportamento, use `RATE_LIMIT_ENABLED=true` ou `RATE_LIMIT_ENABLED=false`.

## Firebase

O projeto ainda possui dependencia de `firebase-admin`, mas o fluxo principal de autenticacao atual e por **JWT + SQLite**.

Hoje o Firebase e **opcional** e serve apenas para cenarios auxiliares, como a tentativa de criar usuario correspondente no Firebase Admin durante o registro.

Se as credenciais do Firebase nao estiverem configuradas:
- a API continua funcionando
- o login JWT continua funcionando
- podem aparecer apenas avisos no console relacionados ao Firebase

## Estrutura basica

```text
api/
  config/
  controllers/
  db/
  middleware/
  repositories/
  routes/
  src/
  package.json
  README.md
```

## Publicacao no GitHub

Para quem for clonar o projeto, o fluxo recomendado e:

```bash
git clone <url-do-repositorio>
cd coletorpatrimonial/api
npm install
npm run dev
```

Antes de rodar, copie o arquivo `.env.example` para `.env` e ajuste os valores necessarios.

Depois disso, valide se a API subiu corretamente:

```bash
curl http://localhost:3000/health
```

## Observacoes importantes

- A API nao inicia se `JWT_SECRET` estiver ausente ou ainda com o placeholder `troque-esta-chave-em-producao`.
- Recomenda-se definir explicitamente `DB_PATH` no `.env`.
- As rotas de inventario, catalogos e usuarios exigem autenticacao.
- A UI Swagger consome a especificacao versionada em `api/api-docs.json`.
