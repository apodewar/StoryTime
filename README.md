# StoryTime

Short fiction you can finish. Built with Next.js and Supabase.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure Supabase:

- Create a Supabase project.
- Add your project values to `.env.local`:

```
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
```

3. Create tables, policies, and storage bucket:

- Open the Supabase SQL editor.
- Run the SQL in `scripts/setup.sql`.

4. Start the app:

```bash
npm run dev
```

5. Try it out:

- Visit `/signup`, create an account (confirm email if required).
- Go to `/write`, add a cover image, and publish a story.
- Visit `/feed` to see it.

## Optional: seed sample data

If you want sample stories, add your service role key to `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then run:

```bash
npm run db:seed
```

## Optional: instant signup without email confirmation

If you want `Sign up` to immediately create and sign in users (no email confirmation step), also set:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Without this key, signup will still work but may require email confirmation based on your Supabase Auth settings.

## Optional: competition submissions by email

To enable Featured-page competition PDF submissions to be emailed, set:

```
RESEND_API_KEY=your-resend-api-key
COMPETITION_TO_EMAIL=apodewar@gmail.com
COMPETITION_FROM_EMAIL=StoryTime <onboarding@resend.dev>
```

`COMPETITION_TO_EMAIL` defaults to `apodewar@gmail.com` if omitted.

## Notes

- Cover images are stored in the `story-covers` bucket created by `scripts/setup.sql`.
- Supabase Auth must allow email/password signups.
