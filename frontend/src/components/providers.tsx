"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// ── React Query ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s — jobs data refreshes often
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Socket.io context ────────────────────────────────────────────────────────
interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function useSocket() {
  return useContext(SocketContext);
}

function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const gatewayUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";

    socketRef.current = io(gatewayUrl, {
      transports: ["websocket", "polling"],
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    const s = socketRef.current;

    s.on("connect", () => {
      console.log("[Socket] connected:", s.id);
      setConnected(true);
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    // Real-time job events
    s.on("job:discovered", (job) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["funnel"] });
    });

    s.on("job:scored", (job) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    });

    s.on("application:status_changed", () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["funnel"] });
    });

    s.on("scrape:started", ({ portal }: { portal: string }) => {
      console.log("[Scrape] started:", portal);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

// ── Root Providers ───────────────────────────────────────────────────────────
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        {children}
      </SocketProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
