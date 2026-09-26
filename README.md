# Safar-e-Rachna

A literary journal for poems, articles, book reviews, song reviews, movie reviews, and daily writing practices.

This version runs on **Next.js + Vercel**, with **Supabase** for accounts, posts, settings, likes, comments, and image storage. It replaces the Cloudflare-specific runtime in the earlier export.

**Start here: [DEPLOYMENT.md](DEPLOYMENT.md).**

The journal includes the original homepage layout, editable author profile and social links, five appearance themes, burgundy/gold outer frame, autumn leaves within the masthead, related posts, fuzzy search, and research/write/review timers. Only accounts explicitly added as authors can edit or publish. Readers can browse anonymously and sign in by email code to like or comment.

## Local development

Use Node.js 22.x.

```sh
npm ci
cp .env.example .env.local
# Fill in the two Supabase values, then complete the database setup.
npm run dev
```

Open http://localhost:3000. Add that URL to Supabase's allowed redirects when testing optional Google login.

```sh
npm test
npm run typecheck
npm run build
npm start
```

The permission tests run a local PostgreSQL-compatible PGlite instance with real row-level security policies; they do not need credentials or change a live database. They stub Supabase's platform tables and therefore do not replace a live authentication/storage smoke test.

## Data and access

- Supabase: posts, saved drafts, likes, comments, journal settings, uploaded images, reader accounts.
- Browser storage: appearance preferences, current working draft, practice timers.
- Public: published posts, comment display names/text, like totals, and uploaded image URLs.
- Author only: saved drafts, publishing, journal/profile edits, image uploads.

The source package includes six clearly labelled sample pieces. It does not include the old hosted site's database, accounts, or uploaded files. See the migration note in the deployment guide if you have existing content to transfer.

Artwork attribution appears in the website footer. Leaf assets are adapted from Twemoji under CC BY 4.0; the paintings are public domain.
