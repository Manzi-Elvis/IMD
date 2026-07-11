import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Incident, IncidentEvent } from '../types';

const SOCKET_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000/incidents';

interface UseIncidentSocketParams {
  incidentId: string | null;
  token: string | null;
  onIncidentUpdated: (incident: Incident) => void;
  onNewEvent: (event: IncidentEvent) => void;
}

/**
 * Joins the room for a single incident and re-renders on server push,
 * rather than polling. The socket authenticates with the same short-lived
 * JWT as REST calls (see backend IncidentsGateway.handleConnection) — if
 * the token has expired, the server disconnects us and the normal 401
 * flow on the next REST call handles re-auth.
 */
export function useIncidentSocket({
  incidentId,
  token,
  onIncidentUpdated,
  onNewEvent,
}: UseIncidentSocketParams) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!incidentId || !token) return;

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.emit('incident:join', incidentId);
    socket.on('incident:updated', onIncidentUpdated);
    socket.on('incident:event', onNewEvent);

    return () => {
      socket.emit('incident:leave', incidentId);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId, token]);
}
