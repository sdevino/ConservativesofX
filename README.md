# Conservatives of X – Community Platform

A secure, minimalist web application for organizing conservative community events, discussions, and coordination. Built for deployment on **Azure App Service** with **Node.js 24** and **Azure Database for MySQL**.

## Features (Current – Phase 1)

- User registration & login (local + Google OAuth)
- Secure password storage (bcrypt)
- Profile management (name, phone, address, opt-ins)
- Events listing (public) with date/time and optional graphic
- Admin panel (create/edit events & forum categories)
- Basic forum (categories + threaded posts, members-only)
- Role-based access (admin, moderator flags in DB)
- Tailwind CSS + Font Awesome for clean, responsive UI
- Helmet, rate limiting, express-session security headers
- EJS templating with shared layout

**Planned Phase 2**
- Azure Blob Storage for profile pictures & event graphics
- Azure Communication Services (email newsletters + SMS)
- Facebook & X (Twitter) OAuth
- Donation integration stub
- Full forum replies & moderation tools

## Tech Stack

| Category            | Technology                          | Version / Note                     |
|---------------------|-------------------------------------|------------------------------------|
| Runtime             | Node.js                             | 24.x (Azure default ~24)           |
| Framework           | Express                             | 4.19+                              |
| Database            | MySQL (Azure Database for MySQL)    | Flexible Server                    |
| ORM                 | Prisma                              | 5.20+                              |
| Authentication      | Passport.js                         | Local + Google OAuth20             |
| Password hashing    | bcryptjs                            | 12 rounds                          |
| Templating          | EJS                                 | With shared layout.ejs             |
| Styling             | Tailwind CSS (CDN)                  | + Font Awesome 6                   |
| Security            | helmet, express-rate-limit          | Basic hardening                    |
| File uploads        | multer                              | (Phase 2 – Azure Blob)             |
| Deployment          | Azure App Service                   | Linux / Node 24 runtime            |

## Prerequisites

- Node.js 24.x (nvm recommended)
- Azure subscription
- Azure Database for MySQL Flexible Server
- Google OAuth credentials (for `/auth/google`)

## Local Development Setup

```bash
# 1. Clone or extract project
git clone <your-repo-url>
cd conservatives-of-x

# 2. Install dependencies
npm install

# 3. Copy sample env and fill values
cp .env.example .env
# Edit .env → DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, etc.

# 4. Generate Prisma client & push schema
npx prisma generate
npx prisma db push   # or npx prisma migrate dev (if using migrations)