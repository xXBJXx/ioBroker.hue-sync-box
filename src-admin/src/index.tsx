import React from 'react';
import { createRoot } from 'react-dom/client';
import '@iobroker/gui-components/index.css';
import './style.css';
import App from './App';

const root = document.getElementById('root');
if (root) {
    createRoot(root).render(<App adapterName="hue-sync-box" />);
}
