# KaziLedger service sourcing platform

KaziLedger is a professional-services marketplace for East Africa. It connects clients with independently vetted experts across multiple service categories, enforces category/client-type price bands, rotates rejected requests through up to three available experts, lets clients top up wallets through Pesapal, protects approved service fees in escrow, and credits released earnings to expert wallets.

## Included

- React web client built with shadcn/ui and Tailwind CSS
- Supabase Edge Function API backed by Supabase Postgres
- Client, expert, and administrator product surfaces
- Configurable expert timeout, escrow release window, commission rate, and currency
- Pesapal API 3.0 wallet top-ups, callback/IPN status verification, and sandbox/production switching
- MTN and Airtel withdrawal model with pending/confirmed transaction states
- Supabase email/password authentication with database-backed application roles
- Dynamic permission-ready authorization model, expert availability, assignment audit logs, price-band validation, consent tracking, and sensitive-document boundaries

## Serverless deployment

The production architecture has only two deployed pieces:

- Vercel hosts the static client from `client/`.
- Supabase provides Auth, Postgres, and the `api` Edge Function from
  `supabase/functions/api/`.

The Python application in `backend/` is retained as a legacy local/reference
implementation. It is not required in production, and no database password or
server-side Supabase key belongs in Vercel.

### 1. Apply the Supabase schema and deploy the function

From the repository root, authenticate and link the CLI once, then push the
migrations and function:

```bash
npx supabase login
npx supabase link --project-ref cvhpsnljabfilivrfuyq
npx supabase db push
npx supabase functions deploy api --project-ref cvhpsnljabfilivrfuyq --use-api
```

Supabase automatically provides `SUPABASE_URL` and its server-side key to the
Edge Function. Configure the optional payment and workflow settings as Function
secrets, never as Vercel variables:

```bash
npx supabase secrets set --project-ref cvhpsnljabfilivrfuyq \
  PESAPAL_ENVIRONMENT=sandbox \
  PESAPAL_CONSUMER_KEY=your-key \
  PESAPAL_CONSUMER_SECRET=your-secret \
  PESAPAL_IPN_ID=your-notification-id \
  PESAPAL_CALLBACK_URL=https://your-project.vercel.app/dashboard/payments \
  EXPERT_RESPONSE_HOURS=24 \
  ESCROW_RELEASE_HOURS=72 \
  PLATFORM_COMMISSION_RATE=0.10
```

Register this public webhook URL with Pesapal:

```text
https://cvhpsnljabfilivrfuyq.supabase.co/functions/v1/api/payments/pesapal/ipn
```

### 2. Deploy only the client to Vercel

Create a Vercel project whose root directory is `client`. Add exactly these
required environment variables for Production, Preview, and Development:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://cvhpsnljabfilivrfuyq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`NEXT_PUBLIC_API_URL` is optional and should normally remain unset. The client
derives the API endpoint as `/functions/v1/api` on the configured Supabase
project. Never put a database connection string, database password,
`service_role` key, or Supabase secret key in Vercel.

In Supabase Dashboard, add the production Vercel domain and any preview/local
URLs to Authentication → URL Configuration → Redirect URLs. Include `/login`
so email confirmation and password-recovery links can return to the app.

### 3. Run the client locally

Copy `client/.env.example` to `client/.env`, then run:

```bash
cd client
corepack enable
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 3000
```

By default, local development also calls the deployed Supabase Edge Function.
Set `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` only when deliberately
testing the legacy FastAPI implementation.

### Authentication and authorization

Supabase Auth owns passwords, email confirmation, and browser sessions. The
Edge Function verifies the access token on every protected request and loads
the application role from `public.users`. Business tables have row-level
security enabled without browser-access policies; privileged database access
stays inside the Edge Function.

Public sign-up can create only `client` or `expert` profiles. To provision an
administrator, create the account in Supabase Authentication, then set that
profile's `public.users.role` to `admin` through a trusted administrative
workflow. Never accept an `admin` role from browser metadata.

## Legacy FastAPI local setup

Run PostgreSQL in Docker, and run the backend and client independently on your machine.
Prerequisites: Docker with Compose, Python 3.12+, Node.js 22.13+ (the client Dockerfile uses Node 24),
and pnpm 10.33.2 (the version pinned in `client/package.json`).

### 1. Start PostgreSQL

From the `KaziLedger` folder:

```bash
./run-local.sh
# Equivalent: docker compose up -d postgres
```

Compose starts only PostgreSQL 15 on `localhost:5431`, with database `kaziledger`,
username `postgres`, and password `postgres`. Wait for `docker compose ps` to show
it as healthy before starting the backend. Database data persists in the
`postgres_data` volume.

If you previously ran the full Docker stack, run `docker compose down --remove-orphans`
once before starting PostgreSQL to remove the old API and web containers and free
ports 8000 and 3000. This preserves the database volume.

### 2. Start the backend

In a separate terminal, from `KaziLedger` (first-time setup):

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env

# Terminal 2 — backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Keep any existing `.env` instead of overwriting it. Add the Supabase project URL
and publishable key to both backend and client environment files. The publishable
key is safe to use in a browser; never put a Supabase secret or `service_role` key
in the client.

Start the API from the `backend` directory with the virtual environment activated:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

On later runs, only activate `.venv` and run the Uvicorn command. The API creates
missing tables and seeds demo data on startup if the service catalogue is empty.

### 3. Start the client

In another terminal, from `KaziLedger` (first-time setup):

```bash
cd client
source ~/.nvm/nvm.sh  # Load nvm in a new terminal, if nvm is not already available
nvm install  # Uses Node 24 from .nvmrc (requires nvm)
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env

Localy
# Terminal 3 — client
cd client
source ~/.nvm/nvm.sh
nvm use
pnpm dev --host 127.0.0.1 --port 3000
```

Keep any existing `.env` instead of overwriting it. The example sets the local API
URL and the KaziLedger Supabase project settings.

Start the web development server from the `client` directory:

```bash
pnpm dev --host 127.0.0.1 --port 3000
```

On later runs, run `source ~/.nvm/nvm.sh && nvm use` in the client directory before `pnpm dev`. Both development servers
reload source changes.

### Serve the built client from FastAPI

Build the client with same-origin API requests, then restart FastAPI:

```bash
cd client
source ~/.nvm/nvm.sh
nvm use
NEXT_PUBLIC_API_URL=/api/v1 pnpm build

cd ../backend
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The client build automatically replaces `backend/static` with the latest static
export. Open `http://localhost:8000`; FastAPI serves only that directory while
preserving `/api/v1`, `/docs`, and `/health`. Restart FastAPI after the first
build if it was already running without a static directory.

### Legacy Supabase and separate API deployment

The repository includes a Supabase CLI workspace and schema migrations.
Supabase Auth owns passwords and browser sessions. The browser sends the Supabase
access token to FastAPI, FastAPI validates it with Supabase Auth, and application
roles are loaded from `public.users`. The browser does not receive the database
password or query KaziLedger business tables through the Data API. Row-level
security is enabled on those tables without public policies.

Initialize and link the workspace once from the repository root:

```bash
npx supabase login
npx supabase link --project-ref cvhpsnljabfilivrfuyq
npx supabase db push
```

For a serverless FastAPI deployment, use Supabase's **Transaction pooler** connection
string (port `6543`) rather than the direct database URL. Configure these environment
variables in the API host; never add their production values to Git:

```dotenv
APP_ENV=production
DATABASE_URL=postgresql://postgres.PROJECT_REF:DB_PASSWORD@POOLER_HOST:6543/postgres
DATABASE_POOL_MODE=transaction
DATABASE_SSL=true
SUPABASE_URL=https://cvhpsnljabfilivrfuyq.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
CLIENT_URL=https://your-client-domain.example
CLIENT_URLS=https://your-project.vercel.app
AUTO_CREATE_SCHEMA=false
SEED_DEMO_DATA=false
```

The separate FastAPI deployment described below is retained only for legacy hosting.
The recommended deployment uses the Supabase Edge Function and does not deploy
`backend/` to Vercel.

For the legacy split deployment, the client can override its API URL:

```dotenv
NEXT_PUBLIC_API_URL=https://your-api-domain.example/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://cvhpsnljabfilivrfuyq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The API's `CLIENT_URL` or `CLIENT_URLS` must contain the final Vercel domain so browser
requests pass CORS. `CORS_ORIGIN_REGEX` can optionally allow a tightly scoped Vercel
preview-domain pattern.

In Supabase Dashboard, add the final Vercel domain and local development URL to
Authentication → URL Configuration → Redirect URLs. Include the `/login` path so
email confirmation and password-recovery links can return to the app. For production
email delivery, configure custom SMTP; Supabase's default sender is intended for
testing and is rate-limited.

Public sign-up can create only `client` or `expert` profiles. To provision an admin,
create the user in Supabase Authentication, then set that profile's `public.users.role`
to `admin` using the SQL editor or another trusted administrative workflow. Never
accept an `admin` role from browser metadata.

### cPanel web deployment (Passenger)

Build the static client before uploading the Python application:

```bash
cd client
source ~/.nvm/nvm.sh
nvm use
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_URL=/api/v1 pnpm build
```

The build automatically copies the export into `backend/static/`. Upload that
directory with the backend application; API endpoints remain under `/api/v1`.
Restart the Python application after uploading a new client build.

The backend includes `backend/passenger_wsgi.py` as the cPanel startup file. Passenger
expects a synchronous WSGI callable, so this entry point wraps the existing FastAPI
interface with `a2wsgi` and runs it on a dedicated event loop. The API routes and async
database implementation remain unchanged; this is a synchronous WSGI boundary for the
web server.

In cPanel's **Setup Python App**, configure:

- Python: 3.12 or newer
- Application root: the `backend` directory
- Startup file: `passenger_wsgi.py`
- Entry point: `application`
- Application URL: your web/API domain or path

Upload the backend source, `pyproject.toml`, `requirements.txt`, and `passenger_wsgi.py`,
then install dependencies from the application root:

```bash
pip install -r requirements.txt
```

Set the cPanel environment variables from `backend/.env.example`, including the
Supabase URL and publishable key, production `DATABASE_URL`, and production
`CLIENT_URL`. For a
deployed environment set `AUTO_CREATE_SCHEMA=false` and `SEED_DEMO_DATA=false`; apply
database migrations separately before starting Passenger. Do not use the local PostgreSQL
credentials or the demo seed in production.

Passenger does not provide a public callback URL by itself. Configure a public HTTPS
`PESAPAL_CALLBACK_URL` and `PESAPAL_IPN_URL`, register the IPN URL with Pesapal, and
configure the production credentials before enabling live payments.

Schedule an authenticated call to `POST /api/v1/admin/jobs/process` from cPanel Cron
or a trusted worker so expert timeouts, quote expiry, and due escrow releases continue
to run when no web request is open.

### Local URLs and shutdown

- Landing page: `http://localhost:3000`
- Client portal: `http://localhost:3000/dashboard`
- Expert portal: `http://localhost:3000/expert`
- Admin portal: `http://localhost:3000/admin`
- API documentation: `http://localhost:8000/docs`
- API health: `http://localhost:8000/health`

Use Ctrl+C in each application terminal to stop that server. From `KaziLedger`:

```bash
./logs-local.sh  # Follow PostgreSQL logs
./stop-local.sh  # Stop PostgreSQL; preserve database data
```

Create development accounts through the registration page so they exist in Supabase
Auth and receive a linked `public.users` profile. Passwords are never stored by the
FastAPI application.

To test Pesapal, set `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`,
`PESAPAL_IPN_ID`, and a public `PESAPAL_IPN_URL` in `backend/.env`, then restart the API.
The default environment is sandbox. Local startup does not require payment credentials.

## Payment note

Pesapal collection uses API 3.0 to top up a client wallet and verifies payment status server-side when an IPN arrives. The IPN URL must be public and registered with Pesapal before wallet top-ups are enabled. Clients choose any top-up amount, then fund accepted quotes from their wallet; only the selected labour fee moves into escrow. On release, expert earnings are credited to the expert wallet after commission. On a refund, the escrow amount returns to the client wallet. Payout access varies by merchant agreement, so expert wallet withdrawals are recorded as pending and routed through a provider adapter; connect the merchant-account payout endpoint before production use. Deposits and statutory fees are explicitly excluded from platform escrow.

## Launch defaults

- Currency: UGX
- Expert response timeout: 24 hours
- Escrow release i swindow: 72 hours
- Commission: 10%
- Rejection reasons: returned to the client as a final batch when matching stops

All are environment-configurable and should be confirmed before production launch.
