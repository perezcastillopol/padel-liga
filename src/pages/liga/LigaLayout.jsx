import { useParams } from 'react-router-dom'

export default function LigaLayout() {
  const { id } = useParams()
  return (
    <div style={{ padding: '24px' }}>
      <h1>Liga {id}</h1>
      <p>Próximamente: Clasificación, Partidos, Mi Perfil, Configuración</p>
    </div>
  )
}
