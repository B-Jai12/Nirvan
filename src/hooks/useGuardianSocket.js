// src/hooks/useGuardianSocket.js
// WebSocket hook — connects to backend /ws, auto-reconnects every 3s.
// Exposes: { agentStatus, filterStatus, sosTriggered, isConnected, lastEvent }

import { useState, useEffect, useRef, useCallback } from "react";
import { WS_URL } from "../api/config.js";

const RECONNECT_DELAY = 3000; // ms

export function useGuardianSocket() {
  const [isConnected, setIsConnected]     = useState(false);
  const [agentStatus, setAgentStatus]     = useState("offline");
  const [filterStatus, setFilterStatus]   = useState("idle");
  const [sosTriggered, setSosTriggered]   = useState(false);
  const [lastEvent, setLastEvent]         = useState(null);

  const wsRef         = useRef(null);
  const reconnectRef  = useRef(null);
  const mountedRef    = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    // Clean up any existing socket
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      console.warn("[Nirvan WS] Connection failed:", err);
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      setAgentStatus("online");
      console.log("[Nirvan WS] Connected to", WS_URL);
      // Keepalive ping every 25s
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        } else {
          clearInterval(pingInterval);
        }
      }, 25000);
      ws._pingInterval = pingInterval;
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(e.data);
        setLastEvent(msg);
        switch (msg.type) {
          case "connected":
            setAgentStatus(msg.agentStatus || "online");
            setFilterStatus(msg.filterStatus || "active");
            setSosTriggered(msg.sosTriggered || false);
            break;
          case "threat":
            setFilterStatus("threat");
            setSosTriggered(true);
            break;
          case "safe":
            setFilterStatus("safe");
            setSosTriggered(false);
            break;
          case "sos_triggered":
            setSosTriggered(true);
            break;
          case "pong":
            // keepalive ack — no state update needed
            break;
          default:
            break;
        }
      } catch {
        // non-JSON frame — ignore
      }
    };

    ws.onerror = () => {
      // onclose fires after onerror, handle reconnect there
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      clearInterval(ws._pingInterval);
      setIsConnected(false);
      setAgentStatus("offline");
      console.log("[Nirvan WS] Disconnected — reconnecting in 3s…");
      scheduleReconnect();
    };
  }, []); // eslint-disable-line

  const scheduleReconnect = useCallback(() => {
    clearTimeout(reconnectRef.current);
    reconnectRef.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, RECONNECT_DELAY);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    
    // Listen for local system events from GuardianCard
    const handleThreat = () => {
      setFilterStatus("threat");
      setSosTriggered(true);
    };
    
    const handleSafe = () => {
      setFilterStatus("safe");
      setSosTriggered(false);
    };
    
    window.addEventListener("nirvan_threat", handleThreat);
    window.addEventListener("nirvan_safe", handleSafe);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        clearInterval(wsRef.current._pingInterval);
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      window.removeEventListener("nirvan_threat", handleThreat);
      window.removeEventListener("nirvan_safe", handleSafe);
    };
  }, []); // eslint-disable-line

  return { isConnected, agentStatus, filterStatus, sosTriggered, lastEvent };
}
