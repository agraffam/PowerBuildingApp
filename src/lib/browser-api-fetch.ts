/** Avoid stale cached JSON for auth’d API routes; always send session cookies from the browser. */
export const browserApiFetchInit: RequestInit = {
  credentials: "include",
  cache: "no-store",
};
