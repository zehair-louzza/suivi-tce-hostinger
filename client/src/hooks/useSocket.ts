// Socket.io connection hook for real-time updates
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { Devis, Intervention } from '../lib/api';

let socket: Socket | null = null;

export function useSocket() {
  const { isAuthenticated, accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isAuthenticated && !socketRef.current) {
      // Connect to socket server
      socketRef.current = io({
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });
    } else if (!isAuthenticated && socketRef.current) {
      // Disconnect on logout
      socketRef.current.disconnect();
      socketRef.current = null;
      socket = null;
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        socket = null;
      }
    };
  }, [isAuthenticated, accessToken]);

  // Subscribe to events
  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  // Emit events
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return { socket: socketRef.current, on, emit };
}

// Helper hook for devis real-time updates
import { useQueryClient } from '@tanstack/react-query';

export function useDevisRealtime() {
  const queryClient = useQueryClient();
  const { on } = useSocket();

  useEffect(() => {
    const unsubCreated = on('devis:created', (data: any) => {
      queryClient.setQueryData(['devis', 'list'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: [data, ...old.data],
          pagination: { ...old.pagination, total: old.pagination.total + 1 },
        };
      });
      queryClient.invalidateQueries({ queryKey: ['devis', 'stats'] });
    });

    const unsubUpdated = on('devis:updated', (data: any) => {
      queryClient.setQueryData(['devis', 'list'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((d: any) => (d.id === data.id ? data : d)),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['devis', 'stats'] });
    });

    const unsubDeleted = on('devis:deleted', (data: { id: number }) => {
      queryClient.setQueryData(['devis', 'list'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter((d: any) => d.id !== data.id),
          pagination: { ...old.pagination, total: old.pagination.total - 1 },
        };
      });
      queryClient.invalidateQueries({ queryKey: ['devis', 'stats'] });
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, [on, queryClient]);
}

export function useInterventionRealtime() {
  const queryClient = useQueryClient();
  const { on } = useSocket();

  useEffect(() => {
    const unsubCreated = on('intervention:created', (data: any) => {
      queryClient.setQueryData(['interventions', 'list'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: [data, ...old.data],
          pagination: { ...old.pagination, total: old.pagination.total + 1 },
        };
      });
      queryClient.invalidateQueries({ queryKey: ['interventions', 'stats'] });
    });

    const unsubUpdated = on('intervention:updated', (data: any) => {
      queryClient.setQueryData(['interventions', 'list'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((i: any) => (i.id === data.id ? data : i)),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['interventions', 'stats'] });
    });

    const unsubDeleted = on('intervention:deleted', (data: { id: number }) => {
      queryClient.setQueryData(['interventions', 'list'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter((i: any) => i.id !== data.id),
          pagination: { ...old.pagination, total: old.pagination.total - 1 },
        };
      });
      queryClient.invalidateQueries({ queryKey: ['interventions', 'stats'] });
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, [on, queryClient]);
}