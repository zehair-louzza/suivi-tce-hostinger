// Socket.io handlers for real-time updates with multi-tenant company isolation
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

export function setupSocketHandlers(io: Server) {
  ioInstance = io;
  
  // Authentication middleware for sockets
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token || 
        socket.handshake.headers.cookie?.split('; ').find(c => c.startsWith('accessToken='))?.split('=')[1];
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
      socket.user = decoded;
      socket.join(`user:${decoded.userId}`);
      socket.join(`company:${decoded.companyId || 1}`);
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.user?.userId}, company: ${socket.user?.companyId || 1})`);

    socket.on('join:room', (room: string) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave:room', (room: string) => {
      socket.leave(room);
    });

    socket.on('subscribe:user', () => {
      if (socket.user) {
        socket.join(`user:${socket.user.userId}`);
        socket.join(`company:${socket.user.companyId || 1}`);
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

// Event emitters for use in routes
export const socketEvents = {
  // Devis events
  devisCreated: (userId: number, data: any) => {
    const compId = data?.companyId || 1;
    getIO().to(`user:${userId}`).emit('devis:created', data);
    getIO().to(`company:${compId}`).emit('devis:created', data);
  },
  devisUpdated: (userId: number, data: any) => {
    const compId = data?.companyId || 1;
    getIO().to(`user:${userId}`).emit('devis:updated', data);
    getIO().to(`company:${compId}`).emit('devis:updated', data);
  },
  devisDeleted: (userId: number, data: any) => {
    const compId = data?.companyId || 1;
    getIO().to(`user:${userId}`).emit('devis:deleted', data);
    getIO().to(`company:${compId}`).emit('devis:deleted', data);
  },

  // Intervention events
  interventionCreated: (userId: number, data: any) => {
    const compId = data?.companyId || 1;
    getIO().to(`user:${userId}`).emit('intervention:created', data);
    getIO().to(`company:${compId}`).emit('intervention:created', data);
  },
  interventionUpdated: (userId: number, data: any) => {
    const compId = data?.companyId || 1;
    getIO().to(`user:${userId}`).emit('intervention:updated', data);
    getIO().to(`company:${compId}`).emit('intervention:updated', data);
  },
  interventionDeleted: (userId: number, data: any) => {
    const compId = data?.companyId || 1;
    getIO().to(`user:${userId}`).emit('intervention:deleted', data);
    getIO().to(`company:${compId}`).emit('intervention:deleted', data);
  },

  // Broadcast to company
  broadcastCompany: (companyId: number, event: string, data: any) => {
    getIO().to(`company:${companyId || 1}`).emit(event, data);
  },

  // Broadcast
  broadcast: (event: string, data: any, companyId?: number) => {
    if (companyId) {
      getIO().to(`company:${companyId}`).emit(event, data);
    } else {
      getIO().emit(event, data);
    }
  },
};
