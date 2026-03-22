import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft, School, Users, Trash2, AlertTriangle, CheckCircle2, Search } from 'lucide-react'
import './ExclusaoEscola.css'

interface EscolaItem {
  escola: string
  total: number
}

export default function ExclusaoEscola() {
  const [schools, setSchools] = useState<EscolaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [confirmSchool, setConfirmSchool] = useState<string | null>(null)
  const [confirmInput, setConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/pacientes/escolas/contagem')
      setSchools(res.data)
    } catch {
      setSchools([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSchools() }, [fetchSchools])

  const filteredSchools = search
    ? schools.filter(s => s.escola.toLowerCase().includes(search.toLowerCase()))
    : schools

  const totalAlunos = schools.reduce((sum, s) => sum + Number(s.total), 0)

  const handleDelete = async () => {
    if (!confirmSchool || confirmInput !== 'EXCLUIR') return
    setDeleting(true)
    setResult(null)
    try {
      const res = await api.delete('/pacientes/escola', { data: { escola: confirmSchool } })
      setResult({ type: 'success', message: res.data.message })
      setConfirmSchool(null)
      setConfirmInput('')
      fetchSchools()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setResult({ type: 'error', message: axiosErr.response?.data?.error || 'Erro ao excluir' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="exclusao-escola-page">
      <div className="page-header">
        <div>
          <h1>Exclusão por Escola</h1>
          <p>Remova todos os pacientes/alunos de uma escola de uma vez</p>
        </div>
        <Link to="/admin" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>
      </div>

      {result && (
        <div className={`exclusao-result ${result.type}`}>
          {result.type === 'success'
            ? <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            : <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />}
          {result.message}
        </div>
      )}

      {/* Confirm modal */}
      {confirmSchool && (
        <div className="exclusao-overlay" onClick={() => { setConfirmSchool(null); setConfirmInput('') }}>
          <div className="exclusao-modal" onClick={(e) => e.stopPropagation()}>
            <div className="exclusao-modal-icon">
              <AlertTriangle size={36} />
            </div>
            <h3>Confirmar exclusão</h3>
            <p>
              Você está prestes a <strong>excluir permanentemente</strong> todos os pacientes da escola:
            </p>
            <div className="exclusao-modal-school">{confirmSchool}</div>
            <p className="exclusao-modal-warning">
              Essa ação <strong>não pode ser desfeita</strong>. Todos os dados desses pacientes serão removidos.
            </p>
            <label className="exclusao-modal-label">
              Digite <strong>EXCLUIR</strong> para confirmar:
            </label>
            <input
              className="exclusao-modal-input"
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="EXCLUIR"
              autoFocus
            />
            <div className="exclusao-modal-actions">
              <button className="btn-cancel" onClick={() => { setConfirmSchool(null); setConfirmInput('') }}>
                Cancelar
              </button>
              <button
                className="btn-delete"
                disabled={confirmInput !== 'EXCLUIR' || deleting}
                onClick={handleDelete}
              >
                <Trash2 size={16} />
                {deleting ? 'Excluindo...' : 'Excluir Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="exclusao-summary">
        <span><School size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />{schools.length} escolas</span>
        <span><Users size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />{totalAlunos} alunos total</span>
      </div>

      {schools.length > 5 && (
        <div className="exclusao-search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar escola..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div style={{ color: '#bfab93', textAlign: 'center', padding: '2rem' }}>Carregando escolas...</div>
      ) : filteredSchools.length === 0 ? (
        <div style={{ color: '#bfab93', textAlign: 'center', padding: '2rem' }}>
          {search ? 'Nenhuma escola encontrada' : 'Nenhuma escola cadastrada'}
        </div>
      ) : (
        <div className="exclusao-list">
          {filteredSchools.map(s => (
            <div key={s.escola} className="exclusao-row">
              <div className="exclusao-row-info">
                <School size={18} className="exclusao-row-icon" />
                <span className="exclusao-row-name">{s.escola}</span>
                <span className="exclusao-row-count">{s.total} alunos</span>
              </div>
              <button
                className="btn-delete-sm"
                onClick={() => { setConfirmSchool(s.escola); setConfirmInput(''); setResult(null) }}
              >
                <Trash2 size={15} /> Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
