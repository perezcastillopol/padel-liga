import { useState } from 'react'
import { registrarResultadoPartido } from '../../../services/torneo.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function calcularResultado(sets, noFinalizado) {
  if (noFinalizado) return 'no_finalizado'
  let ganP1 = 0
  let ganP2 = 0
  const todos = [
    sets.set1p1 !== '' && sets.set1p2 !== '' ? [sets.set1p1, sets.set1p2] : null,
    sets.set2p1 !== '' && sets.set2p2 !== '' ? [sets.set2p1, sets.set2p2] : null,
    sets.set3p1 !== '' && sets.set3p2 !== '' ? [sets.set3p1, sets.set3p2] : null,
  ].filter(Boolean)
  for (const [p1, p2] of todos) {
    if (Number(p1) > Number(p2)) ganP1++
    else if (Number(p2) > Number(p1)) ganP2++
  }
  if (ganP1 > ganP2) return 'pareja1'
  if (ganP2 > ganP1) return 'pareja2'
  return 'no_finalizado'
}

function nombresPareja(j1, j2) {
  return [j1?.nombre, j2?.nombre].filter(Boolean).join(' / ') || '—'
}

// Dado quién falta, reparte al resto de los 4 jugadores del partido en
// compañero (misma pareja que el ausente) y los 2 rivales (pareja contraria).
function datosAusente(partido, ausenteId) {
  const enPareja1 = partido.p1j1?.id === ausenteId || partido.p1j2?.id === ausenteId
  const [ausente, companero] = enPareja1
    ? partido.p1j1?.id === ausenteId ? [partido.p1j1, partido.p1j2] : [partido.p1j2, partido.p1j1]
    : partido.p2j1?.id === ausenteId ? [partido.p2j1, partido.p2j2] : [partido.p2j2, partido.p2j1]
  const [rival1, rival2] = enPareja1 ? [partido.p2j1, partido.p2j2] : [partido.p1j1, partido.p1j2]
  return { ausente, companero, rival1, rival2 }
}

function SetInput({ id, label, vP1, vP2, onP1, onP2, required }) {
  const idP1 = `${id}-p1`
  const idP2 = `${id}-p2`
  return (
    <div>
      <label htmlFor={idP1} className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
        {label}{required && ' *'}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={idP1}
          name={idP1}
          type="number"
          min="0"
          max="99"
          value={vP1}
          onChange={(e) => onP1(e.target.value)}
          className="h-9 text-center"
          placeholder="P1"
        />
        <span className="text-gray-400 font-bold">-</span>
        <Input
          id={idP2}
          name={idP2}
          type="number"
          min="0"
          max="99"
          value={vP2}
          onChange={(e) => onP2(e.target.value)}
          className="h-9 text-center"
          placeholder="P2"
        />
      </div>
    </div>
  )
}

export default function RegistrarResultadoModal({ partido, tipoRonda, jugadorActualId, esAdmin, onClose, onGuardado }) {
  const [set1p1, setSet1p1] = useState('')
  const [set1p2, setSet1p2] = useState('')
  const [set2p1, setSet2p1] = useState('')
  const [set2p2, setSet2p2] = useState('')
  const [set3p1, setSet3p1] = useState('')
  const [set3p2, setSet3p2] = useState('')
  const [noFinalizado, setNoFinalizado] = useState(false)
  const [marcarAusente, setMarcarAusente] = useState(false)
  const [ausenteId, setAusenteId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const sets = { set1p1, set1p2, set2p1, set2p2, set3p1, set3p2 }
  const resultado = calcularResultado(sets, noFinalizado)
  const set1Completo = set1p1 !== '' && set1p2 !== ''
  const canSave = marcarAusente ? !!ausenteId : (noFinalizado || set1Completo)

  const mostrarAusente = tipoRonda === 'suiza'
  const jugadoresPartido = [partido.p1j1, partido.p1j2, partido.p2j1, partido.p2j2].filter(Boolean)
  const resumenAusente = ausenteId ? datosAusente(partido, ausenteId) : null

  function handleToggleAusente(activo) {
    setMarcarAusente(activo)
    setAusenteId('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave) return
    try {
      setSaving(true)
      setError(null)
      if (marcarAusente) {
        await registrarResultadoPartido(partido.id, null, {}, jugadorActualId, esAdmin, ausenteId)
      } else {
        const datosSets = {
          set1_p1: set1p1 !== '' ? Number(set1p1) : null,
          set1_p2: set1p2 !== '' ? Number(set1p2) : null,
          set2_p1: set2p1 !== '' ? Number(set2p1) : null,
          set2_p2: set2p2 !== '' ? Number(set2p2) : null,
          set3_p1: set3p1 !== '' ? Number(set3p1) : null,
          set3_p2: set3p2 !== '' ? Number(set3p2) : null,
        }
        await registrarResultadoPartido(partido.id, resultado, datosSets, jugadorActualId, esAdmin)
      }
      onGuardado()
    } catch (err) {
      setError(err.message || 'Error al registrar el resultado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Registrar resultado</h2>
          <p className="text-sm text-gray-500 mt-1">
            {nombresPareja(partido.p1j1, partido.p1j2)}
            <span className="text-gray-400"> vs </span>
            {nombresPareja(partido.p2j1, partido.p2j2)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {mostrarAusente && (
            <div className="space-y-3 border border-gray-100 rounded-lg p-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marcarAusente}
                  onChange={(e) => handleToggleAusente(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-sm font-medium text-gray-700">¿Algún jugador no puede jugar?</span>
              </label>

              {marcarAusente && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Selecciona quién no puede jugar:</p>
                  <div className="flex flex-wrap gap-2">
                    {jugadoresPartido.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => setAusenteId(j.id)}
                        className={[
                          'text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors',
                          ausenteId === j.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400',
                        ].join(' ')}
                      >
                        {j.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {resumenAusente && (
                <div className="space-y-1 text-sm bg-gray-50 border border-gray-100 rounded-lg p-3">
                  <p><span className="font-semibold text-red-700">Jugador ausente:</span> {resumenAusente.ausente?.nombre ?? '—'} → derrota</p>
                  <p><span className="font-semibold text-gray-500">Compañero:</span> {resumenAusente.companero?.nombre ?? '—'} → no computa</p>
                  <p><span className="font-semibold text-green-700">Rivales:</span> {resumenAusente.rival1?.nombre ?? '—'} y {resumenAusente.rival2?.nombre ?? '—'} → victoria</p>
                </div>
              )}
            </div>
          )}

          {!marcarAusente && (
            <>
              <div className="space-y-3">
                <SetInput id="set1" label="Set 1" required vP1={set1p1} onP1={setSet1p1} vP2={set1p2} onP2={setSet1p2} />
                <SetInput id="set2" label="Set 2" vP1={set2p1} onP1={setSet2p1} vP2={set2p2} onP2={setSet2p2} />
                <SetInput id="set3" label="Set 3" vP1={set3p1} onP1={setSet3p1} vP2={set3p2} onP2={setSet3p2} />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noFinalizado}
                  onChange={(e) => setNoFinalizado(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-sm font-medium text-gray-700">Partido no finalizado</span>
              </label>

              {(set1Completo || noFinalizado) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Resultado calculado:</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      resultado === 'pareja1' ? 'bg-green-100 text-green-800' :
                        resultado === 'pareja2' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {resultado === 'pareja1' ? `${nombresPareja(partido.p1j1, partido.p1j2)} ganan` :
                      resultado === 'pareja2' ? `${nombresPareja(partido.p2j1, partido.p2j2)} ganan` :
                        'No finalizado'}
                  </span>
                </div>
              )}
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={!canSave || saving}>
              {saving ? 'Guardando...' : marcarAusente ? 'Confirmar' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
