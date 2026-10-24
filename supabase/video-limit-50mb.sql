-- Videos bucket limit 25 MB → 50 MB (24 Oct 2026). 50 MB is the free-plan maximum per file.
-- Phones shrink videos before upload (react-native-compressor), so real files are ~30 MB or less.
update storage.buckets set file_size_limit = 52428800 where id = 'videos';

-- Undo:
-- update storage.buckets set file_size_limit = 26214400 where id = 'videos';
