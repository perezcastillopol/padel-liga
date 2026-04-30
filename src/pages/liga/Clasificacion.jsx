import { useEffect, useState } from 'react'
import { useLiga } from '../../context/LigaContext'
import { calcularClasificacion } from '../../services/clasificacion.service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const METODO_LABEL = {
  puntos_totales: 'Pts',
  media_puntos: 'Med.',
  ratio_sets: 'Sets%',
  media_puntos_minimo: 'Med.',
}

function formatValor(valor, metodo) {
  if (valor === null || valor === undefined) return '—'
  if (metodo === 'ratio_sets') return (valor * 100).toFixed(0) + '%'
  if (metodo === 'media_puntos' || metodo === 'media_puntos_minimo') return valor.toFixed(2)
  return Number.isInteger(valor) ? valor : valor.toFixed(1)
}

export default function Clasificacion() {
  const { ligaActiva, jugadorActual } = useLiga()
  const [tabla, setTabla] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ligaActiva?.id) return

    async function cargar() {
      try {
        setLoading(true)
        const result = await calcularClasificacion(ligaActiva.id, ligaActiva)
        setTabla(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [ligaActiva?.id])

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Calculando clasificación...</p>
  }

  if (error) {
    return <p className="text-destructive text-sm text-center py-8">Error: {error}</p>
  }

  const metodo = ligaActiva?.metodo_ranking ?? 'puntos_totales'
  const colRanking = METODO_LABEL[metodo]
  const tienePartidos = tabla.some((e) => e.partidos > 0)

  return (
    <div className="space-y-4 pb-4">
      {/* Chips informativos */}
      {(ligaActiva?.ventana_dias || ligaActiva?.max_partidos) && (
        <div className="flex flex-wrap gap-2">
          {ligaActiva.ventana_dias && (
            <Badge variant="secondary">Últimos {ligaActiva.ventana_dias} días</Badge>
          )}
          {ligaActiva.max_partidos && (
            <Badge variant="secondary">Máx. {ligaActiva.max_partidos} partidos</Badge>
          )}
        </div>
      )}

      {/* Nota mét0do ranking con mínimo */}
      {metodo === 'media_puntos_minimo' && (
        <p className="text-xs text-muted-foreground">
          Mínimo {ligaActiva.min_partidos_ranking} partidos para aparecer en el ranking
        </p>
      )}

      {!tienePartidos ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-sm text-muted-foreground">Aún no hay partidos registrados</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Cabecera */}
            <div className="grid grid-cols-[2rem_1fr_2rem_2rem_2rem_2rem_3rem] gap-x-2 items-center px-4 py-2 border-b border-gray-100">
              <span className="text-[10px] font-semibold text-gray-400 uppercase text-center">#</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase">Jugador</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase text-center" title="Partidos jugados">PJ</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase text-center" title="Victorias">V</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase text-center" title="Derrotas">D</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase text-center" title="No finalizados">NF</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase text-right">{colRanking}</span>
            </div>

            {/* Filas */}
            {tabla.map((entry) => {
              const esMiJugador = jugadorActual?.id === entry.jugadorId
              return (
                <div
                  key={entry.jugadorId}
                  className={[
                    'grid grid-cols-[2rem_1fr_2rem_2rem_2rem_2rem_3rem] gap-x-2 items-center px-4 py-3 border-b border-gray-50 last:border-0',
                    esMiJugador ? 'bg-green-50' : '',
                  ].join(' ')}
                >
                  <span className="text-sm font-bold text-gray-400 text-center">
                    {entry.sinRanking ? '—' : entry.posicion}
                  </span>
                  <span className={`text-sm truncate ${esMiJugador ? 'font-bold text-green-800' : 'font-medium text-gray-900'}`}>
                    {entry.nombre}
                    {esMiJugador && <span className="text-[10px] font-normal text-green-600 ml-1">(tú)</span>}
                  </span>
                  <span className="text-sm text-gray-600 text-center">{entry.partidos}</span>
                  <span className="text-sm text-gray-600 text-center">{entry.victorias}</span>
                  <span className="text-sm text-gray-600 text-center">{entry.derrotas}</span>
                  <span className="text-sm text-gray-600 text-center">{entry.noFinalizados}</span>
                  <span className={`text-sm font-semibold text-right ${entry.sinRanking ? 'text-gray-300' : 'text-gray-900'}`}>
                    {entry.sinRanking ? '—' : formatValor(entry.valorRanking, metodo)}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
