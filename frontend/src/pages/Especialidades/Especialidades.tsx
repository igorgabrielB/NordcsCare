import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Settings2, Trash2, ActivitySquare, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../../services/api'
import './Especialidades.css'

interface Especialidade {
  id: number
  nome: string
  descricao: string | null
  cor: string
  icone: string
  ativo: number
  total_estacoes: number
  total_secoes: number
}

interface EspecialidadeForm {
  nome: string
  descricao: string
  cor: string
  icone: string
}

const defaultForm: EspecialidadeForm = { nome: '', descricao: '', cor: '#4299e1', icone: 'activity' }

export default function Especialidades() {
  const navigate = useNavigate()
  const [lista, setLista] = useState<Especialidade[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<EspecialidadeForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState('')

  const carregar = async () => {
    try {
      const { data } = await api.get('/especialidades')
      setLista(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const openNew = () => {
    setEditingId(null)
    setForm(defaultForm)
    setError('')
    setShowModal(true)
  }

  const openEdit = (esp: Especialidade) => {
    setEditingId(esp.id)
    setForm({ nome: esp.nome, descricao: esp.descricao ?? '', cor: esp.cor, icone: esp.icone })
    setError('')
    setShowModal(true)
  }

  const salvar = async () => {
    if (!form.nome.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await api.put(`/especialidades/${editingId}`, form)
      } else {
        await api.post('/especialidades', form)
      }
      setShowModal(false)
      await carregar()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const toggleAtivo = async (esp: Especialidade) => {
    await api.put(`/especialidades/${esp.id}`, { ...esp, ativo: esp.ativo ? 0 : 1 })
    await carregar()
  }

  const excluir = async (id: number) => {
    if (!confirm('Excluir esta especialidade? Esta ação não pode ser desfeita.')) return
    setDeleting(id)
    try {
      await api.delete(`/especialidades/${id}`)
      await carregar()
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Erro ao excluir')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="especialidades-page">
      <div className="especialidades-header">
        <div className="especialidades-title">
          <ActivitySquare size={26} />
          <div>
            <h1>Especialidades</h1>
            <p>Configure especialidades médicas, estações da fila e formulários</p>
          </div>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Nova Especialidade
        </button>
      </div>

      {loading ? (
        <div className="especialidades-loading">Carregando...</div>
      ) : (
        <div className="especialidades-grid">
          {lista.map((esp) => (
            <div key={esp.id} className={`esp-card${esp.ativo ? '' : ' esp-card--inativo'}`}>
              <div className="esp-card-color" style={{ background: esp.cor }} />
              <div className="esp-card-body">
                <div className="esp-card-top">
                  <h3>{esp.nome}</h3>
                  <button
                    className="btn-icon"
                    title={esp.ativo ? 'Desativar' : 'Ativar'}
                    onClick={() => toggleAtivo(esp)}
                  >
                    {esp.ativo ? <ToggleRight size={22} color="#38a169" /> : <ToggleLeft size={22} color="#999" />}
                  </button>
                </div>
                {esp.descricao && <p className="esp-card-desc">{esp.descricao}</p>}
                <div className="esp-card-stats">
                  <span>{esp.total_estacoes} {esp.total_estacoes !== 1 ? 'estações' : 'estação'}</span>
                  <span>{esp.total_secoes} {esp.total_secoes !== 1 ? 'seções' : 'seção'} de formulário</span>
                </div>
                <div className="esp-card-actions">
                  <button className="btn-outline" onClick={() => openEdit(esp)}>
                    Editar
                  </button>
                  <button
                    className="btn-outline btn-outline--purple"
                    onClick={() => navigate(`/admin/especialidades/${esp.id}/configurar`)}
                  >
                    <Settings2 size={14} /> Configurar
                  </button>
                  <button
                    className="btn-icon btn-icon--danger"
                    title="Excluir"
                    onClick={() => excluir(esp.id)}
                    disabled={deleting === esp.id}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {lista.length === 0 && (
            <div className="especialidades-empty">
              Nenhuma especialidade cadastrada. Clique em "Nova Especialidade" para começar.
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Editar Especialidade' : 'Nova Especialidade'}</h2>
            {error && <div className="modal-error">{error}</div>}
            <label>
              Nome *
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Cardiologia"
                autoFocus
              />
            </label>
            <label>
              Descrição
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição opcional"
              />
            </label>
            <label>
              Ícone (nome Lucide)
              <input
                type="text"
                value={form.icone}
                onChange={(e) => setForm({ ...form, icone: e.target.value })}
                placeholder="Ex: heart, eye, stethoscope"
              />
            </label>
            <label>
              Cor
              <div className="color-row">
                <input
                  type="color"
                  value={form.cor}
                  onChange={(e) => setForm({ ...form, cor: e.target.value })}
                />
                <input
                  type="text"
                  value={form.cor}
                  onChange={(e) => setForm({ ...form, cor: e.target.value })}
                  placeholder="#4299e1"
                />
              </div>
            </label>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvar} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
