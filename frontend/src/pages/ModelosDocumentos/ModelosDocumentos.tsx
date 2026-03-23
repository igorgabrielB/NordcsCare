import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { ArrowLeft, Pencil, Trash2, FileText, Pill } from 'lucide-react'
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      <div className="page-header">
        <div className="page-header-left">
          <Link to="/admin" className="btn btn-secondary btn-sm btn-back">
            <ArrowLeft size={16} /> Voltar
          </Link>
          <h1>Modelos de Documentos</h1>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Novo Modelo</button>
      </div>

      <div className="modelos-filter-bar">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="atestado">Atestado</option>
          <option value="receita_medica">Receita Médica</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : modelos.length === 0 ? (
        <div className="empty-state-box">
          <FileText size={40} />
          <p>Nenhum modelo cadastrado</p>
          <button className="btn btn-primary" onClick={openCreate}>Criar primeiro modelo</button>
        </div>
      ) : (
        <div className="modelos-grid">
          {modelos.map(m => (
            <div key={m.id} className="modelo-card">
              <div className="modelo-card-header">
                <span className={`tipo-badge tipo-${m.tipo}`}>
                  {m.tipo === 'atestado' ? <FileText size={12} /> : <Pill size={12} />}
                  {tipoLabel[m.tipo]}
                </span>
                <div className="modelo-card-actions">
                  <button className="btn btn-icon-sm" title="Editar" onClick={() => openEdit(m)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn btn-icon-sm btn-icon-danger" title="Excluir" onClick={() => handleDelete(m)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="modelo-card-nome">{m.nome}</h3>
              <p className="modelo-card-preview">{m.conteudo.length > 120 ? m.conteudo.slice(0, 120) + '...' : m.conteudo}</p>
              <div className="modelo-card-footer">
                <span>por {m.autor_nome}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'Editar Modelo' : 'Novo Modelo'}</h2>
            <div className="modal-form">
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
            <div className="modal-footer">
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
