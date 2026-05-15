import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { PublicGardenPage } from './App.jsx'

const isPublicGarden = window.location.pathname.startsWith('/garden') || window.location.hostname.startsWith('garden.')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPublicGarden ? <PublicGardenPage /> : <App />}
  </StrictMode>
)
