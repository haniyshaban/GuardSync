import * as React from "react";
import { fetchWithAuth } from '@/lib/api';
import { config } from '@/lib/config';

const OFFSET = 1e-4;
const MOVE_INTERVAL_MS = 5000; // move every 5s
const SYNC_INTERVAL_MS = 30000; // send updates every 30s
const API_BASE = config.apiUrl;

function randOffset() {
  return (Math.random() * 2 - 1) * OFFSET;
}

export default function useSimulation() {
  const guardsRef = React.useRef<any[]>([]);
  const moveRef = React.useRef<number | null>(null);
  const syncRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function fetchGuards() {
      try {
        const res = await fetchWithAuth(`${API_BASE}/api/guards`);
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        guardsRef.current = json.map((g: any) => ({ ...g }));
      } catch (e) {
        // ignore
      }
    }

    function start() {
      if (moveRef.current == null) {
        moveRef.current = window.setInterval(() => {
          // mutate locations in-memory
          guardsRef.current.forEach((g) => {
            try {
              if (g.location) {
                g.location.lat = Number(g.location.lat) + randOffset();
                g.location.lng = Number(g.location.lng) + randOffset();
                try {
                  g.locationHistory = g.locationHistory || [];
                  g.locationHistory.push({ lat: g.location.lat, lng: g.location.lng, at: new Date().toISOString() });
                  if (g.locationHistory.length > 50) g.locationHistory.shift();
                } catch {}
              }
            } catch {}
          });
        }, MOVE_INTERVAL_MS);
      }

      if (syncRef.current == null) {
        syncRef.current = window.setInterval(async () => {
          // send updates to server
          for (const g of guardsRef.current) {
            try {
              await fetchWithAuth(`${API_BASE}/api/guards/${g.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...g, lastSeen: new Date().toISOString() }),
              });
            } catch (e) {}
          }
          try {
            window.dispatchEvent(new CustomEvent("guards-updated"));
          } catch {}
        }, SYNC_INTERVAL_MS);
      }
    }

    function stop() {
      if (moveRef.current != null) {
        clearInterval(moveRef.current);
        moveRef.current = null;
      }
      if (syncRef.current != null) {
        clearInterval(syncRef.current);
        syncRef.current = null;
      }
    }

    // event listener for demo mode toggle
    const onDemo = (e: any) => {
      const enabled = typeof e?.detail === "boolean" ? e.detail : window.localStorage.getItem("demo_mode") === "1";
      if (enabled) start(); else stop();
    };

    fetchGuards().then(() => {
      try {
        const enabled = window.localStorage.getItem("demo_mode") === "1";
        if (enabled) start();
      } catch {}
    });

    window.addEventListener("demo-mode-changed", onDemo as EventListener);

    return () => {
      mounted = false;
      stop();
      window.removeEventListener("demo-mode-changed", onDemo as EventListener);
    };
  }, []);
}
