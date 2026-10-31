-- Run this first in the Supabase SQL Editor and let it finish before the next migration.
alter type public.app_role add value if not exists 'prayer_director';
