-- Repair double-encoded dues_payment_history elements produced by json_group_array(value).
-- Re-parses every element so objects stay objects.
UPDATE proprietors
SET dues_payment_history = (
  SELECT json_group_array(json(e.value))
  FROM json_each(proprietors.dues_payment_history) e
)
WHERE json_valid(dues_payment_history)
  AND json_array_length(dues_payment_history) > 0
  AND EXISTS (
    SELECT 1 FROM json_each(proprietors.dues_payment_history) e
    WHERE e.type = 'text'
  );
