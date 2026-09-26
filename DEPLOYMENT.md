# Deploy Safar-e-Rachna on Vercel

You need your GitHub repository, a Vercel account connected to it, and a Supabase project. For public email sign-in, you also need an SMTP email provider configured in Supabase. A custom domain is optional.

## 1. Connect this repository

The Vercel-compatible version is already at the root of this repository. In Vercel, import `yupitsmegd7/Safar-e-Rachna`, select the `main` branch for production, and leave **Root Directory** as `./`.

The old Cloudflare runtime has been removed. Keep `package.json`, `package-lock.json`, `vercel.json`, and the `supabase` folder committed. Do not commit `.env.local`, `node_modules`, or `.next`.

## 2. Create the database and image bucket

1. Create a new project at https://supabase.com/dashboard. Keep its database password in your password manager; it is not a Vercel environment variable for this app.
2. Open **SQL Editor → New query**.
3. Paste the complete contents of `supabase/setup.sql` and run it.
4. It creates the tables, permissions, `journal-images` storage bucket, default author information, and six sample posts. Rerunning it preserves existing writing/settings.
5. From the project's **Connect** dialog or **Settings → API Keys**, copy the Project URL and **publishable** key. The legacy `anon` key also works if your project uses legacy keys. Never use a secret or `service_role` key in a `NEXT_PUBLIC_` variable.

## 3. Import into Vercel

Open https://vercel.com/new, import your GitHub repository, and use:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `./` (repository root) |
| Node.js Version | 22.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Leave the Next.js default; do not enter `dist` or `out` |

Add these environment variables before deploying:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Select **Production** for the production deployment. Add corresponding values to **Preview** and **Development** if you use those environments; a separate Supabase project is preferable for development that changes data. A preview pointed at the production database can change production content.

Click **Deploy**. After changing any `NEXT_PUBLIC_` value, redeploy: these values are included at build time.

## 4. Enable email sign-in

In Supabase:

1. Under **Authentication**, enable the Email provider and allow new signups so readers can create accounts. Keep email verification enabled.
2. Under **URL Configuration**, set **Site URL** to the production Vercel URL, such as `https://your-project.vercel.app`. Add your final production URL to the allowed redirect URLs. Update these if you later use a custom domain.
3. Under **Email Templates → Magic Link**, use a code-based template:

   ```html
   <h2>Your Safar-e-Rachna sign-in code</h2>
   <p>Enter this code on the sign-in page:</p>
   <p><strong>{{ .Token }}</strong></p>
   <p>If you did not request this, you can ignore this email.</p>
   ```

   Use the same code-based body for **Confirm signup** if your project sends that template for new users. This app verifies the emailed code; it does not use email magic-link callbacks.

4. Configure **custom SMTP** under Authentication email settings for real readers. Supabase's built-in sender is for testing and restricts recipients to your project's organization members; it is not a production email service. Keep the email provider's credentials in Supabase, not GitHub.

Optional Google login: enable Google in Supabase, configure its Google OAuth credentials using Supabase's displayed callback URL, add `https://YOUR_SITE/auth/callback` to Supabase's redirect allowlist, then set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true` in Vercel and redeploy. Email login works without this option.

## 5. Give your account author access

1. Visit `/login` on the deployed website and sign in using your email code.
2. In `supabase/set-author.sql`, replace `REPLACE_WITH_YOUR_EMAIL` with that exact email.
3. Run that SQL in the Supabase SQL Editor.
4. Reload the website. You should now see **Edit profile & links**, **Customize journal**, and enabled save/publish buttons in **Writer's desk**.

No visitor becomes the author automatically. Run this script only for accounts you want to allow to edit the entire journal.

## 6. Check the finished deployment

- Publish a short piece and refresh: it should remain saved.
- Open an incognito window: published writing should load, while saved drafts and editing controls should remain private.
- Sign in with a second email: liking once should increase the count once; clicking again should remove the like.
- Post a comment and refresh. Comments have a 20-second cooldown per account.
- As the author, upload a JPEG, PNG, or WebP under 5 MB and confirm it appears. Images upload directly to Supabase Storage and are publicly accessible by URL, including images attached to drafts.
- Check a phone-sized screen, Appearance, and the three practice timers.

The code can be built and permission-tested locally, but a live sign-in, email delivery, database, and image upload check requires your configured Supabase project.

## Existing content

This package includes source code and sample content, not the database or uploads from the earlier hosted site. If you already saved real posts or profile changes there, export/import them separately before retiring that site. Old `/api/image?id=...` URLs depend on its old storage; upload those images to Supabase and update the URLs. ChatGPT sign-in accounts from the old site do not transfer automatically to Supabase accounts. Old comments/likes need an explicit account mapping for migration.

## Common issues

| Issue | Check |
| --- | --- |
| Build mentions Vinext or Cloudflare | Replace the old files and lockfile with this package; confirm the Vercel root directory. |
| Journal setup error | Both environment variables are present, `setup.sql` succeeded, and the project is running. Redeploy after changing variables. |
| No email or “email address not authorized” | Configure custom SMTP; check the provider's verified sender and recipient restrictions. |
| Email contains a link instead of a code | Update the Supabase email template to show `{{ .Token }}`. |
| Signed in but cannot edit | Run `set-author.sql` for the exact verified email, then reload. |
| Image upload denied | Confirm your author account and the `journal-images` bucket/policies from `setup.sql`. |
| Google returns a redirect error | Match the production site callback allowlist and Google's Supabase callback exactly. |

Official references: [Vercel Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs), [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Vercel environment variables](https://vercel.com/docs/environment-variables), [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
