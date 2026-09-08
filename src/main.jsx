import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

/**
 * HashRouter keeps every route reachable from a plain static build — opening
 * dist/index.html or dropping it on any static host just works, with no server
 * rewrite rules to configure on demo day.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
