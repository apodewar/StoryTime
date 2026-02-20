create extension if not exists "pgcrypto";

-- PROFILES
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists username text;
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists created_at timestamptz not null default now();

create index if not exists profiles_display_name_idx on profiles (display_name);
create index if not exists profiles_username_idx on profiles (username);

-- STORIES
create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  slug text not null unique,
  synopsis_1 text,
  body text not null,
  length_class text not null check (length_class in ('flash', 'short', 'storytime')),
  genre text not null,
  cover_image_url text,
  published_at timestamptz,
  is_public_domain boolean not null default false,
  reading_time integer not null default 1,
  tags text,
  content_warnings text,
  original_author text,
  status text not null default 'published' check (status in ('draft', 'pending', 'published', 'hidden')),
  cover_url text,
  cover_path text,
  created_at timestamptz not null default now()
);

alter table stories add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table stories add column if not exists title text;
alter table stories add column if not exists slug text;
alter table stories add column if not exists synopsis_1 text;
alter table stories add column if not exists body text;
alter table stories add column if not exists length_class text;
alter table stories add column if not exists genre text;
alter table stories add column if not exists cover_image_url text;
alter table stories add column if not exists published_at timestamptz;
alter table stories add column if not exists is_public_domain boolean not null default false;
alter table stories add column if not exists reading_time integer not null default 1;
alter table stories add column if not exists tags text;
alter table stories add column if not exists content_warnings text;
alter table stories add column if not exists original_author text;
alter table stories add column if not exists status text not null default 'published';
alter table stories add column if not exists cover_url text;
alter table stories add column if not exists cover_path text;
alter table stories add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'cover_url'
  ) then
    update stories
    set cover_image_url = coalesce(cover_image_url, cover_url)
    where cover_image_url is null and cover_url is not null;
  end if;
end $$;

create unique index if not exists stories_slug_unique_idx on stories (slug);
create index if not exists stories_status_published_at_idx on stories (status, published_at desc);
create index if not exists stories_public_domain_idx on stories (is_public_domain);
create index if not exists stories_author_idx on stories (author_id);

-- SHELVES
create table if not exists shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists shelves_user_id_idx on shelves (user_id);

create or replace function public.handle_new_user_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    split_part(coalesce(new.email, ''), '@', 1),
    split_part(coalesce(new.email, ''), '@', 1)
  )
  on conflict (id) do nothing;

  insert into public.shelves (user_id, name)
  values (new.id, 'Read Later')
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_defaults on auth.users;
create trigger on_auth_user_created_defaults
  after insert on auth.users
  for each row execute procedure public.handle_new_user_defaults();

create table if not exists shelf_items (
  shelf_id uuid not null references shelves(id) on delete cascade,
  story_id uuid not null references stories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shelf_id, story_id)
);

create index if not exists shelf_items_story_id_idx on shelf_items (story_id);

-- SOCIAL
create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on follows (following_id);

create table if not exists reactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references stories(id) on delete cascade,
  value text not null check (value in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create index if not exists reactions_story_id_idx on reactions (story_id);

-- EVENTS + VISIBILITY
create table if not exists story_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anon_session_id text,
  story_id uuid not null references stories(id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists story_events_story_id_idx on story_events (story_id);
create index if not exists story_events_user_id_idx on story_events (user_id);

create table if not exists story_visibility (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_session_id text,
  story_id uuid not null references stories(id) on delete cascade,
  dismissed boolean not null default false,
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or anon_session_id is not null)
);

create unique index if not exists story_visibility_user_story_unique_idx
  on story_visibility (user_id, story_id)
  where user_id is not null;

create unique index if not exists story_visibility_anon_story_unique_idx
  on story_visibility (anon_session_id, story_id)
  where anon_session_id is not null;

-- USER SETTINGS
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  feed_view_mode text not null default 'cover' check (feed_view_mode in ('cover', 'list')),
  reader_mode text not null default 'scroll' check (reader_mode in ('scroll', 'page')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ADMIN ACCESS CONTROL
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- CURATED DISCOVERY SURFACES
create table if not exists editorial_picks (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  month_label date not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (story_id, month_label)
);

create index if not exists editorial_picks_month_label_idx on editorial_picks (month_label desc);
create index if not exists editorial_picks_sort_order_idx on editorial_picks (sort_order asc);

create table if not exists featured_items (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  title_override text,
  subtitle text,
  sort_order integer not null default 100,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists featured_items_sort_order_idx on featured_items (sort_order asc);
create index if not exists featured_items_active_idx on featured_items (is_active, starts_at, ends_at);

-- LEGACY TABLES (kept for current app compatibility)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists story_likes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (story_id, user_id)
);

create table if not exists story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists story_comment_likes (
  comment_id uuid not null references story_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists reports_story_id_idx on reports (story_id);
create index if not exists completions_story_id_idx on completions (story_id);
create index if not exists story_likes_story_id_idx on story_likes (story_id);
create index if not exists story_comments_story_id_idx on story_comments (story_id);
create index if not exists story_comment_likes_comment_id_idx on story_comment_likes (comment_id);

-- RLS
alter table profiles enable row level security;
alter table stories enable row level security;
alter table shelves enable row level security;
alter table shelf_items enable row level security;
alter table follows enable row level security;
alter table reactions enable row level security;
alter table story_events enable row level security;
alter table story_visibility enable row level security;
alter table reports enable row level security;
alter table completions enable row level security;
alter table story_likes enable row level security;
alter table story_comments enable row level security;
alter table story_comment_likes enable row level security;
alter table editorial_picks enable row level security;
alter table featured_items enable row level security;
alter table user_settings enable row level security;
alter table admin_users enable row level security;

drop policy if exists "profiles_public_read" on profiles;
create policy "profiles_public_read"
  on profiles for select
  using (true);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id);

drop policy if exists "stories_public_read_published" on stories;
create policy "stories_public_read_published"
  on stories for select
  using (status = 'published' or is_public_domain = true or auth.uid() = author_id);

drop policy if exists "stories_insert_own" on stories;
create policy "stories_insert_own"
  on stories for insert
  with check (auth.uid() = author_id);

drop policy if exists "stories_update_own" on stories;
create policy "stories_update_own"
  on stories for update
  using (auth.uid() = author_id);

drop policy if exists "stories_admin_read" on stories;
create policy "stories_admin_read"
  on stories for select
  using (exists (select 1 from admin_users a where a.user_id = auth.uid()));

drop policy if exists "stories_admin_update" on stories;
create policy "stories_admin_update"
  on stories for update
  using (exists (select 1 from admin_users a where a.user_id = auth.uid()));

drop policy if exists "stories_delete_own" on stories;
create policy "stories_delete_own"
  on stories for delete
  using (auth.uid() = author_id);

drop policy if exists "shelves_select_own" on shelves;
create policy "shelves_select_own"
  on shelves for select
  using (auth.uid() = user_id);

drop policy if exists "shelves_insert_own" on shelves;
create policy "shelves_insert_own"
  on shelves for insert
  with check (auth.uid() = user_id);

drop policy if exists "shelves_update_own" on shelves;
create policy "shelves_update_own"
  on shelves for update
  using (auth.uid() = user_id);

drop policy if exists "shelves_delete_own" on shelves;
create policy "shelves_delete_own"
  on shelves for delete
  using (auth.uid() = user_id);

drop policy if exists "shelf_items_select_own" on shelf_items;
create policy "shelf_items_select_own"
  on shelf_items for select
  using (exists (
    select 1 from shelves s where s.id = shelf_items.shelf_id and s.user_id = auth.uid()
  ));

drop policy if exists "shelf_items_insert_own" on shelf_items;
create policy "shelf_items_insert_own"
  on shelf_items for insert
  with check (exists (
    select 1 from shelves s where s.id = shelf_items.shelf_id and s.user_id = auth.uid()
  ));

drop policy if exists "shelf_items_delete_own" on shelf_items;
create policy "shelf_items_delete_own"
  on shelf_items for delete
  using (exists (
    select 1 from shelves s where s.id = shelf_items.shelf_id and s.user_id = auth.uid()
  ));

drop policy if exists "follows_public_read" on follows;
create policy "follows_public_read"
  on follows for select
  using (true);

drop policy if exists "follows_insert_own" on follows;
create policy "follows_insert_own"
  on follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on follows;
create policy "follows_delete_own"
  on follows for delete
  using (auth.uid() = follower_id);

drop policy if exists "reactions_public_read" on reactions;
create policy "reactions_public_read"
  on reactions for select
  using (true);

drop policy if exists "reactions_insert_own" on reactions;
create policy "reactions_insert_own"
  on reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "reactions_update_own" on reactions;
create policy "reactions_update_own"
  on reactions for update
  using (auth.uid() = user_id);

drop policy if exists "reactions_delete_own" on reactions;
create policy "reactions_delete_own"
  on reactions for delete
  using (auth.uid() = user_id);

drop policy if exists "story_events_insert_authenticated_or_anon" on story_events;
create policy "story_events_insert_authenticated_or_anon"
  on story_events for insert
  with check (
    auth.role() = 'authenticated'
    or (auth.role() = 'anon' and user_id is null and anon_session_id is not null)
  );

drop policy if exists "story_events_public_read" on story_events;
create policy "story_events_public_read"
  on story_events for select
  using (true);

drop policy if exists "story_visibility_select_own_or_anon" on story_visibility;
create policy "story_visibility_select_own_or_anon"
  on story_visibility for select
  using (
    auth.uid() = user_id
    or (auth.role() = 'anon' and user_id is null)
  );

drop policy if exists "story_visibility_insert_own_or_anon" on story_visibility;
create policy "story_visibility_insert_own_or_anon"
  on story_visibility for insert
  with check (
    auth.uid() = user_id
    or (auth.role() = 'anon' and user_id is null and anon_session_id is not null)
  );

drop policy if exists "story_visibility_update_own_or_anon" on story_visibility;
create policy "story_visibility_update_own_or_anon"
  on story_visibility for update
  using (
    auth.uid() = user_id
    or (auth.role() = 'anon' and user_id is null)
  );

drop policy if exists "story_visibility_delete_own_or_anon" on story_visibility;
create policy "story_visibility_delete_own_or_anon"
  on story_visibility for delete
  using (
    auth.uid() = user_id
    or (auth.role() = 'anon' and user_id is null)
  );

-- compatibility policies for existing app tables
drop policy if exists "reports_insert_authenticated" on reports;
create policy "reports_insert_authenticated"
  on reports for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "reports_admin_read" on reports;
create policy "reports_admin_read"
  on reports for select
  using (exists (select 1 from admin_users a where a.user_id = auth.uid()));

drop policy if exists "completions_insert_any" on completions;
create policy "completions_insert_any"
  on completions for insert
  with check (true);

drop policy if exists "completions_public_read" on completions;
create policy "completions_public_read"
  on completions for select
  using (true);

drop policy if exists "story_likes_public_read" on story_likes;
create policy "story_likes_public_read"
  on story_likes for select
  using (true);

drop policy if exists "story_likes_insert_own" on story_likes;
create policy "story_likes_insert_own"
  on story_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "story_likes_delete_own" on story_likes;
create policy "story_likes_delete_own"
  on story_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "story_comments_public_read" on story_comments;
create policy "story_comments_public_read"
  on story_comments for select
  using (true);

drop policy if exists "story_comments_insert_own" on story_comments;
create policy "story_comments_insert_own"
  on story_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "story_comment_likes_public_read" on story_comment_likes;
create policy "story_comment_likes_public_read"
  on story_comment_likes for select
  using (true);

drop policy if exists "story_comment_likes_insert_own" on story_comment_likes;
create policy "story_comment_likes_insert_own"
  on story_comment_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from story_comments c
      where c.id = story_comment_likes.comment_id
        and c.user_id is distinct from auth.uid()
    )
  );

drop policy if exists "story_comment_likes_delete_own" on story_comment_likes;
create policy "story_comment_likes_delete_own"
  on story_comment_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "shelf_items_public_read" on shelf_items;
create policy "shelf_items_public_read"
  on shelf_items for select
  using (true);

drop policy if exists "editorial_picks_public_read" on editorial_picks;
create policy "editorial_picks_public_read"
  on editorial_picks for select
  using (true);

drop policy if exists "editorial_picks_write_authenticated" on editorial_picks;
create policy "editorial_picks_write_authenticated"
  on editorial_picks for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "featured_items_public_read" on featured_items;
create policy "featured_items_public_read"
  on featured_items for select
  using (true);

drop policy if exists "featured_items_write_authenticated" on featured_items;
create policy "featured_items_write_authenticated"
  on featured_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "user_settings_select_own" on user_settings;
create policy "user_settings_select_own"
  on user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on user_settings;
create policy "user_settings_insert_own"
  on user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on user_settings;
create policy "user_settings_update_own"
  on user_settings for update
  using (auth.uid() = user_id);

drop policy if exists "admin_users_select_own" on admin_users;
create policy "admin_users_select_own"
  on admin_users for select
  using (auth.uid() = user_id);

-- storage bucket for story covers
insert into storage.buckets (id, name, public)
values ('story-covers', 'story-covers', true)
on conflict (id) do update set public = true;

drop policy if exists "story_covers_public_read" on storage.objects;
create policy "story_covers_public_read"
  on storage.objects for select
  using (bucket_id = 'story-covers');

drop policy if exists "story_covers_insert_authenticated" on storage.objects;
create policy "story_covers_insert_authenticated"
  on storage.objects for insert
  with check (bucket_id = 'story-covers' and auth.role() = 'authenticated');

drop policy if exists "story_covers_update_owner" on storage.objects;
create policy "story_covers_update_owner"
  on storage.objects for update
  using (bucket_id = 'story-covers' and owner = auth.uid());

drop policy if exists "story_covers_delete_owner" on storage.objects;
create policy "story_covers_delete_owner"
  on storage.objects for delete
  using (bucket_id = 'story-covers' and owner = auth.uid());
