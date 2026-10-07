import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider } from './components/theme-provider'

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider defaultTheme="light" storageKey="pollmph-theme">
        <App />
      </ThemeProvider>
    </StrictMode>,
  )
}

