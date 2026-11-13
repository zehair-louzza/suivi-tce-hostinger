// Socket.io — temps réel avec isolation STRICTE entre entreprises.
//
// Règles :
//  - une connexion ne rejoint que SA salle d'entreprise et SA salle personnelle, déduites du jeton ;
//    un jeton sans entreprise est refusé (aucune entreprise de repli) ;
//  - un client ne peut pas rejoindre une autre salle (join:room ne sert que pour ses propres salles) ;
//  - le temps réel ne transporte aucune donnée métier, seulement un signal (voir signalOf) ;
//  - chaque événement émis par le serveur nomme explicitement l'entreprise destinataire, et n'est jamais
//    diffusé à toutes les connexions.
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  companyId?: number;
  iat: number;
  exp: number;
}

interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

let ioInstance: Server;

export function setSocketInstance(io: Server) {
  ioInstance = io;
}

function getIO(): Server {
  if (!ioInstance) {
    throw new Error('Socket.io instance not initialized. Call setSocketInstance() first.');
  }
  return ioInstance;
}

const companyRoom = (companyId: number) => `company:${companyId}`;
const userRoom = (userId: number) => `user:${userId}`;

function isValidCompanyId(companyId: unknown): companyId is number {
  return typeof companyId === 'number' && Number.isInteger(companyId) && companyId > 0;
}

/** Salles auxquelles une connexion a le droit : les siennes, et uniquement les siennes. */
export function allowedRoomsFor(user: Pick<TokenPayload, 'userId' | 'companyId'>): string[] {
  const rooms = [userRoom(user.userId)];
  if (isValidCompanyId(user.companyId)) rooms.push(companyRoom(user.companyId));
  return rooms;
}

export function setupSocketHandlers(io: Server) {
  ioInstance = io;

  // Authentification des sockets : le jeton fixe l'utilisateur ET l'entreprise
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.cookie?.split('; ').find((c) => c.startsWith('accessToken='))?.split('=')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
      if (!isValidCompanyId(decoded.companyId)) {
        return next(new Error('Account not attached to a company'));
      }
      socket.user = decoded;
      for (const room of allowedRoomsFor(decoded)) socket.join(room);
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.user?.userId}, company: ${socket.user?.companyId})`);

    // Un client ne peut rejoindre que ses propres salles : toute autre demande est ignorée.
    socket.on('join:room', (room: string) => {
      if (socket.user && allowedRoomsFor(socket.user).includes(room)) {
        socket.join(room);
      }
    });

    socket.on('leave:room', (room: string) => {
      socket.leave(room);
    });

    socket.on('subscribe:user', () => {
      if (socket.user) {
        for (const room of allowedRoomsFor(socket.user)) socket.join(room);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} (reason: ${reason})`);
    });

    socket.on('error', (err) => {
      console.error(`Socket error ${socket.id}:`, err);
    });
  });
}

/**
 * Émet un événement à l'utilisateur concerné et à SON entreprise uniquement.
 * Sans entreprise valide, rien n'est émis (on ne devine jamais un destinataire).
 */
function emitScoped(userId: number, companyId: number, event: string, data: unknown) {
  if (!isValidCompanyId(companyId)) return;
  getIO().to(userRoom(userId)).to(companyRoom(companyId)).emit(event, signalOf(data));
}

/**
 * Le temps réel ne transporte JAMAIS de données métier : seulement un signal « quelque chose a changé »
 * avec l'identifiant concerné. Chaque écran recharge ensuite, par l'API, ce que son rôle a le droit de voir.
 * (Avant, le devis ou l'intervention complet, montants compris, partait à toute l'entreprise.)
 */
export function signalOf(data: unknown): { id: number | null } {
  const id = (data as { id?: unknown } | null | undefined)?.id;
  return { id: typeof id === 'number' && Number.isInteger(id) ? id : null };
}

// Émetteurs d'événements pour les routes : l'entreprise est TOUJOURS un paramètre explicite.
export const socketEvents = {
  // Devis
  devisCreated: (userId: number, companyId: number, data: any) => emitScoped(userId, companyId, 'devis:created', data),
  devisUpdated: (userId: number, companyId: number, data: any) => emitScoped(userId, companyId, 'devis:updated', data),
  devisDeleted: (userId: number, companyId: number, data: any) => emitScoped(userId, companyId, 'devis:deleted', data),

  // Interventions
  interventionCreated: (userId: number, companyId: number, data: any) =>
    emitScoped(userId, companyId, 'intervention:created', data),
  interventionUpdated: (userId: number, companyId: number, data: any) =>
    emitScoped(userId, companyId, 'intervention:updated', data),
  interventionDeleted: (userId: number, companyId: number, data: any) =>
    emitScoped(userId, companyId, 'intervention:deleted', data),

  // Notification personnelle : seul le destinataire est prévenu (signal sans contenu)
  notificationNew: (userId: number, data: any) => {
    getIO().to(userRoom(userId)).emit('notification:new', signalOf(data));
  },

  // Diffusion à une seule entreprise
  broadcastCompany: (companyId: number, event: string, data: any) => {
    if (!isValidCompanyId(companyId)) return;
    getIO().to(companyRoom(companyId)).emit(event, signalOf(data));
  },
};
