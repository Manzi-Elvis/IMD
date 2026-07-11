import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

/**
 * Broadcasts incident changes so a room full of responders sees the same
 * timeline without refreshing. Deliberately simple: rooms keyed by
 * incident id, server-authoritative (clients never write state over the
 * socket, only receive it) — all mutations still go through the normal
 * REST endpoints + guards, the socket is read-only push. That keeps RBAC
 * enforcement in one place (HTTP guards) instead of duplicating it for a
 * websocket message handler.
 */
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' },
  namespace: 'incidents',
})
export class IncidentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(IncidentsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  // Socket connections authenticate with the same short-lived JWT used for
  // REST calls (passed as a handshake auth token), so an unauthenticated
  // client can't join rooms and eavesdrop on incident traffic.
  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('missing token');
      this.jwtService.verify(token);
    } catch {
      this.logger.warn(`Rejecting unauthenticated socket ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('incident:join')
  handleJoin(client: Socket, incidentId: string) {
    client.join(this.roomName(incidentId));
  }

  @SubscribeMessage('incident:leave')
  handleLeave(client: Socket, incidentId: string) {
    client.leave(this.roomName(incidentId));
  }

  // Called by IncidentsService after any mutation commits successfully —
  // never before, so sockets only ever see state that's actually durable.
  emitIncidentUpdated(incidentId: string, payload: unknown) {
    this.server.to(this.roomName(incidentId)).emit('incident:updated', payload);
  }

  emitNewEvent(incidentId: string, payload: unknown) {
    this.server.to(this.roomName(incidentId)).emit('incident:event', payload);
  }

  // Also broadcast to a global room so the dashboard list view can update
  // live (e.g. a new SEV1 appearing) without every client joining every
  // incident's room.
  emitIncidentCreated(payload: unknown) {
    this.server.emit('incident:created', payload);
  }

  private roomName(incidentId: string) {
    return `incident:${incidentId}`;
  }
}
