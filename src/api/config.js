// src/api/config.js
// Central API configuration — reads from .env (VITE_ prefix required by Vite)

export const API_BASE = import.meta.env.VITE_API_URL || "";
export const WS_URL   = import.meta.env.VITE_WS_URL  || "";
