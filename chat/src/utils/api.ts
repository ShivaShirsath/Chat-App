const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
export const API_BASE_URL = `http://${host}:8001`;
export const WS_BASE_URL = `ws://${host}:8001`;
