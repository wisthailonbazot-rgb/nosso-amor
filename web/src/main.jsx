import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { registerServiceWorker } from './push'
import { installSounds } from './sound'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)

// Registrado sempre, nao so quando o push e ligado: e ele que faz o app abrir
// offline e que precisa estar de pe ANTES de o usuario tocar em "ligar notificacoes"
// (no iOS a permissao tem que ser pedida dentro do toque, sem espera no meio).
registerServiceWorker()
installSounds()
