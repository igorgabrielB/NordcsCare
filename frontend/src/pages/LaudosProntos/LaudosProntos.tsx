import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft, Pencil, Trash2, ClipboardList, Plus, Search, FileText, CheckCircle, XCircle, Filter } from 'lucide-react'
import './LaudosProntos.css'

interface LaudoPronto {
  id: number
  titulo: string
  diagnostico: string
  conduta: string | null
  observacoes: string | null
  especialidade: string | null
  ativo: number
  autor_nome: string
  created_at: string
  updated_at: string
}

interface FormData {
  titulo: string
  diagnostico: string
  conduta: string
  observacoes: string
  especialidade: string
  ativo: number
}

const emptyForm: FormData = { titulo: '', diagnostico: '', conduta: '', observacoes: '', especialidade: '', ativo: 1 }

const VARIAVEIS_TEMPLATE = [
  { value: '{{nome}}', label: 'Nome do Paciente' },
  { value: '{{cpf}}', label: 'CPF' },
  { value: '{{data_nascimento}}', label: 'Data de Nascimento' },
  { value: '{{sexo}}', label: 'Sexo' },
  { value: '{{telefone}}', label: 'Telefone' },
  { value: '{{endereco}}', label: 'Endereço' },
  { value: '{{convenio}}', label: 'Convênio' },
  { value: '{{codigo}}', label: 'Código do Paciente' },
  { value: '{{data}}', label: 'Data Atual' },
  { value: '{{medico}}', label: 'Nome do Médico' },
  { value: '{{crm}}', label: 'CRM do Médico' },
]

const FORMATACAO_TEMPLATE = [
  { value: '**texto**', label: 'Negrito — **texto**' },
  { value: '_texto_', label: 'Itálico — _texto_' },
  { value: '||texto||', label: 'Centralizar — ||texto||' },
  { value: '--texto--', label: 'Fonte menor — --texto--' },
  { value: '++texto++', label: 'Fonte maior — ++texto++' },
]

const CONDUTAS = [
  { value: '', label: '— Nenhuma —' },
  { value: 'alta', label: 'Alta' },
  { value: 'onibus', label: 'Ônibus' },
  { value: 'encaminhamento', label: 'Encaminhamento' },
]

function condutaLabel(val: string | null) {
  return CONDUTAS.find(c => c.value === val)?.label ?? val ?? '—'
}

function condutaColor(val: string | null) {
  switch (val) {
    case 'alta': return { bg: 'rgba(56,161,105,0.15)', color: '#68d391' }
    case 'onibus': return { bg: 'rgba(49,130,206,0.15)', color: '#63b3ed' }
    case 'encaminhamento': return { bg: 'rgba(214,158,46,0.15)', color: '#ecc94b' }
    default: return { bg: 'rgba(113,128,150,0.15)', color: '#a0aec0' }
  }
}

export default function LaudosProntos() {
  const [items, setItems] = useState<LaudoPronto[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const diagRef = useRef<HTMLTextAreaElement>(null)
  const obsRef = useRef<HTMLTextAreaElement>(null)

  const filteredItems = useMemo(() => {
    return items.filter(lp => {
      const matchSearch = search === '' ||
        lp.titulo.toLowerCase().includes(search.toLowerCase()) ||
        lp.diagnostico.toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'todos' ||
        (filterStatus === 'ativo' && lp.ativo) ||
        (filterStatus === 'inativo' && !lp.ativo)
      return matchSearch && matchStatus
    })
  }, [items, search, filterStatus])

  const stats = useMemo(() => ({
    total: items.length,
    ativos: items.filter(i => i.ativo).length,
    inativos: items.filter(i => !i.ativo).length,
  }), [items])

  function inserirTexto(campo: 'diagnostico' | 'observacoes', val: string) {
    const ta = campo === 'diagnostico' ? diagRef.current : obsRef.current
    if (!ta) {
      setForm(f => ({ ...f, [campo]: f[campo] + val }))
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    setForm(f => {
      const texto = f[campo]
      const novo = texto.slice(0, start) + val + texto.slice(end)
      return { ...f, [campo]: novo }
    })
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + val.length }, 0)
  }

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/laudos-prontos')
      setItems(res.data)
    } catch {
      console.error('Erro ao carregar laudos prontos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (lp: LaudoPronto) => {
    setEditId(lp.id)
    setForm({
      titulo: lp.titulo,
      diagnostico: lp.diagnostico,
      conduta: lp.conduta || '',
      observacoes: lp.observacoes || '',
      especialidade: lp.especialidade || '',
      ativo: lp.ativo,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.diagnostico.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await api.put(`/laudos-prontos/${editId}`, form)
      } else {
        await api.post('/laudos-prontos', form)
      }
      setShowModal(false)
      fetchItems()
    } catch {
      console.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja excluir este laudo pronto?')) return
    try {
      await api.delete(`/laudos-prontos/${id}`)
      fetchItems()
    } catch {
      console.error('Erro ao excluir')
    }
  }

  return (
    <div className="laudos-prontos-page">
      {/* Hero Header */}
      <div className="lp-hero">
        <div className="lp-hero-top">
          <Link to="/admin" className="btn btn-secondary btn-sm btn-back">
            <ArrowLeft size={16} />
          </Link>
          <button className="btn btn-primary btn-novo" onClick={openCreate}>
            <Plus size={16} />
            <span>Novo Laudo</span>
          </button>
        </div>
        <div className="lp-hero-content">
          <div className="lp-hero-icon">
            <FileText size={28} />
          </div>
          <div>
            <h1>Laudos Prontos</h1>
            <p className="lp-hero-subtitle">Gerencie modelos de laudos para preenchimento rápido</p>
          </div>
        </div>
        <div className="lp-stats-row">
          <div className="lp-stat">
            <div className="lp-stat-icon lp-stat-icon-total">
              <ClipboardList size={16} />
            </div>
            <div className="lp-stat-info">
              <span className="lp-stat-value">{stats.total}</span>
              <span className="lp-stat-label">Total</span>
            </div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-icon lp-stat-icon-ativo">
              <CheckCircle size={16} />
            </div>
            <div className="lp-stat-info">
              <span className="lp-stat-value lp-stat-ativo">{stats.ativos}</span>
              <span className="lp-stat-label">Ativos</span>
            </div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-icon lp-stat-icon-inativo">
              <XCircle size={16} />
            </div>
            <div className="lp-stat-info">
              <span className="lp-stat-value lp-stat-inativo">{stats.inativos}</span>
              <span className="lp-stat-label">Inativos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {items.length > 0 && (
        <div className="lp-toolbar">
          <div className="lp-search-box">
            <Search size={16} className="lp-search-icon" />
            <input
              type="text"
              placeholder="Buscar por título ou diagnóstico..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="lp-filter-group">
            <Filter size={14} />
            <button
              className={`lp-filter-btn ${filterStatus === 'todos' ? 'active' : ''}`}
              onClick={() => setFilterStatus('todos')}
            >Todos</button>
            <button
              className={`lp-filter-btn ${filterStatus === 'ativo' ? 'active' : ''}`}
              onClick={() => setFilterStatus('ativo')}
            >Ativos</button>
            <button
              className={`lp-filter-btn ${filterStatus === 'inativo' ? 'active' : ''}`}
              onClick={() => setFilterStatus('inativo')}
            >Inativos</button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="lp-loading">
          <div className="lp-loading-spinner" />
          <p>Carregando laudos...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="lp-empty">
          <div className="lp-empty-icon">
            <ClipboardList size={48} strokeWidth={1.5} />
          </div>
          <h3>Nenhum laudo cadastrado</h3>
          <p>Crie modelos de laudos para agilizar o atendimento</p>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} style={{ marginRight: 6 }} />Criar primeiro laudo
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="lp-empty lp-empty-search">
          <Search size={36} strokeWidth={1.5} />
          <p>Nenhum laudo encontrado para esta busca</p>
        </div>
      ) : (
        <div className="lp-grid">
          {filteredItems.map((lp, index) => {
            const cc = condutaColor(lp.conduta)
            return (
              <div key={lp.id} className="lp-card" style={{ animationDelay: `${index * 0.04}s` }}>
                <div className="lp-card-top-accent" />
                <div className="lp-card-header">
                  <span className={`lp-status-badge ${lp.ativo ? 'lp-status-ativo' : 'lp-status-inativo'}`}>
                    {lp.ativo ? <><CheckCircle size={12} /> Ativo</> : <><XCircle size={12} /> Inativo</>}
                  </span>
                  <div className="lp-card-actions">
                    <button className="btn-icon-sm" title="Editar" onClick={() => openEdit(lp)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon-sm btn-icon-danger" title="Excluir" onClick={() => handleDelete(lp.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="lp-card-titulo">{lp.titulo}</h3>
                <p className="lp-card-diagnostico">{lp.diagnostico}</p>
                {lp.especialidade && (
                  <div className="lp-card-especialidade">
                    <span className="especialidade-tag">{lp.especialidade}</span>
                  </div>
                )}
                {lp.conduta && (
                  <div className="lp-card-conduta">
                    <span className="conduta-tag" style={{ backgroundColor: cc.bg, color: cc.color }}>
                      {condutaLabel(lp.conduta)}
                    </span>
                  </div>
                )}
                {lp.observacoes && (
                  <div className="lp-card-obs">
                    <strong>Obs:</strong> {lp.observacoes}
                  </div>
                )}
                <div className="lp-card-footer">
                  <span>{lp.autor_nome}</span>
                  <span>{new Date(lp.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de criação / edição */}
      {showModal && (
        <div className="lp-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="lp-modal" onClick={e => e.stopPropagation()}>
            <div className="lp-modal-header">
              <div className="lp-modal-header-icon">
                {editId ? <Pencil size={18} /> : <Plus size={18} />}
              </div>
              <div>
                <h3>{editId ? 'Editar Laudo Pronto' : 'Novo Laudo Pronto'}</h3>
                <p className="lp-modal-header-sub">Preencha os campos para {editId ? 'atualizar' : 'criar'} o laudo</p>
              </div>
              <button className="lp-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="lp-modal-body">
              <div className="form-group">
                <label>Título *</label>
                <input
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: Miopia Leve, Astigmatismo, Normal..."
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Diagnóstico *</label>
                <div className="var-inserter">
                  <select onChange={e => { if (e.target.value) { inserirTexto('diagnostico', e.target.value); e.target.value = '' } }}>
                    <option value="">Inserir variável...</option>
                    {VARIAVEIS_TEMPLATE.map(v => (
                      <option key={v.value} value={v.value}>{v.label} — {v.value}</option>
                    ))}
                  </select>
                  <select onChange={e => { if (e.target.value) { inserirTexto('diagnostico', e.target.value); e.target.value = '' } }}>
                    <option value="">Formatação...</option>
                    {FORMATACAO_TEMPLATE.map(v => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  ref={diagRef}
                  rows={4}
                  value={form.diagnostico}
                  onChange={e => setForm({ ...form, diagnostico: e.target.value })}
                  placeholder="Texto do diagnóstico que será preenchido automaticamente..."
                />
              </div>
              <div className="lp-form-row">
                <div className="form-group">
                  <label>Conduta</label>
                  <select value={form.conduta} onChange={e => setForm({ ...form, conduta: e.target.value })}>
                    {CONDUTAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Especialidade</label>
                  <input
                    value={form.especialidade}
                    onChange={e => setForm({ ...form, especialidade: e.target.value })}
                    placeholder="Ex: Oftalmologia, Retina, Glaucoma..."
                  />
                </div>
                {editId && (
                  <div className="form-group">
                    <label>Status</label>
                    <select value={form.ativo} onChange={e => setForm({ ...form, ativo: Number(e.target.value) })}>
                      <option value={1}>Ativo</option>
                      <option value={0}>Inativo</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Observações</label>
                <div className="var-inserter">
                  <select onChange={e => { if (e.target.value) { inserirTexto('observacoes', e.target.value); e.target.value = '' } }}>
                    <option value="">Inserir variável...</option>
                    {VARIAVEIS_TEMPLATE.map(v => (
                      <option key={v.value} value={v.value}>{v.label} — {v.value}</option>
                    ))}
                  </select>
                  <select onChange={e => { if (e.target.value) { inserirTexto('observacoes', e.target.value); e.target.value = '' } }}>
                    <option value="">Formatação...</option>
                    {FORMATACAO_TEMPLATE.map(v => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  ref={obsRef}
                  rows={2}
                  value={form.observacoes}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações adicionais (opcional)..."
                />
              </div>
            </div>
            <div className="lp-modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !form.titulo.trim() || !form.diagnostico.trim()}
              >
                {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
