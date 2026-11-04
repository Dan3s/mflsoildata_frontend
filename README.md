# MFL Soil Data — Frontend

Web platform for the **Multifunctional Landscapes (MFL)** team at Alliance Bioversity
International — CIAT, to store, explore, visualize, map, upload and download soil research
data. Built with Next.js (App Router) and authenticated through Keycloak.

## Overview

The frontend is the user-facing application of the MFL Soil Data platform. It consumes the
[MFL Soil Data API](https://github.com/Dan3s/mflsoildata_api) and provides:

- A public **landing page** (with an anonymous stats teaser), **About** and **Contact** pages,
  available in **Spanish and English** (`next-intl`).
- A **dataset catalogue** on the dashboard home: every project with its FAIR metadata, privacy
  (`access_level`) and quality-control badges, filterable by institution/matrix/year.
- A **data explorer** (`@kanaries/graphic-walker`) to pivot, filter and chart any combination of
  variables across datasets — fed by the API's wide-format endpoint.
- An interactive **Leaflet map** of sampling sites with a detail panel.
- A **metadata-first upload wizard**: fill in the FAIR ficha, then pick a template or
  import from an external **Dataverse** installation by DOI, map columns, validate (dry-run),
  and submit for review — nothing reaches the database until a reviewer approves it.
- A **traceability / review queue** for `database_editor`/admin to approve or reject submitted
  datasets, and a **Users** screen for admins to manage Keycloak roles.
- Filtered **downloads** (xlsx/csv) with real record estimates.
- A floating **AI assistant** widget (placeholder today — see
  [Related Resources](#related-resources) for where that's headed).

Access is restricted to MFL members via Keycloak single sign-on, with role-based permissions
(Admin / Database editor / Editor / Viewer).

## Requirements

- Node.js 18.18+ (20+ recommended)
- npm
- A running instance of the [MFL Soil Data API](https://github.com/Dan3s/mflsoildata_api)
- Keycloak 25+ (tested on 26.2.5) with a configured realm

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript + React 19
- **Styling**: Tailwind CSS v4
- **i18n**: `next-intl` (Spanish/English, see [Internationalization](#internationalization))
- **Authentication**: Auth.js v5 (NextAuth) + Keycloak (OIDC Authorization Code)
- **Data explorer**: `@kanaries/graphic-walker`
- **Charts**: Plotly (`react-plotly.js`) — kept for a dormant fixed-chart view, see
  [`VisualizationSection.tsx`](src/app/dashboard/components/VisualizationSection.tsx)
- **Maps**: Leaflet + `react-leaflet`
- **Icons**: `lucide-react`
- **Backend**: FastAPI API, reached through a server-side proxy route

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Dan3s/mflsoildata_frontend.git
cd mflsoildata_frontend
```

### 2. Install dependencies

The Next.js app lives in `src/`:

```bash
cd src
npm install
```

### 3. Environment configuration

Create a `.env` file inside `src/` (the Next.js project root) with:

```bash
# Backend API
API_URL=http://localhost:8000/
NEXT_PUBLIC_API_URL=http://localhost:8000/

# Auth.js / Keycloak
AUTH_SECRET=generate-with-npx-auth-secret
AUTH_KEYCLOAK_ID=mfl-frontend
AUTH_KEYCLOAK_SECRET=your-keycloak-client-secret
AUTH_KEYCLOAK_ISSUER=http://localhost:8080/realms/mfl
```

Generate a secret with `npx auth secret` (or `openssl rand -base64 32`). The Keycloak client
secret comes from the client's **Credentials** tab (visible only when *Client authentication*
is ON). No `AUTH_URL` is needed — `trustHost` (see `auth.ts`) infers it from each request's
`Host` header.

> Note: `.env` must be in `src/`, not the repository root — Next.js reads it from the project root.

## Running the Project

### Development

```bash
cd src
npm run dev
```

The app will be available at `http://localhost:3000`.

### Production

```bash
cd src
npm run build
npm start
```

### Lint

```bash
cd src
npm run lint
```

## Initial Setup (Keycloak)

The app uses the standard OIDC Authorization Code flow — Keycloak owns the login, registration,
email verification and password reset screens. Configure the realm as follows:

1. **Realm**: create a realm named `mfl`.
2. **Roles**: create realm roles `admin`, `database_editor`, `editor`, `viewer`. Add `viewer` to
   the `default-roles-mfl` composite so new users are Viewers by default. `database_editor` is a
   superset of `editor` (adds catalog/schema management and submission review) — assign it on top
   of, or instead of, `editor`.
3. **Client** `mfl-frontend` (OpenID Connect):
   - *Client authentication*: ON (confidential — exposes the Credentials tab).
   - *Standard flow*: ON. *Service accounts roles*: ON (used for server-side reads).
   - Valid redirect URIs: `http://localhost:3000/api/auth/callback/keycloak`
   - Valid post-logout redirect URIs: `http://localhost:3000/*`
   - Web origins: `http://localhost:3000`
4. **Login options** (Realm settings → Login): enable *User registration*, *Forgot password*,
   *Verify email*, *Login with email*, *Remember me*.
5. **Localization**: enable Internationalization and set the default locale to `es` (Spanish).
6. **Email (SMTP)**: configure an SMTP server so verification and password-reset emails are sent.
7. Copy the client secret into `AUTH_KEYCLOAK_SECRET`.

Role changes are managed from the platform's own **Users** screen (admin-only, backed by the
API's `/users` endpoints) or directly from the Keycloak Admin Console (Users → Role mapping).

### LAN usability testing (coworkers on the same network)

A visiting browser can already reach the app at `http://<your-ip>:3000` with no change, but the
Keycloak login redirect still goes to whatever host Keycloak's realm `mfl` → **Frontend URL**
(Realm settings → General) is set to — `localhost` by default, which only resolves on *your*
machine, not the visiting user's.

1. Realm settings → General → **Frontend URL** → `http://<your-ip>:8080` (plain field, no restart).
2. Set `AUTH_KEYCLOAK_LOCALTESTS=<your-ip>` in this app's `.env` and the mirrored
   `KEYCLOAK_LOCALTESTS=<your-ip>` in `mflsoildata_api`'s `.env` (restart both dev servers) — this
   swaps that host into `AUTH_KEYCLOAK_ISSUER`/`KEYCLOAK_ISSUER` without touching those variables.
3. One-time, in client `mfl-frontend` (Settings): add `http://172.22.*.*:3000/*` (your subnet) to
   *Valid Redirect URIs* alongside the `localhost` one, and `+` to *Web Origins*.

Leave `AUTH_KEYCLOAK_LOCALTESTS` / `KEYCLOAK_LOCALTESTS` empty the rest of the time — everything
behaves exactly as before.

### Custom Keycloak login theme

A login theme that matches the platform branding is provided under `mfl-keycloak-theme/`.
Copy `mfl-keycloak-theme/mfl` to `<keycloak>/themes/mfl`, then set it in
Realm settings → Themes → *Login theme* = `mfl`.

## Internationalization

All user-facing copy lives in `src/messages/es.json` / `src/messages/en.json` (one key per UI
string, grouped by feature namespace) and is read with `next-intl`'s `useTranslations()` /
`getTranslations()`. When adding a new string, add the key to **both** files — there is no
automatic fallback between locales.

## Project Structure

```
mflsoildata_frontend/
├── src/                                  # Next.js project root
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts   # Auth.js (NextAuth) handlers
│   │   │   └── backend/[...path]/route.ts    # Proxy to the API (injects bearer token)
│   │   ├── components/                   # Header, Sidebar, Footer, ChatWidget, Logo, ui/, …
│   │   ├── about/, contact/               # Public pages
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                 # Auth-gated layout + sticky sidebar
│   │   │   ├── page.tsx                   # Dashboard home: summary cards + dataset catalogue
│   │   │   ├── [slug]/page.tsx            # visualization | map | upload | download
│   │   │   ├── logs/, users/              # Traceability (review queue) and Users admin pages
│   │   │   └── components/                # GraphicWalkerView, MapView, UploadView, DownloadView,
│   │   │                                   # DatasetCatalogue, LogsView, UsersView, ColumnGlossary, …
│   │   ├── login/page.tsx                 # Login screen (redirects to Keycloak)
│   │   ├── lib/roles.ts                   # Role helpers (canUpload, canManageCatalog, isAdmin, …)
│   │   ├── services/                      # API client, per-domain services, shared types
│   │   ├── layout.tsx                     # Root layout (mounts the global ChatWidget)
│   │   ├── icon.svg                       # Favicon
│   │   └── page.tsx                       # Public landing page
│   ├── messages/                          # es.json / en.json — all UI copy (next-intl)
│   ├── auth.ts                            # Auth.js config + Keycloak provider + token refresh
│   ├── middleware.ts                      # Route protection + role gate (Upload Data)
│   ├── scripts/
│   │   └── build-glossary-docx.mjs        # Regenerates public/Glosario_Columnas_BD_MFL.docx
│   │                                      # from app/lib/column-glossary.json (the source of truth)
│   ├── types/                             # next-auth type augmentation
│   ├── public/                            # Static assets served as-is (logo, column glossary .docx)
│   └── package.json
├── mfl-keycloak-theme/                    # Keycloak custom login theme (mfl)
├── docs/                                  # API endpoint contracts (backend work specs)
└── README.md                              # This file
```

## Key Features

- **Dashboard & catalogue**: summary metrics (datasets, sites, samples, variables, countries) plus
  a dataset catalogue — one card per project with its FAIR ficha, privacy and QC badges
- **Data explorer**: pivot/filter/chart any combination of variables via `@kanaries/graphic-walker`,
  backed by the API's wide-format endpoint
- **Map**: interactive Leaflet map of sampling sites with a detail panel
- **Data upload**: metadata ficha first, then a customizable template or a Dataverse-by-DOI import,
  column mapping, dry-run validation, and submission for review (nothing is written to the
  database until a reviewer approves it)
- **Traceability**: review queue for `database_editor`/admin to approve or reject submitted
  datasets
- **Data download**: filtered exports (xlsx/csv) with real record estimates
- **Users**: admin screen to search users and change their Keycloak roles
- **Single sign-on**: Keycloak (OIDC) login, email verification and password recovery
- **Role-based access**: Admin (all), Database editor (add data + manage catalog + review
  submissions), Editor (add data values + submit uploads), Viewer (read-only)
- **i18n**: full Spanish/English UI via `next-intl`
- **Branding**: custom logo, a matching Keycloak login theme, and a MOSAIC-inspired public site

## Authentication & Roles

- The `/login` page triggers the Keycloak flow; `middleware.ts` protects `/dashboard/**` and
  restricts `/dashboard/upload` to Editors/Database editors/Admins.
- Within Upload Data, the **catalog** actions (the "new variable" form and the create-attribute
  forms in manual registration) are shown only to `database_editor`/`admin` via
  `canManageCatalog()`; plain `editor`s can still record values against existing catalog entries.
  This mirrors the API guards (`require_database_editor`), so the UI and the backend enforce the
  same rule.
- The proxy route `app/api/backend/[...path]` injects the signed-in user's access token as a
  `Bearer` header, so the token never lives in browser JavaScript.
- Server-side (SSR) reads authenticate with a Keycloak **service-account** token
  (`client_credentials`) — this requires *Service accounts roles* enabled on the client.

## Deployment

Build a production bundle and serve it behind a reverse proxy (e.g. Nginx):

```bash
cd src
npm ci
npm run build
npm start            # serves on port 3000
```

Set the production `.env` values (`AUTH_URL`, `AUTH_KEYCLOAK_ISSUER`, `API_URL`, …) and update
the Keycloak client redirect/origin URIs to the production domain.

## License

This project is part of the CGIAR / Alliance Bioversity International — CIAT initiative for
Multifunctional Landscapes research.

## Related Resources

- [MFL Soil Data API](https://github.com/Dan3s/mflsoildata_api)
- [mflsoildata_orm](https://github.com/Dan3s/mflsoildata_orm)
- [Next.js Documentation](https://nextjs.org/docs)
- [Auth.js (NextAuth) Documentation](https://authjs.dev/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
