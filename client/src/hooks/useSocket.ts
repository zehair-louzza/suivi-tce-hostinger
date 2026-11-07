import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { subscribeToRealtimeInvalidation, type RealtimeResource } from '../lib/realtimeInvalidation';

export function useSocket() {
 const { isAuthenticated, accessToken } = useAuthStore();
 const socketRef = useRef<Socket | null>(null);
 useEffect(() => {
  if (!isAuthenticated) return;
  const socket = io({ auth: { token: accessToken }, transports: ['websocket', 'polling'], autoConnect: true });
  socketRef.current = socket;
  socket.on('connect', () => console.log('Socket connected:', socket.id));
  socket.on('disconnect', reason => console.log('Socket disconnected:', reason));
  socket.on('connect_error', err => console.error('Socket connection error:', err.message));
  return () => {
   socket.disconnect();
   if (socketRef.current === socket) socketRef.current = null;
  };
 }, [isAuthenticated, accessToken]);

 const on = useCallback((event: string, callback: (data: any) => void) => {
  const socket = socketRef.current;
  socket?.on(event, callback);
  // Remove from the instance actually used for this subscription.
  return () => { socket?.off(event, callback); };
 }, []);
 const emit = useCallback((event: string, data?: any) => { socketRef.current?.emit(event, data); }, []);
 return { socket: socketRef.current, on, emit };
}

function useResourceRealtime(resource: RealtimeResource) {
 const queryClient = useQueryClient();
 const { on } = useSocket();
 const { isAuthenticated, accessToken } = useAuthStore();
 useEffect(() => {
  if (!isAuthenticated) return;
  const unsub = subscribeToRealtimeInvalidation(on, queryClient, resource);
  const unsubGps = resource === 'interventions'
    ? on('technicien:gps_updated', () => {
        void queryClient.invalidateQueries({ queryKey: ['referentiels'] });
        void queryClient.invalidateQueries({ queryKey: ['interventions'] });
      })
    : () => {};
  return () => {
   unsub();
   unsubGps();
  };
  // Rebind after token changes, since useSocket recreates its connection.
 }, [on, queryClient, resource, isAuthenticated, accessToken]);
}
export function useDevisRealtime() { useResourceRealtime('devis'); }
export function useInterventionRealtime() { useResourceRealtime('interventions'); }
