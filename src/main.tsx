import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/rubik'
import '@fontsource-variable/heebo'
import './index.css'
import { App } from './App'
import './lib/install'
import { APP_NAME } from './config'

document.title = APP_NAME

// שמירת קבצי האתר במחשב, כדי שייפתח גם בלי אינטרנט (רק בגרסה הבנויה, לא בפיתוח)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
