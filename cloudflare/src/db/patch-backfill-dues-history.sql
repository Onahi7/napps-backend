-- Harmonize: backfill proprietors.dues_payment_history from successful payments.
-- Safe/idempotent: only appends payments whose reference is not already in history.
UPDATE proprietors AS p
SET dues_payment_history = (
  SELECT json_group_array(value)
  FROM (
    SELECT value FROM json_each(p.dues_payment_history)
    UNION ALL
    SELECT json_object(
      'sessionId',
      COALESCE(
        NULLIF(pay.session_id, ''),
        NULLIF(json_extract(pay.metadata, '$.sessionId'), ''),
        CASE
          WHEN CAST(strftime('%m', COALESCE(pay.paid_at, pay.created_at)) AS INTEGER) >= 9
            THEN strftime('%Y', COALESCE(pay.paid_at, pay.created_at)) || '/' ||
                 (CAST(strftime('%Y', COALESCE(pay.paid_at, pay.created_at)) AS INTEGER) + 1)
          ELSE (CAST(strftime('%Y', COALESCE(pay.paid_at, pay.created_at)) AS INTEGER) - 1) || '/' ||
                 strftime('%Y', COALESCE(pay.paid_at, pay.created_at))
        END
      ),
      'amountPaid', pay.amount / 100.0,
      'paymentDate', COALESCE(pay.paid_at, pay.created_at),
      'receiptNumber', pay.reference,
      'status', 'confirmed',
      'paymentType', COALESCE(pay.payment_type, 'registration_fee'),
      'gateway', COALESCE(pay.gateway, 'mock')
    )
    FROM payments pay
    WHERE pay.proprietor_id = p.id
      AND pay.status = 'success'
      AND NOT EXISTS (
        SELECT 1 FROM json_each(p.dues_payment_history) e
        WHERE json_extract(e.value, '$.receiptNumber') = pay.reference
      )
  )
)
WHERE EXISTS (
  SELECT 1 FROM payments pay
  WHERE pay.proprietor_id = p.id
    AND pay.status = 'success'
    AND NOT EXISTS (
      SELECT 1 FROM json_each(p.dues_payment_history) e
      WHERE json_extract(e.value, '$.receiptNumber') = pay.reference
    )
);
