import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { OverviewPage } from '@/pages/overview/OverviewPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { PaychequeWizard } from '@/pages/wizard/PaychequeWizard';
import { ChartLibrary } from '@/pages/charts/ChartLibrary';
import { NewChart } from '@/pages/charts/NewChart';
import { ChartEditor } from '@/pages/charts/ChartEditor';
import { PinChart } from '@/pages/charts/PinChart';
import { applyTheme, useUI } from '@/stores/ui';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/paycheques', element: <PlaceholderPage title="Paycheques" /> },
      { path: '/paycheques/new/:step?', element: <PaychequeWizard /> },
      { path: '/budget', element: <PlaceholderPage title="Budget" /> },
      { path: '/accounts', element: <PlaceholderPage title="Accounts" /> },
      { path: '/charts', element: <ChartLibrary /> },
      { path: '/charts/new', element: <NewChart /> },
      { path: '/charts/:id', element: <ChartEditor /> },
      { path: '/charts/:id/pin', element: <PinChart /> },
      { path: '*', element: <PlaceholderPage title="Not found" /> },
    ],
  },
], { future: { v7_relativeSplatPath: true } });

export function App() {
  const theme = useUI((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
