# MFL Soil Data — Frontend

Web platform for the **Multifunctional Landscapes (MFL)** team at Alliance Bioversity
International — CIAT, to store, explore, visualize, map, upload and download soil research
data. Built with Next.js (App Router) and authenticated through Keycloak.

## 📋 Overview

The frontend is the user-facing application of the MFL Soil Data platform. It consumes the
[MFL Soil Data API](https://github.com/Dan3s/mflsoildata_api) and provides a dashboard with a
unified records table, configurable Plotly visualizations (time series, by-site comparison,
correlation, plus a per-site mode), an interactive Leaflet map of sampling sites, a guided data
upload flow (downloadable templates → dry-run validation → import), and filtered downloads.
Access is restricted to MFL members via Keycloak single sign-on, with role-based permissions
(Admin / Editor / Viewer).

## ⚙️ Requirements

- Node.js 18.18+ (20+ recommended)
- npm
- A running instance of the [MFL Soil Data API](https://github.com/Dan3s/mflsoildata_api)
- Keycloak 25+ (tested on 26.2.5) with a configured realm

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript + React 19
- **Styling**: Tailwind CSS v4
- **Authentication**: Auth.js v5 (NextAuth) + Keycloak (OIDC Authorization Code)
- **Charts**: Plotly (`react-plotly.js`)
- **Maps**: Leaflet + `react-leaflet`
- **Icons**: `lucide-react`
- **Backend**: FastAPI API, reached through a server-side proxy route

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Dan3s/mflsoildata_frontend.git
cd mflsoildata_frontend
```

### 2. Install Dependencies

The Next.js app lives in `src/`:

```bash
cd src
npm install
```

### 3. Environment Configuration

Create a `.env` file inside `src/` (the Next.js project root) with:

```bash
# Backend API
API_URL=http://localhost:8000/
NEXT_PUBLIC_API_URL=http://localhost:8000/

# Auth.js / Keycloak
AUTH_SECRET=generate-with-npx-auth-secret
AUTH_URL=http://localhost:3000
AUTH_KEYCLOAK_ID=mfl-frontend
AUTH_KEYCLOAK_SECRET=your-keycloak-client-secret
AUTH_KEYCLOAK_ISSUER=http://localhost:8080/realms/mfl
```

Generate a secret with `npx auth secret` (or `openssl rand -base64 32`). The Keycloak client
secret comes from the client's **Credentials** tab (visible only when *Client authentication*
is ON).

> Note: `.env` must be in `src/`, not the repository root — Next.js reads it from the project root.

## 🚀 Running the Project

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

## 🔑 Initial Setup (Keycloak)

The app uses the standard OIDC Authorization Code flow — Keycloak owns the login, registration,
email verification and password reset screens. Configure the realm as follows:

1. **Realm**: create a realm named `mfl`.
2. **Roles**: create realm roles `admin`, `editor`, `viewer`. Add `viewer` to the
   `default-roles-mfl` composite so new users are Viewers by default.
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

Role changes are managed from the Keycloak Admin Console (Users → Role mapping) — only an
administrator can change a user's permissions.

### Custom Keycloak login theme

A login theme that matches the platform branding is provided under `mfl-keycloak-theme/`.
Copy `mfl-keycloak-theme/mfl` to `<keycloak>/themes/mfl`, then set it in
Realm settings → Themes → *Login theme* = `mfl`.

## 📁 Project Structure

```
mflsoildata_frontend/
├── src/                                  # Next.js project root
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts   # Auth.js (NextAuth) handlers
│   │   │   └── backend/[...path]/route.ts    # Proxy to the API (injects bearer token)
│   │   ├── components/                   # Header, Sidebar, Footer, Logo, ui/
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                 # Auth-gated layout + sticky sidebar
│   │   │   ├── page.tsx                   # Dashboard: records table, filters, export
│   │   │   ├── [slug]/page.tsx            # visualizacion | mapa | cargar | descargar
│   │   │   └── components/                # MapView, VisualizationView, UploadView, DownloadView
│   │   ├── login/page.tsx                 # Login screen (redirects to Keycloak)
│   │   ├── lib/roles.ts                   # Role helpers (canUpload, isAdmin, …)
│   │   ├── services/                      # API client, per-domain services, shared types
│   │   ├── layout.tsx                     # Root layout
│   │   ├── icon.svg                       # Favicon
│   │   └── page.tsx                       # Public landing page
│   ├── auth.ts                            # Auth.js config + Keycloak provider + token refresh
│   ├── middleware.ts                      # Route protection + role gate (Cargar Datos)
│   ├── types/                             # next-auth type augmentation
│   ├── public/                            # Static assets
│   └── package.json
├── mfl-keycloak-theme/                    # Keycloak custom login theme (mfl)
├── docs/                                  # API endpoint contracts (backend work specs)
└── README.md                             # This file
```

## ✨ Key Features

- 📊 **Dashboard**: unified records table with project/site/type/matrix/variable/date filters and CSV export
- 📈 **Visualization**: configurable Plotly charts — time series, by-site comparison, correlation, and a per-site mode reachable from the map
- 🗺️ **Map**: interactive Leaflet map of sampling sites with a detail panel and "view in charts"
- 📤 **Data upload**: customizable templates → file validation (dry-run) → transactional import, plus a "new variable" form
- 📥 **Data download**: filtered exports (xlsx/csv) with real record estimates
- 🔐 **Single sign-on**: Keycloak (OIDC) login, email verification and password recovery
- 👥 **Role-based access**: Admin (all), Editor (can add data), Viewer (read-only); only Editors/Admins can access Cargar Datos
- 🎨 **Branding**: custom logo and a matching Keycloak login theme

## 🔐 Authentication & Roles

- The `/login` page triggers the Keycloak flow; `middleware.ts` protects `/dashboard/**` and
  restricts `/dashboard/cargar` to Editors/Admins.
- The proxy route `app/api/backend/[...path]` injects the signed-in user's access token as a
  `Bearer` header, so the token never lives in browser JavaScript.
- Server-side (SSR) reads authenticate with a Keycloak **service-account** token
  (`client_credentials`) — this requires *Service accounts roles* enabled on the client.

## 🚀 Deployment

Build a production bundle and serve it behind a reverse proxy (e.g. Nginx):

```bash
cd src
npm ci
npm run build
npm start            # serves on port 3000
```

Set the production `.env` values (`AUTH_URL`, `AUTH_KEYCLOAK_ISSUER`, `API_URL`, …) and update
the Keycloak client redirect/origin URIs to the production domain.

## 📄 License

This project is part of the CGIAR / Alliance Bioversity International — CIAT initiative for
Multifunctional Landscapes research.

## 🔗 Related Resources

- [MFL Soil Data API](https://github.com/Dan3s/mflsoildata_api)
- [mflsoildata_orm](https://github.com/Dan3s/mflsoildata_orm)
- [Next.js Documentation](https://nextjs.org/docs)
- [Auth.js (NextAuth) Documentation](https://authjs.dev/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
