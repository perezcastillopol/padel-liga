import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LigaProvider } from './context/LigaContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import MisLigas from './pages/MisLigas'

function App() {
  return (
    <AuthProvider>
      <LigaProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/mis-ligas"
            element={
              <ProtectedRoute>
                <MisLigas />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/mis-ligas" replace />} />
        </Routes>
      </LigaProvider>
    </AuthProvider>
  )
}

export default App
