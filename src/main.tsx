import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './app.css';

const container = document.getElementById('root');
if (!container) throw new Error('Falta o elemento #root no documento.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
