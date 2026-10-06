import { useLiveQuery } from 'dexie-react-hooks';
import type { MoneoData } from '@/domain/types';
import { repo } from './repository';

/** Live snapshot of all app data; re-renders when any table changes. Undefined while loading. */
export function useMoneoData(): MoneoData | undefined {
  return useLiveQuery(() => repo.loadAll(), []);
}
