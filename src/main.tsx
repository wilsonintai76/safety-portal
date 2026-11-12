import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PortalDataProvider} from './hooks/usePortalData';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PortalDataProvider>
      <App />
    </PortalDataProvider>
  </StrictMode>
);
