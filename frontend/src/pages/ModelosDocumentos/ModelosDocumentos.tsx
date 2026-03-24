import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft, Pencil, Trash2, FileText, Pill, Plus, Search, FolderOpen } from 'lucide-react'
import './ModelosDocumentos.css'

interface Modelo {
  id: number
  tipo: 'atestado' | 'receita_medica'
  nome: string
  conteudo: string
  autor_nome: string
  created_at: string
  updated_at: string
}

interface FormData {
  tipo: 'atestado' | 'receita_medica'
  nome: string
  conteudo: string
}

const emptyForm: FormData = { tipo: 'atestado', nome: '', conteudo: '' }

const VARIAVEIS_TEMPLATE = [
  { value: '{{nome}}', label: 'Nome do Paciente' },
  { value: '{{cpf}}', label: 'CPF' },
  { value: '{{data_nascimento}}', label: 'Data de Nascimento' },
  { value: '{{sexo}}', label: 'Sexo' },
  { value: '{{telefone}}', label: 'Telefone' },
  { value: '{{email}}', label: 'Email' },
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

const tipoLabel: Record<string, string> = {
  atestado: 'Atestado',
  receita_medica: 'Receita Médica',
}

export default function ModelosDocumentos() {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filteredModelos = useMemo(() => {
    if (!search) return modelos
    return modelos.filter(m =>
      m.nome.toLowerCase().includes(search.toLowerCase()) ||
      m.conteudo.toLowerCase().includes(search.toLowerCase())
    )
  }, [modelos, search])

  const stats = useMemo(() => ({
    total: modelos.length,
    atestados: modelos.filter(m => m.tipo === 'atestado').length,
    receitas: modelos.filter(m => m.tipo === 'receita_medica').length,
  }), [modelos])

  function inserirVariavel(varValue: string) {
    const ta = textareaRef.current
    if (!ta) { setForm({ ...form, conteudo: form.conteudo + varValue }); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const texto = form.conteudo
    const novo = texto.slice(0, start) + varValue + texto.slice(end)
    setForm({ ...form, conteudo: novo })
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + varValue.length }, 0)
  }

  const fetchModelos = useCallback(async () => {
    setLoading(true)
    try {
      const params = filtroTipo ? `?tipo=${filtroTipo}` : ''
      const res = await api.get(`/modelos-documentos${params}`)
      setModelos(res.data)
    } catch {
      console.error('Erro ao carregar modelos')
    } finally {
      setLoading(false)
    }
  }, [filtroTipo])

  useEffect(() => { fetchModelos() }, [fetchModelos])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  const openEdit = (m: Modelo) => {
    setEditId(m.id)
    setForm({ tipo: m.tipo, nome: m.nome, conteudo: m.conteudo })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nome.trim()) { alert('Nome é obrigatório'); return }
    if (!form.conteudo.trim()) { alert('Conteúdo é obrigatório'); return }

    setSaving(true)
    try {
      if (editId) {
        await api.put(`/modelos-documentos/${editId}`, { nome: form.nome, conteudo: form.conteudo })
      } else {
        await api.post('/modelos-documentos', form)
      }
      setShowModal(false)
      fetchModelos()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao salvar'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (m: Modelo) => {
    if (!window.confirm(`Excluir o modelo "${m.nome}"?`)) return
    try {
      await api.delete(`/modelos-documentos/${m.id}`)
      fetchModelos()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao excluir'
      alert(msg)
    }
  }

  return (
    <div className="modelos-page">
      {/* Hero Header */}
      <div className="md-hero">
        <div className="md-hero-top">
          <Link to="/admin" className="btn btn-secondary btn-sm md-btn-back">
            <ArrowLeft size={16} />
          </Link>
          <button className="btn btn-primary md-btn-novo" onClick={openCreate}>
            <Plus size={16} />
            <span>Novo Modelo</span>
          </button>
        </div>
        <div className="md-hero-content">
          <div className="md-hero-icon">
            <FileText size={28} />
          </div>
          <div>
            <h1>Modelos de Documentos</h1>
            <p className="md-hero-subtitle">Gerencie templates de atestados e receitas médicas</p>
          </div>
        </div>
        <div className="md-stats-row">
          <div className="md-stat">
            <span className="md-stat-value">{stats.total}</span>
            <span className="md-stat-label">Total</span>
          </div>
          <div className="md-stat">
            <span className="md-stat-value md-stat-atestado">{stats.atestados}</span>
            <span className="md-stat-label">Atestados</span>
          </div>
          <div className="md-stat">
            <span className="md-stat-value md-stat-receita">{stats.receitas}</span>
            <span className="md-stat-label">Receitas</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {modelos.length > 0 && (
        <div className="md-toolbar">
          <div className="md-search-box">
            <Search size={16} className="md-search-icon" />
            <input
              type="text"
              placeholder="Buscar por nome ou conteúdo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="md-filter-group">
            <button
              className={`md-filter-btn ${filtroTipo === '' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('')}
            >Todos</button>
            <button
              className={`md-filter-btn ${filtroTipo === 'atestado' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('atestado')}
            >
              <FileText size={13} /> Atestados
            </button>
            <button
              className={`md-filter-btn ${filtroTipo === 'receita_medica' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('receita_medica')}
            >
              <Pill size={13} /> Receitas
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="md-loading">
          <div className="md-loading-spinner" />
          <p>Carregando modelos...</p>
        </div>
      ) : modelos.length === 0 ? (
        <div className="md-empty">
          <div className="md-empty-icon">
            <FolderOpen size={48} strokeWidth={1.5} />
          </div>
          <h3>Nenhum modelo cadastrado</h3>
          <p>Crie templates para agilizar a emissão de documentos</p>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} style={{ marginRight: 6 }} />Criar primeiro modelo
          </button>
        </div>
      ) : filteredModelos.length === 0 ? (
        <div className="md-empty md-empty-search">
          <Search size={36} strokeWidth={1.5} />
          <p>Nenhum modelo encontrado para esta busca</p>
        </div>
      ) : (
        <div className="modelos-grid">
          {filteredModelos.map((m, index) => (
            <div key={m.id} className="modelo-card" style={{ animationDelay: `${index * 0.04}s` }}>
              <div className="modelo-card-accent" />
              <div className="modelo-card-header">
                <span className={`tipo-badge tipo-${m.tipo}`}>
                  {m.tipo === 'atestado' ? <FileText size={12} /> : <Pill size={12} />}
                  {tipoLabel[m.tipo]}
                </span>
                <div className="modelo-card-actions">
                  <button className="btn-icon-sm" title="Editar" onClick={() => openEdit(m)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn-icon-sm btn-icon-danger" title="Excluir" onClick={() => handleDelete(m)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="modelo-card-nome">{m.nome}</h3>
              <p className="modelo-card-preview">{m.conteudo.length > 120 ? m.conteudo.slice(0, 120) + '...' : m.conteudo}</p>
              <div className="modelo-card-footer">
                <span>{m.autor_nome}</span>
                <span>{new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="md-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="md-modal" onClick={e => e.stopPropagation()}>
            <div className="md-modal-header">
              <div className="md-modal-header-icon">
                {editId ? <Pencil size={18} /> : <Plus size={18} />}
              </div>
              <div>
                <h3>{editId ? 'Editar Modelo' : 'Novo Modelo'}</h3>
                <p className="md-modal-header-sub">Preencha os campos do template</p>
              </div>
              <button className="md-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="md-modal-body">
              {!editId && (
                <div className="form-group">
                  <label>Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as 'atestado' | 'receita_medica' })}>
                    <option value="atestado">Atestado</option>
                    <option value="receita_medica">Receita Médica</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Nome do Modelo *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Atestado padrão, Receita antibiótico..."
                />
              </div>
              <div className="form-group">
                <label>Conteúdo do Modelo *</label>
                <div className="var-inserter">
                  <select onChange={e => { if (e.target.value) { inserirVariavel(e.target.value); e.target.value = '' } }}>
                    <option value="">Inserir variável...</option>
                    {VARIAVEIS_TEMPLATE.map(v => (
                      <option key={v.value} value={v.value}>{v.label} — {v.value}</option>
                    ))}
                  </select>
                  <select onChange={e => { if (e.target.value) { inserirVariavel(e.target.value); e.target.value = '' } }}>
                    <option value="">Formatação...</option>
                    {FORMATACAO_TEMPLATE.map(v => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  ref={textareaRef}
                  rows={10}
                  value={form.conteudo}
                  onChange={e => setForm({ ...form, conteudo: e.target.value })}
                  placeholder={form.tipo === 'atestado'
                    ? 'Atesto para os devidos fins que o(a) paciente esteve sob cuidados médicos...'
                    : 'Medicamento, posologia, duração do tratamento...'}
                />
              </div>
            </div>
            <div className="md-modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Modelo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
