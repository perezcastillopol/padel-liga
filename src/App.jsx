import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LigaProvider, useLiga } from './context/LigaContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import MisLigas from './pages/MisLigas'
import LigaLayout from './pages/liga/LigaLayout'
import Clasificacion from './pages/liga/Clasificacion'
import Partidos from './pages/liga/Partidos'
import MiPerfil from './pages/liga/MiPerfil'
import Configuracion from './pages/liga/Configuracion'
import EvolucionRanking from './pages/liga/EvolucionRanking'
import TorneoHome from './pages/liga/torneo/TorneoHome'
import TorneoConfig from './pages/liga/torneo/TorneoConfig'

function LigaIndexRedirect() {
  const { ligaActiva } = useLiga()
  return <Navigate to={ligaActiva?.tipo === 'torneo' ? 'torneo' : 'clasificacion'} replace />
}

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
          <Route
            path="/liga/:id"
            element={
              <ProtectedRoute>
                <LigaLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<LigaIndexRedirect />} />
            <Route path="clasificacion" element={<Clasificacion />} />
            <Route path="partidos" element={<Partidos />} />
            <Route path="perfil" element={<MiPerfil />} />
            <Route path="config" element={<Configuracion />} />
            <Route path="evolucion" element={<EvolucionRanking />} />
            <Route path="torneo" element={<TorneoHome />} />
            <Route path="torneo/config" element={<TorneoConfig />} />
          </Route>
          <Route path="/" element={<Navigate to="/mis-ligas" replace />} />
        </Routes>
      </LigaProvider>
    </AuthProvider>
  )
}

export default App
