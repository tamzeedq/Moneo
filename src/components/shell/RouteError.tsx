import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { btn } from '@/components/ui/styles';
import { reportError } from '@/lib/report';

/** Shown in place of a page that failed to render or load. The sidebar stays usable. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  // A new deploy can remove the chunk an open tab expects; reloading fetches the current one.
  const staleChunk = error instanceof Error && /dynamically imported module|Importing a module script failed/i.test(error.message);

  useEffect(() => {
    if (!notFound) reportError(error, { source: 'route' });
  }, [error, notFound]);

  return (
    <Card className="flex max-w-[560px] flex-col gap-3 px-[22px]! py-5!">
      <h1 className="m-0 text-[18px] font-semibold">
        {notFound ? 'Page not found' : staleChunk ? 'Moneo was updated' : 'Something went wrong'}
      </h1>
      <p className="m-0 text-[13px] text-mute">
        {notFound
          ? 'There’s nothing at this address.'
          : staleChunk
            ? 'Reload to get the latest version.'
            : 'This screen hit an error. Your data is safe: it’s stored separately and nothing was lost. Reloading usually fixes it.'}
      </p>
      {!notFound && !staleChunk && error instanceof Error && (
        <pre className="m-0 max-h-32 overflow-auto rounded-[10px] bg-panel2 p-3 text-[11px] text-mute">{error.message}</pre>
      )}
      <div className="flex gap-2">
        {!notFound && (
          <button type="button" className={btn.primary} onClick={() => window.location.reload()}>
            Reload
          </button>
        )}
        <Link to="/" className={btn.secondary}>
          Back to Overview
        </Link>
      </div>
    </Card>
  );
}
