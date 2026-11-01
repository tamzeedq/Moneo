import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import './styles/index.css';
import { App } from './App';
import { ensureSeedVersion } from './data/repository';
import { workspace } from './data/workspace';
import { setClock } from './domain/dates';
import { installGlobalErrorHandlers } from './lib/report';

installGlobalErrorHandlers();
setClock(workspace.clock);
void ensureSeedVersion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
