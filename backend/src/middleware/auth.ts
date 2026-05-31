// backend/src/middleware/auth.ts

import { FastifyRequest, FastifyReply } from 'fastify';

export interface JwtPayload {
  id: string;
  tenantId: string;
  role: 'admin' | 'manager' | 'engineer' | 'user';
  email: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
  }
}

export function requireRole(...roles: JwtPayload['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(request, reply);
    if (!roles.includes(request.user.role)) {
      reply.code(403).send({
        error: 'Forbidden',
        message: `Role '${request.user.role}' is not permitted for this action`,
      });
    }
  };
}
