import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { RoomSessionProvider } from './contexts/room-session'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RoomSessionProvider>
        <App />
      </RoomSessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
