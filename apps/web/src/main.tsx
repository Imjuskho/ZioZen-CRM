import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import CustomerPortal from './CustomerPortal.tsx'

const isCustomerPortal = window.location.pathname === '/portal' || window.location.search.includes('portal=1')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCustomerPortal ? <CustomerPortal /> : <App />}
  </StrictMode>,
)
