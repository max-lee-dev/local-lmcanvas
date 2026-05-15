import { useCallback, useEffect, useRef, useState } from "react";
import type { Provider } from "@shared/types";
import type { ProviderAuthStatus } from "@shared/ipc";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;

export type ProviderAuthState = {
  status: ProviderAuthStatus | null;
  isLoading: boolean;
  isPolling: boolean;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
};

export function useProviderAuth(provider: Provider): ProviderAuthState {
  const [status, setStatus] = useState<ProviderAuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  // Refs avoid restarting the interval on every status update.
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await window.api.providers.authStatus(provider);
      if (mountedRef.current) setStatus(next);
      return next;
    } catch {
      if (mountedRef.current) {
        setStatus({
          provider,
          installed: false,
          authenticated: false,
          binPath: null,
          detail: "Failed to probe CLI",
        });
      }
      return null;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [provider]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    pollCountRef.current = 0;
    if (mountedRef.current) setIsPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    pollCountRef.current = 0;
    setIsPolling(true);
    intervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      const next = await refresh();
      if (next?.authenticated || pollCountRef.current >= MAX_POLLS) {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [refresh, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refresh]);

  return { status, isLoading, isPolling, refresh: async () => { await refresh(); }, startPolling, stopPolling };
}
