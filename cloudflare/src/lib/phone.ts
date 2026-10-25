// Use the same identity rule for duplicate detection, lookup, and renewals.
export function phoneKey(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (/^234\d{10}$/.test(digits)) return digits.slice(3);
  if (/^0\d{10}$/.test(digits)) return digits.slice(1);
  return digits;
}

export function phoneKeySql(column = "phone"): string {
  const digits = [" ", "+", "-", "(", ")", ".", "'", '"', "\t", "\n", "\r"]
    .reduce((sql, char) => `replace(${sql}, '${char.replace(/'/g, "''")}', '')`, `coalesce(${column}, '')`);
  return `(CASE WHEN length(${digits}) = 13 AND substr(${digits}, 1, 3) = '234' THEN substr(${digits}, 4)
    WHEN length(${digits}) = 11 AND substr(${digits}, 1, 1) = '0' THEN substr(${digits}, 2)
    ELSE ${digits} END)`;
}
