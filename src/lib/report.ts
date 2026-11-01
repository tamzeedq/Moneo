/**
 * The one place errors are reported. Logs to the console for now; Phase 1 plugs Sentry in with
 * setErrorReporter() once there is a deployed environment.
 */
export type ErrorReporter = (error: unknown, context?: Record<string, unknown>) => void;

let reporter: ErrorReporter = (error, context) => console.error('[moneo]', error, context ?? '');

export function setErrorReporter(r: ErrorReporter) {
  reporter = r;
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  try {
    reporter(error, context);
  } catch {
    // Reporting must never throw into the app.
  }
}

/** Catches errors outside React: uncaught exceptions and unhandled promise rejections (e.g. a failed save). */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, { source: 'window.error' }));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, { source: 'unhandledrejection' }));
}
