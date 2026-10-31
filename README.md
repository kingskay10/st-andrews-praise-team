# St Andrews CCAP Praise Team

The active GitHub Pages site is a static HTML/CSS/vanilla JavaScript frontend in `docs/`, backed by Supabase for Postgres, authentication, and storage. The former PHP + MySQL application is preserved in `php-original/`.

## Features found in the original PHP application

- Public home page with today's verse, upcoming/past events, photo highlights, recent updates, published department reports, and FAQs.
- Email/password login, logout, and role-based dashboard routing for chair, secretary, music director, band/worship director, prayer director, and member.
- Member-only directory and community photo gallery with likes, comments, replies, sharing, and copy-link actions. Shared-gallery uploads appear publicly; profile and member workspace photos remain private.
- Member workspace for profile updates and profile/gallery photo uploads.
- Chair tools for the directory, event creation with poster/attachment, public updates, and approving department reports.
- Secretary-only finance records for monthly contributions and offerings, plus financial report submission.
- Music and band director workspaces for department plans and reports.
- Prayer Director workspace for the verse of the day and daily prayer points.
- Public search, privacy policy, and terms pages.

## Supabase setup

1. Create a Supabase project at [supabase.com](https://supabase.com/). Choose a strong database password and keep it private.
2. In the Supabase project, open **SQL Editor**, create a new query, paste all of `supabase/schema.sql`, and run it once. It creates the PostgreSQL tables, auth profile/role trigger, row-level security policies, and the storage buckets.
3. In **Storage**, confirm these buckets exist and have these settings:
   - `event-media`: public, 10 MB maximum; JPEG, PNG, WEBP, PDF, DOC, and DOCX.
   - `member-media`: private, 10 MB maximum; JPEG, PNG, and WEBP.
   - `gallery-public`: public, 10 MB maximum; JPEG, PNG, and WEBP. Only photos uploaded through the shared gallery use this bucket.
   The SQL applies storage object policies; do not make `member-media` public.
4. Open **Project Settings > API**. Copy the Project URL and the `anon`/publishable public key into `docs/js/config.js`. Do not put a `service_role` or secret key in any file under `docs/` or in browser JavaScript.
5. Create the first chair account in **Authentication > Users > Add user**. Use the chair's name, email, and a long unique password. The schema trigger creates a profile and default `member` role.
6. In **SQL Editor**, run this one-time role assignment, replacing the email:

   ```sql
   update public.roles
   set role = 'chair'
   where user_id = (
     select id from public.profiles
     where email = 'chair@example.org'
   );
   ```

7. Sign in at `docs/login.html`. The chair can invite members and assign roles from **Manage Members** after deploying the invitation function described below.
8. In **Authentication > Settings**, disable public sign-ups if only chair-invited team accounts should be allowed. Configure custom SMTP under Authentication settings so invitation emails can be delivered to members.
9. In **Authentication > URL Configuration**, set the Site URL to `https://kingskay10.github.io/st-andrews-praise-team` (no trailing slash) and add `https://kingskay10.github.io/st-andrews-praise-team/**` to the redirect URL allow-list. This permits invitation links to return to `set-password.html`.
10. Commit and push the project to the `main` branch on GitHub.
11. In GitHub, open **Settings > Pages > Build and deployment**, choose **Deploy from a branch**, select branch **main** and folder **/docs**, then select **Save**.
12. After the Pages deployment completes, visit `https://kingskay10.github.io/st-andrews-praise-team/`.

GitHub Pages is static hosting; it does not execute PHP. The public website uses only the Supabase anon key, and database/storage RLS is the security boundary. The chair's initial role is assigned in Supabase SQL Editor because a browser-only client must not be allowed to self-assign privileged roles.

## Enable Member Invitations and Prayer Director

For the already-created Supabase project, do not rerun the base schema. In the Supabase SQL Editor, run these as separate queries, in order, and wait for success after each:

1. `supabase/migrations/202610270001_add_prayer_director_role.sql`
2. `supabase/migrations/202610270002_prayer_points_and_policies.sql`
3. `supabase/migrations/202610310001_public_gallery_photos.sql`

Deploy the chair invitation function from PowerShell in this repository:

1. Install the Supabase CLI, run `supabase login`, then link the project with `supabase link --project-ref tkrhbfocezqyjebohvkz`.
2. Set the Pages URL for invitation redirects: `supabase secrets set SITE_URL=https://kingskay10.github.io/st-andrews-praise-team` (no trailing slash).
3. Deploy the function with `supabase functions deploy invite-member --project-ref tkrhbfocezqyjebohvkz`.
4. Commit and push the updated `docs/`, `supabase/`, and README changes, then wait for GitHub Pages to redeploy.

The chair's **Manage Members** tab sends an email invitation, saves the selected role and profile, and directs the invitee to set their own password. They sign in using the email entered by the chair. Configure custom SMTP in Supabase Auth for invitations to arbitrary member addresses. Assign **Prayer Director** through the invitation form or member edit action. The Prayer Director dashboard publishes the daily verse and today's prayer points, which appear on the public homepage for that date.

The Edge Function uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY` environment secret. Never put that key in `docs/js/config.js`, other browser code, or a public repository.

## Data migration and privacy

The MySQL schema is `database/schema.sql`. The PostgreSQL equivalent is `supabase/schema.sql`, but existing MySQL rows and passwords are not migrated automatically. Password hashes are incompatible with Supabase Auth; create/invite users in Supabase and migrate only approved profile/content data using a trusted one-time migration process. Do not copy MySQL password hashes into `profiles`.

Never commit real member names, email addresses, phone numbers, profile/gallery photos, passwords, or financial/contribution/offerings records to a public repository. Keep Supabase backups and exports private. The root `.gitignore` excludes `uploads/`, local environment files, private key files, and common SQL backup/dump files; `.gitignore` does not remove data that was already committed.

## Security scan

The inspected legacy config `php-original/config/config.php` reads database settings from `PRAISE_DB_*` environment variables and uses an empty local password fallback; it contained no literal database password, API key, or service-role key. The repository had no `.gitignore` before this migration, so one was added. Keep credentials out of tracked files and rotate any value that was ever committed publicly.

## Features that need an admin-side workaround

- Creating Auth users from the chair dashboard requires deploying `supabase/functions/invite-member`; resetting credentials still uses Supabase Auth. The service-role key remains only in the Edge Function environment.
- The original PHP app includes server-side form/CSRF handling and MySQL password verification. Supabase Auth replaces password handling, and RLS replaces server-side row authorization; the browser never receives a service-role key.
- Existing MySQL records and account passwords require a separate, trusted migration. The static app does not import private data automatically.

For local preview, serve `docs/` from a static web server; opening pages directly from `file://` can block browser requests to Supabase. No build step is required.
