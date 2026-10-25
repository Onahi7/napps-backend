UPDATE proprietors
SET chapters = json_array(trim((SELECT s.chapter FROM schools s WHERE s.id = proprietors.school_id))),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE (chapters IS NULL OR chapters = '' OR chapters = '[]')
  AND EXISTS (
    SELECT 1
    FROM schools s
    WHERE s.id = proprietors.school_id
      AND s.chapter IS NOT NULL
      AND trim(s.chapter) <> ''
  );
