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

export default function RegistrarResultadoModal({ partido, jugadorActualId, esAdmin, onClose, onGuardado }) {
  const [set1p1, setSet1p1] = useState('')
  const [set1p2, setSet1p2] = useState('')
  const [set2p1, setSet2p1] = useState('')
  const [set2p2, setSet2p2] = useState('')
  const [set3p1, setSet3p1] = useState('')
  const [set3p2, setSet3p2] = useState('')
  const [noFinalizado, setNoFinalizado] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const sets = { set1p1, set1p2, set2p1, set2p2, set3p1, set3p2 }
  const resultado = calcularResultado(sets, noFinalizado)
  const set1Completo = set1p1 !== '' && set1p2 !== ''
  const canSave = noFinalizado || set1Completo

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave) return
    try {
      setSaving(true)
      setError(null)
      const datosSets = {
        set1_p1: set1p1 !== '' ? Number(set1p1) : null,
        set1_p2: set1p2 !== '' ? Number(set1p2) : null,
        set2_p1: set2p1 !== '' ? Number(set2p1) : null,
        set2_p2: set2p2 !== '' ? Number(set2p2) : null,
        set3_p1: set3p1 !== '' ? Number(set3p1) : null,
        set3_p2: set3p2 !== '' ? Number(set3p2) : null,
      }
      await registrarResultadoPartido(partido.id, resultado, datosSets, jugadorActualId, esAdmin)
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

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={!canSave || saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
