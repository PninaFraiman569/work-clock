import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/rubik'
import '@fontsource-variable/heebo'
import './index.css'
import { App } from './App'
import { APP_NAME } from './config'

document.title = APP_NAME

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
