/** Mirror of the API's code normalization (uppercase, no accents, symbols -> _). */
export const normalizeCode = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
