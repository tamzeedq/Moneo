import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { OverviewPage } from '@/pages/overview/OverviewPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { applyTheme, useUI } from '@/stores/ui';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/paycheques', element: <PlaceholderPage title="Paycheques" /> },
      { path: '/paycheques/new/:step?', element: <PlaceholderPage title="Add paycheque" crumb="Paycheques" /> },
      { path: '/budget', element: <PlaceholderPage title="Budget" /> },
      { path: '/accounts', element: <PlaceholderPage title="Accounts" /> },
      { path: '/charts', element: <PlaceholderPage title="Chart Studio" /> },
      { path: '/charts/new', element: <PlaceholderPage title="New chart" crumb="Chart Studio" /> },
      { path: '/charts/:id', element: <PlaceholderPage title="Chart editor" crumb="Chart Studio" /> },
      { path: '/charts/:id/pin', element: <PlaceholderPage title="Pin to Overview" crumb="Chart Studio" /> },
      { path: '*', element: <PlaceholderPage title="Not found" /> },
    ],
  },
]);

export function App() {
  const theme = useUI((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);
  return <RouterProvider router={router} />;
}
