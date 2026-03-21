import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './utils/leafletIconFix'   // must run before App mounts
import './index.css'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)