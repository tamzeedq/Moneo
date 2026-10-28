/** Random UUID for new records. Postgres will use uuid primary keys, so local IDs carry over unchanged. */
export const newId = (): string => crypto.randomUUID();
