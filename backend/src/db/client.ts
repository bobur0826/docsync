// backend/src/db/client.ts

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const sql = postgres(connectionString, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  transform: {
    column: {
      from: postgres.toCamel,
      to: postgres.fromCamel,
    },
  },
});

export type Sql = typeof sql;
