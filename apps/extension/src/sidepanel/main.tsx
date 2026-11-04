import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Khong tim thay #root trong sidepanel.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
