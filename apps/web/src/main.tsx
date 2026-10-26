import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
// Sonner's own CSS, loaded as a file: the CSP blocks the <style> tag it would inject.
import 'sonner/dist/styles.css';
import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { createQueryClient, Providers } from './app/providers';
import { router } from './app/router';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

const queryClient = createQueryClient();

createRoot(container).render(
  <StrictMode>
    <Providers client={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
