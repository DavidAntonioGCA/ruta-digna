import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PantallaPublica from './PantallaPublica'
import './index.css'

// Detectar modo pantalla pública via URL:
//   ?pantalla=1&sucursal=1
//   o simplemente ?pantalla=1  (usa sucursal 1 por defecto)
const params      = new URLSearchParams(window.location.search)
const isPantalla  = params.has('pantalla')
const sucursalId  = parseInt(params.get('sucursal') ?? '1', 10) || 1

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPantalla
      ? <PantallaPublica idSucursal={sucursalId} />
      : <App />
    }
  </React.StrictMode>
)
