/**
 * Workspaces keep sample data and real data apart, each in its own local database.
 * - demo: the design's sample data with "today" pinned so screens and tests are stable.
 * - mine: the user's own data on the real clock. Phase 1 swaps this for the signed-in server workspace.
 */
import type { ISODate, MoneoData } from '@/domain/types';
import { buildSeed, SEED_TODAY } from './seed';
import { buildStarter } from './starter';

export type WorkspaceId = 'demo' | 'mine';

export interface WorkspaceConfig {
  id: WorkspaceId;
  label: string;
  dbName: string;
  /** Fixed "today", or null for the real clock. */
  clock: ISODate | null;
  /** Data a fresh database starts with (and what "reset" restores). */
  initial: () => MoneoData;
}

export const WORKSPACES: Record<WorkspaceId, WorkspaceConfig> = {
  demo: { id: 'demo', label: 'Demo', dbName: 'moneo-demo', clock: SEED_TODAY, initial: buildSeed },
  mine: { id: 'mine', label: 'My data', dbName: 'moneo-local', clock: null, initial: buildStarter },
};

export const WORKSPACE_KEY = 'moneo-workspace';

const isWorkspace = (v: unknown): v is WorkspaceId => v === 'demo' || v === 'mine';

/**
 * The active workspace: `?workspace=demo|mine` in the URL (handy for demo links) wins and is remembered,
 * then the saved choice, then "mine".
 */
export function readWorkspace(): WorkspaceId {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('workspace');
    if (isWorkspace(fromUrl)) {
      localStorage.setItem(WORKSPACE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = localStorage.getItem(WORKSPACE_KEY);
    return isWorkspace(saved) ? saved : 'mine';
  } catch {
    return 'mine';
  }
}

/** Resolved once at startup; switching reloads the app so every module sees one workspace. */
export const workspace: WorkspaceConfig = WORKSPACES[typeof window === 'undefined' ? 'demo' : readWorkspace()];

export function switchWorkspace(id: WorkspaceId) {
  try {
    localStorage.setItem(WORKSPACE_KEY, id);
  } catch {
    // Private mode: the URL parameter still carries the choice.
  }
  window.location.assign(`/?workspace=${id}`);
}
