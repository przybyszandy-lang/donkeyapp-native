-- Raise the videos bucket limit to 100 MB. RUN ONLY AFTER UPGRADING SUPABASE TO PRO
-- (free plan caps every file at 50 MB) and after raising the project's global upload
-- limit to at least 100 MB (Supabase dashboard → Storage → Settings).
update storage.buckets set file_size_limit = 104857600 where id = 'videos';

-- Undo:
-- update storage.buckets set file_size_limit = 26214400 where id = 'videos';
