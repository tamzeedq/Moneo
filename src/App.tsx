import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { RouteError } from '@/components/shell/RouteError';
import { OverviewPage } from '@/pages/overview/OverviewPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { applyTheme, useUI } from '@/stores/ui';

/**
 * Pages other than the Overview load on demand. The router fetches a page's code before navigating,
 * so there's no loading flash.
 */
const page =
  <M,>(load: () => Promise<M>, pick: (m: M) => React.ComponentType) =>
  async () => ({ Component: pick(await load()) });

const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      errorElement: <RouteError />,
      children: [
        {
          // Errors inside a page render here, keeping the sidebar.
          errorElement: <RouteError />,
          children: [
            { path: '/', element: <OverviewPage /> },
            {
              path: '/paycheques',
              lazy: page(
                () => import('@/pages/paycheques/PaychequesPage'),
                (m) => m.PaychequesPage,
              ),
            },
            {
              path: '/paycheques/new/:step?',
              lazy: page(
                () => import('@/pages/wizard/PaychequeWizard'),
                (m) => m.PaychequeWizard,
              ),
            },
            {
              path: '/budget',
              lazy: page(
                () => import('@/pages/budget/BudgetPage'),
                (m) => m.BudgetPage,
              ),
            },
            {
              path: '/accounts',
              lazy: page(
                () => import('@/pages/accounts/AccountsPage'),
                (m) => m.AccountsPage,
              ),
            },
            {
              path: '/charts',
              lazy: page(
                () => import('@/pages/charts/ChartLibrary'),
                (m) => m.ChartLibrary,
              ),
            },
            {
              path: '/charts/new',
              lazy: page(
                () => import('@/pages/charts/NewChart'),
                (m) => m.NewChart,
              ),
            },
            {
              path: '/charts/:id',
              lazy: page(
                () => import('@/pages/charts/ChartEditor'),
                (m) => m.ChartEditor,
              ),
            },
            {
              path: '/charts/:id/pin',
              lazy: page(
                () => import('@/pages/charts/PinChart'),
                (m) => m.PinChart,
              ),
            },
            {
              path: '/import',
              lazy: page(
                () => import('@/pages/import/ImportExportPage'),
                (m) => m.ImportExportPage,
              ),
            },
            {
              path: '/settings',
              lazy: page(
                () => import('@/pages/settings/SettingsPage'),
                (m) => m.SettingsPage,
              ),
            },
            { path: '*', element: <PlaceholderPage title="Not found" /> },
          ],
        },
      ],
    },
  ],
  { future: { v7_relativeSplatPath: true } },
);

export function App() {
  const theme = useUI((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
