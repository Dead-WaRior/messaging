# Mini Social Media App

A minimal Twitter/Instagram-style app: profiles, posts (with images), comments, likes, follows. Built in 3 weeks per `Doc/`.

## Stack

- **Backend:** Node 18+ / Express.js
- **ORM:** Prisma
- **DB:** SQLite in dev; PostgreSQL in production (change `provider` in `schema.prisma`)
- **Auth:** JWT (`jsonwebtoken`) + `bcrypt`
- **Uploads:** `multer` (disk storage, 5 MB limit, jpg/png/gif/webp)
- **Frontend:** HTML + vanilla JS + plain CSS, styled to `Doc/UI.md`

## Local setup

```bash
cd backend
npm install
cp .env.example .env               # optional — defaults work for dev
npx prisma migrate dev --name init # creates dev.db + all tables
npm run seed                       # optional: 4 demo users, posts, likes, follows
npm run dev                        # http://localhost:3000
```

Then open **http://localhost:3000**. If seeded, log in with any of `alice / bob / carol / dave` and password `password123`.

## Production deployment

Two supported paths:

**Render (one-click via `render.yaml`)**

1. Push repo to GitHub.
2. In Render → New → Blueprint → point at repo. Render reads `render.yaml`, provisions a Postgres DB, and sets `DATABASE_URL` + `JWT_SECRET` automatically.
3. First deploy runs `prisma migrate deploy`, so the schema is created on the hosted DB before the server starts.

**Docker (Railway, Fly.io, Cloud Run, self-host)**

```bash
docker build -t mini-social .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" \
  -e JWT_SECRET="…" \
  mini-social
```

The Dockerfile runs `prisma migrate deploy` at container start.

**Switching to Postgres:** in `backend/prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`, delete `backend/prisma/migrations/`, set `DATABASE_URL` to a Postgres URL, then `npx prisma migrate dev --name init`. (This is only needed once, before your first prod deploy.)

## Environment variables

| Var              | Purpose                                          | Default                                      |
| ---------------- | ------------------------------------------------ | -------------------------------------------- |
| `DATABASE_URL`   | Prisma DB URL                                    | `file:./dev.db`                              |
| `JWT_SECRET`     | Signing key                                      | insecure dev default — **must** set for prod |
| `JWT_EXPIRES_IN` | JWT lifetime                                     | `7d`                                         |
| `PORT`           | HTTP port                                        | `3000`                                       |
| `CORS_ORIGIN`    | Allowed origin(s); use your frontend URL in prod | `*`                                          |

## API surface

Auth

```
POST /api/auth/register     { username, email, password }        → { user, token }
POST /api/auth/login        { identifier, password }              → { user, token }
```

Users

```
GET  /api/users/:id                            (optional auth for follow state) → { user }
PUT  /api/users/:id         { bio?, profile_pic_url? }  auth      → { user }
GET  /api/users/:id/posts   ?page&limit                           → { posts, ... }
POST /api/users/:id/follow                     auth               → { following, followers_count, following_count }
GET  /api/users/:id/followers                                     → { users }
GET  /api/users/:id/following                                     → { users }
```

Posts

```
GET  /api/posts             ?page&limit&user_id&following   (opt) → { posts, page, limit, total, has_more }
POST /api/posts             multipart { content, image? }   auth  → { post }
GET  /api/posts/:id                                        (opt) → { post }
DELETE /api/posts/:id                                       auth  → 204
POST /api/posts/:id/like                                    auth  → { liked, like_count }
```

Comments

```
GET    /api/posts/:id/comments                                     → { comments }
POST   /api/posts/:id/comments   { content }                auth   → { comment }
DELETE /api/comments/:id                                    auth   → 204
```

Feed

```
GET /api/feed/following  ?page&limit    auth   → { posts, ... } (same shape as /api/posts)
```

## Project layout

```
backend/
  prisma/
    schema.prisma
    seed.js
  src/
    server.js  app.js
    config/            # env
    routes/            # health, auth, users, posts, comments, feed
    controllers/       # auth, users, posts, comments, likes, follows
    middleware/        # requireAuth, optionalAuth
    lib/               # prisma client, jwt/bcrypt helpers, multer upload
  uploads/             # user-uploaded images (gitignored)
frontend/
  index.html                     # redirects to login or feed
  login.html signup.html
  feed.html post.html profile.html
  css/base.css
  js/api.js  app.js  feed.js  post.js  profile.js
Dockerfile
render.yaml
```
