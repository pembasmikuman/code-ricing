/**
 * Parse the matugen colors file. Throws if it is not a flat object of
 * color strings, which also catches a file that is only half written.
 */
function parseColors(text) {
  const data = JSON.parse(text);
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected a JSON object");
  }
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string") throw new Error(`${key} is not a string`);
  }
  return data;
}

/**
 * Lay the wallpaper colors over the user's existing colorCustomizations.
 * Keys the user added by hand are kept; keys from the file win.
 * Returns null when the result is identical, so the caller can skip the write.
 */
function mergeColors(current, incoming) {
  const merged = { ...current, ...incoming };
  const changed = Object.keys(incoming).some((key) => current[key] !== incoming[key]);
  return changed ? merged : null;
}

module.exports = { parseColors, mergeColors };
