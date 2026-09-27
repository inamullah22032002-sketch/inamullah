# FunclubSI V2 — Next-Gen Cinema & Cloudflare R2 Streaming Platform

**FunclubSI** is a premium, futuristic movie/TV streaming, discovery, and media management platform built with React, TypeScript, Express, PostgreSQL, and Cloudflare R2 object storage with direct browser multipart chunking.

---

## 1. Key Architectural Features

- **Direct Cloudflare R2 Multipart Uploads**: Large video files stream directly from the browser to Cloudflare R2 via presigned S3 chunk URLs. Video bytes **never** proxy through serverless/Netlify functions (avoiding HTTP 413 Payload Too Large limits).
- **Zero-Pill Typographic Design**: Clean unboxed metadata with subtle typographic separators (`·`), animated neon bubble category navigation, and dark futuristic cinema glassmorphism (`#07080d`, cyan neon `#06b6d4`, purple highlights).
- **Separated Role-Based Authentication**:
  - Regular Users (`/login`, `/signup`, `/forgot-password`): Discover titles, manage personal Watchlist & Favorites, and auto-resume playback progress via Continue Watching.
  - Administrators (`/admin/login`): Fully isolated portal with zero prefilled credentials, protected server-side with JWT and role verification (`ADMIN`, `CONTENT_MANAGER`, `MODERATOR`).
- **SSRF-Protected URL Importer (`/admin/import`)**: Ingests public metadata using an extensible provider model (Schema.org JSON-LD and OpenGraph). Strictly guards against internal network addresses, link-local IPs, cloud metadata endpoints, and non-HTTP protocols.
- **Server-Side AI Assistant**: Powered by `@google/genai` (`gemini-3.8-flash`) to generate synopses, tag recommendations, and age ratings for administrator review before publication.
- **Security & Governance Audit Trail**: Immutable tracking of role changes, administrative logins, and content lifecycle actions with CSV export and weekly supervisor dispatch triggers.
- **Real-Time Telemetry & Anomaly Alerts**: Live system metrics (memory, uptime, storage capacity) and automatic alerts for anomalous upload failure spikes.

---

## 2. Environment Variables Setup

Create a `.env` file in the root directory based on `.env.example`:

```bash
# Server & Port
PORT=3000
APP_URL="http://localhost:3000"

# Authentication & Sessions (Generate a strong 32+ char secret)
AUTH_SECRET="your-super-secret-jwt-key-funclubsi-2026"

# Database (PostgreSQL Connection String)
# If omitted or offline, a resilient local database fallback is used automatically.
DATABASE_URL="postgres://postgres:postgres@localhost:5432/funclubsi"

# Cloudflare R2 Storage (S3-Compatible Object Store)
R2_ACCOUNT_ID="your_cloudflare_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="funclubsi-media"
R2_ENDPOINT="https://your_cloudflare_account_id.r2.cloudflarestorage.com"
R2_PUBLIC_URL="https://pub-your_bucket_id.r2.dev"

# AI Integration (Optional)
GEMINI_API_KEY="your_gemini_api_key"
```

---

## 3. Cloudflare R2 CORS Configuration

To allow browsers to upload chunks directly to your Cloudflare R2 bucket and extract the required `ETag` headers, apply this CORS policy in your Cloudflare Dashboard (**R2 > Bucket > Settings > CORS Policy**):

```json
[
  {
    "AllowedOrigins": [
      "https://YOUR-FUNCLUBSI-DOMAIN.netlify.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Authorization"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

> **Important**: The `ExposeHeaders: ["ETag"]` directive is mandatory because the S3 multipart completion contract requires part-level ETags.

---

## 4. Local Installation & Development

```bash
# 1. Install dependencies
npm install

# 2. Start the full-stack development server
npm run dev

# 3. Access in browser
# Open http://localhost:3000
```

---

## 5. Bootstrap Administrator Account

Upon the initial server boot, if no administrator exists in the database, a bootstrap administrator is seeded:
- **Email**: `admin@funclubsi.com`
- **Initial Password**: `FunclubSI#2026!Admin`

> **Note**: These credentials are never prefilled in login forms. You must enter them manually at `/admin/login`. Once signed in, you can update credentials under **Admin > System Settings** or User Profile.

---

## 6. Multipart Upload Lifecycle

```
[Admin Browser]
       │
       │ 1. Initiate Multipart (filename, size, mimeType)
       ▼
[FunclubSI API (/api/admin/uploads/multipart/initiate)]
       │
       │ 2. CreateMultipartUploadCommand on R2
       ▼
[Admin Browser]
       │
       │ 3. Slice file into ~20-50MB chunks
       │ 4. Request presigned URL for Part N (/api/admin/uploads/multipart/sign)
       │ 5. PUT chunk directly ──► [Cloudflare R2 Bucket]
       │ 6. Extract ETag from R2 response
       │ 7. Retry chunk with backoff if network drops
       │
       │ 8. Send Part List with ETags (/api/admin/uploads/multipart/complete)
       ▼
[FunclubSI API]
       │ CompleteMultipartUploadCommand on R2 & persist in PostgreSQL
       ▼
[Admin Browser]
       │ Upload 100% Complete & Movie ready for publication
```

---

## 7. Netlify Deployment Guide

1. Push your repository to GitHub.
2. In the Netlify Dashboard, click **Add new site > Import an existing project**.
3. Select your repository.
4. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Configure Environment Variables in Netlify under **Site configuration > Environment variables** (`DATABASE_URL`, `AUTH_SECRET`, `R2_*`, etc.).
6. SPA routing is already configured in `public/_redirects`:
   ```
   /api/*  /.netlify/functions/api/:splat  200
   /*      /index.html                     200
   ```

---

## 8. Troubleshooting

| Error | Root Cause | Solution |
| :--- | :--- | :--- |
| **HTTP 413 Payload Too Large** | Large video was sent via serverless body proxy. | FunclubSI V2 streams bytes directly to R2 via presigned URLs. Ensure you are uploading through the Admin Upload screen. |
| **Missing ETag / Completion Failed** | R2 bucket CORS is not exposing the `ETag` header. | Add `"ExposeHeaders": ["ETag"]` in Cloudflare R2 bucket CORS settings. |
| **HTTP 403 Forbidden on /admin** | Current session has role `USER` instead of `ADMIN`. | Sign in via `/admin/login` using administrative credentials. |
| **SSRF_PROTECTION Error** | Admin entered an internal or local IP for URL metadata import. | Enter public, fully qualified HTTP/HTTPS URLs. Internal IP addresses and cloud metadata services are blocked by design. |
| **Database Connection Warning** | `DATABASE_URL` is unset or PostgreSQL is unreachable. | FunclubSI automatically falls back to its resilient relational store. To use external PostgreSQL, provide a valid connection string. |
