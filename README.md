# Rinae Korean

[Live application](https://www.rinaekorean.com) · Full-stack Korean learning platform

Rinae Korean is an actively developed learning platform for Russian-speaking Korean students. It combines structured courses, interactive lesson exercises, vocabulary training, TOPIK practice, progress tracking, and administrative content tools in one responsive application.

## Project status

Rinae Korean is under active development. The application is deployed and usable, but the structured course content (https://www.rinaekorean.com/courses) is still being prepared and refined, so the courses are not publicly displayed yet. Ongoing engineering work also includes extracting the largest lesson/editor modules into smaller feature-focused components and expanding automated test coverage.

## Highlights

- Structured Korean courses with grammar, vocabulary, examples, practice, quizzes, and custom lesson steps
- Interactive exercises including sentence building, inline choices, particles, typed answers, dialogue completion, matching, handwriting, and listening tasks
- Vocabulary placement, spaced review sessions, learning rounds, and timed sprint activities
- TOPIK I and TOPIK II reading/listening tests with saved attempts and result analysis
- Student dashboard with lesson, vocabulary, and test progress
- Administrative builders for courses, lessons, TOPIK tests, vocabulary, images, and audio
- Optional AI-assisted lesson, exercise, vocabulary, and image generation through OpenAI and Gemini
- Responsive lesson layouts with mobile-specific media and Vercel Blob uploads
- Cookie-based authentication, password reset, and role-based administrative access

## Technology

- Next.js 16 App Router
- React 19 and TypeScript
- PostgreSQL and Prisma
- styled-components and Tailwind CSS
- Vercel Blob for uploaded lesson media
- OpenAI and Gemini integrations for optional administrative content generation
- Nodemailer for contact messages and password-reset email

## Architecture

```text
src/
├── app/                    # Pages and API route handlers
├── components/courses/     # Course, lesson, and admin interfaces
├── context/                # Client authentication state
├── lib/                    # Auth, course, vocabulary, media, and AI services
└── types/                  # Shared application types

prisma/
├── migrations/             # Versioned PostgreSQL migrations
├── schema.prisma           # Database schema
└── seed.ts                 # Explicit admin/demo seed
```

The browser communicates with Next.js route handlers. Server-side services validate permissions and persist data through Prisma. Authentication uses random session tokens stored as hashes in PostgreSQL and delivered through HTTP-only cookies. Uploaded course media is sent directly to Vercel Blob so large files are not embedded in lesson-save requests.

## Local development

### Requirements

- Node.js 20 or newer
- npm
- Docker Desktop, or another PostgreSQL 16 instance

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

The included Docker configuration creates a local `rinae_korean` database on port `5432`.

### 3. Create the environment file

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Replace the example admin password before running the seed. AI, Blob, and SMTP variables are optional for basic local development.

### 4. Apply database migrations

```bash
npm run prisma:migrate
```

### 5. Create or update the admin account

```bash
npm run db:seed
```

The seed reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and the optional `SEED_ADMIN_NAME` from the environment. No administrator password is stored in the repository.

By default, the seed only creates or updates the admin account. Setting `ALLOW_DESTRUCTIVE_DEMO_SEED=true` also resets and recreates demo TOPIK and course content. That operation deletes existing attempts, tests, lessons, and related course records, so never enable it against a database you do not intend to reset.

### 6. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

The complete placeholder configuration is in [`.env.example`](./.env.example).

### Required

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by the application |
| `DIRECT_URL` | Direct PostgreSQL connection used by Prisma migrations |
| `SEED_ADMIN_EMAIL` | Admin email used only when running the seed |
| `SEED_ADMIN_PASSWORD` | Admin password used only when running the seed; minimum 12 characters |

### Optional integrations

| Variable | Purpose |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token; store-specific names ending in `_READ_WRITE_TOKEN` are also supported |
| `SVINKA_KEY` | Server-side OpenAI API key used by the current AI generators |
| `GEMINI_API_KEY` | Server-side Gemini API key |
| `GEMINI_MODEL` | Optional Gemini model override |
| `OPENAI_IMAGE_MODEL` | Optional OpenAI image-model override |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | Base URL used when creating password-reset links |
| `SESSION_TTL_DAYS` | Session duration; defaults to 30 days |
| `PASSWORD_RESET_TTL_MINUTES` | Password-reset token lifetime; defaults to 60 minutes |
| `SMTP_*` | SMTP configuration for contact and password-reset emails |
| `CONTACT_TO_EMAIL` | Destination for contact-form messages; required when email delivery is enabled |

Environment files and provider tokens must never be committed. Only `.env.example`, containing placeholders, is intentionally tracked.

## Vercel deployment

1. Connect the repository to Vercel.
2. Configure `DATABASE_URL` and `DIRECT_URL` for the deployed PostgreSQL database.
3. Connect a Vercel Blob store. Vercel may create a variable such as `SVINKA_READ_WRITE_TOKEN`; the application supports that naming convention.
4. Add AI and SMTP variables only for integrations you intend to enable.
5. Set `APP_URL` to the production origin.
6. Apply production migrations with `npx prisma migrate deploy` from a controlled environment.

Vercel does not run `prisma db seed` as part of this project's normal build. `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are therefore only needed in Vercel if you deliberately execute the seed in that environment. Do not enable `ALLOW_DESTRUCTIVE_DEMO_SEED` in production.

## Quality checks

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

## Security notes

- Real `.env` files are ignored by Git.
- Session and password-reset tokens are stored as hashes rather than plaintext.
- Admin routes validate the authenticated user's role.
- Course uploads use authenticated direct-to-Blob handlers.
- Seed credentials are supplied explicitly through the environment.
- Demo data resets require an explicit destructive-seed flag.

If this repository is made public, verify that all included course text, images, and audio are licensed for redistribution.

## Source availability

This repository is presented as a portfolio project. Unless a separate license is added, the source and included learning materials are not licensed for reuse or redistribution.
