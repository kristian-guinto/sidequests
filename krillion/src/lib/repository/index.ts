import { DatabaseRepository } from './database';
import { LocalRepository } from './local';
import { GameDataRepository } from './types';

export * from './types';
export * from './local';
export * from './database';

let cachedRepo: GameDataRepository | null = null;
let cachedDriver: string | null = null;

export function resetRepositoryCache(): void {
  cachedRepo = null;
  cachedDriver = null;
}

/**
 * Returns the active GameDataRepository based on KRILLION_STORAGE_DRIVER.
 * Supported drivers:
 * - 'neon' / 'supabase' / 'database' / 'duckdb': Uses DatabaseRepository (Neon Postgres)
 * - 'local': Forces LocalRepository (useful for unit tests or offline dev)
 *
 * If KRILLION_STORAGE_DRIVER is not explicitly 'local' and DATABASE_URL is set,
 * defaults to DatabaseRepository.
 */
export function getRepository(): GameDataRepository {
  const driver = (process.env.KRILLION_STORAGE_DRIVER || '').toLowerCase();

  if (cachedRepo && cachedDriver === driver) {
    return cachedRepo;
  }

  cachedDriver = driver;

  // If explicitly requested 'local', use LocalRepository
  if (driver === 'local') {
    cachedRepo = new LocalRepository();
    return cachedRepo;
  }

  // Use DatabaseRepository when driver is 'neon', 'supabase', 'database', etc., or if DATABASE_URL is set
  if (
    driver === 'neon' ||
    driver === 'supabase' ||
    driver === 'database' ||
    driver === 'duckdb' ||
    Boolean(process.env.DATABASE_URL)
  ) {
    cachedRepo = new DatabaseRepository();
  } else {
    cachedRepo = new LocalRepository();
  }

  return cachedRepo;
}
