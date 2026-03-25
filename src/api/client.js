// src/api/client.js
// Reusable API functions — use these everywhere instead of raw fetch("/api/...")

import { API_BASE } from "./config.js";

/**
 * Analyze a transcript for threats.
 * @param {string} transcript - Text from Web Speech API
 * @returns {Promise<{ threat_detected: boolean, confidence: number, detail: string }>}
 */
export async function analyzeAudio(transcript, { location, contacts } = {}) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/audio/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, location, contacts }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[Nirvan] analyzeAudio failed:", err.message);
    // Graceful degradation — return safe
    return { threat_detected: false, confidence: 60, detail: "Backend unavailable." };
  }
}

/**
 * Analyze a video frame for physical threats.
 * @param {string} imageData - Base64 encoded image string
 * @returns {Promise<{ threat_detected: boolean, confidence: number, detail: string }>}
 */
export async function analyzeVideo(imageData) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/vision/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_b64: imageData }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[Nirvan] analyzeVideo failed:", err.message);
    return { threat_detected: false, confidence: 60, detail: "Backend unavailable." };
  }
}

/**
 * Send an emergency SMS alert.
 * @param {string} to   - Phone number (E.164 format, e.g. "+919876543210")
 * @param {string} message - SMS body text
 * @returns {Promise<{ success: boolean }>}
 */
export async function sendSMSAlert(to, message) {
  try {
    const res = await fetch(`${API_BASE}/api/emergency/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[Nirvan] sendSMSAlert failed:", err.message);
    return { success: false };
  }
}

/**
 * Ping health endpoint — returns true if backend is up.
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/audio/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
