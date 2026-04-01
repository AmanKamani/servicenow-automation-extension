/**
 * Validates automation input.
 * With dynamic field configs, the payload is a generic key-value object.
 * We just check it's a non-empty object with at least one non-empty value.
 *
 * Returns { valid: true, data } or { valid: false, errors: string[] }.
 */
function validateInput(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: ["Input must be a JSON object."] };
  }

  const keys = Object.keys(raw);
  if (keys.length === 0) {
    return { valid: false, errors: ["Payload is empty — no fields to fill."] };
  }

  const hasValue = keys.some((k) => {
    const v = raw[k];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    return v !== null && v !== undefined;
  });

  if (!hasValue) {
    return { valid: false, errors: ["All payload values are empty."] };
  }

  // Trim string values, pass through arrays
  const data = {};
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string") {
      data[k] = v.trim();
    } else if (Array.isArray(v)) {
      data[k] = v.map((item) => (typeof item === "string" ? item.trim() : item)).filter(Boolean);
    } else {
      data[k] = v;
    }
  }

  return { valid: true, data };
}

if (typeof module !== "undefined") {
  module.exports = { validateInput };
}
