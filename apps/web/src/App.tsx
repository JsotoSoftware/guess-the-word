import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { LandingPage } from './pages/LandingPage'
import { RoomPage } from './pages/RoomPage'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}
