import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Edit2, Check, X } from 'lucide-react'
import api from '../../services/api'
import './EspecialidadeConfigurar.css'

// ---- Types ----
interface Estacao {
  id: number
  nome: string
  label: string
  cor: string
  icone: string
  prefixo_senha: string | null
  tipo: string
  ordem: number
  ativo: number
}

interface Campo {
  id: number
  nome: string
  label: string
  tipo: string
  opcoes: string[] | null
  obrigatorio: number
  placeholder: string | null
  unidade: string | null
  ordem: number
  ativo: number
}

interface Secao {
  id: number
  nome: string
  label: string
  icone: string
  ordem: number
  ativo: number
  campos: Campo[]
}

const TIPOS_CAMPO = ['texto', 'numero', 'textarea', 'select', 'checkbox', 'data', 'hora', 'fracao']

const emptyEstacao = { nome: '', label: '', cor: '#4299e1', icone: 'clipboard', prefixo_senha: '', tipo: 'atendimento', ativo: 1 }
const emptySecao   = { nome: '', label: '', icone: 'file-text' }
const emptyCampo   = { nome: '', label: '', tipo: 'texto', opcoes: '', obrigatorio: 0, placeholder: '', unidade: '' }

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '')
}

// =========================================================
export default function EspecialidadeConfigurar() {
  const { id } = useParams<{ id: string }>()
  const espId = parseInt(id ?? '0')
  const navigate = useNavigate()

  const [tab, setTab] = useState<'estacoes' | 'formulario'>('estacoes')
  const [espNome, setEspNome] = useState('')
  const [loading, setLoading] = useState(true)

  // ------ Estações ------
  const [estacoes, setEstacoes] = useState<Estacao[]>([])
  const [editingEstacao, setEditingEstacao] = useState<Partial<Estacao> & { id?: number } | null>(null)
  const [savingEstacao, setSavingEstacao] = useState(false)

  // ------ Seções/Campos ------
  const [secoes, setSecoes] = useState<Secao[]>([])
  const [secaoSelecionada, setSecaoSelecionada] = useState<Secao | null>(null)
  const [editingSecao, setEditingSecao] = useState<any>(null)
  const [editingCampo, setEditingCampo] = useState<any>(null)
  const [savingSecao, setSavingSecao]   = useState(false)
  const [savingCampo, setSavingCampo]   = useState(false)

  const carregarEstacoes = useCallback(async () => {
    const { data } = await api.get(`/especialidades/${espId}/estacoes`)
    setEstacoes(data)
  }, [espId])

  const carregarSecoes = useCallback(async () => {
    const { data } = await api.get(`/formularios/${espId}/admin`)
    setSecoes(data)
    if (data.length > 0 && !secaoSelecionada) setSecaoSelecionada(data[0])
  }, [espId])

  useEffect(() => {
    const init = async () => {
      try {
        const [espRes] = await Promise.all([
          api.get(`/especialidades/${espId}`),
          carregarEstacoes(),
          carregarSecoes(),
        ])
        setEspNome(espRes.data.nome)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [espId])

  // =========================================================
  // ESTAÇÕES
  // =========================================================
  const moverEstacao = async (idx: number, dir: -1 | 1) => {
    const novas = [...estacoes]
    const target = idx + dir
    if (target < 0 || target >= novas.length) return
    ;[novas[idx], novas[target]] = [novas[target], novas[idx]]
    const payload = novas.map((e, i) => ({ id: e.id, ordem: i + 1 }))
    await api.put(`/especialidades/${espId}/estacoes/reordenar`, payload)
    setEstacoes(novas.map((e, i) => ({ ...e, ordem: i + 1 })))
  }

  const salvarEstacao = async () => {
    if (!editingEstacao) return
    setSavingEstacao(true)
    try {
      if (editingEstacao.id) {
        await api.put(`/especialidades/estacoes/${editingEstacao.id}`, editingEstacao)
      } else {
        await api.post(`/especialidades/${espId}/estacoes`, editingEstacao)
      }
      setEditingEstacao(null)
      await carregarEstacoes()
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Erro ao salvar estação')
    } finally {
      setSavingEstacao(false)
    }
  }

  const excluirEstacao = async (id: number) => {
    if (!confirm('Excluir esta estação?')) return
    await api.delete(`/especialidades/estacoes/${id}`)
    await carregarEstacoes()
  }

  // =========================================================
  // SEÇÕES
  // =========================================================
  const moverSecao = async (idx: number, dir: -1 | 1) => {
    const novas = [...secoes]
    const target = idx + dir
    if (target < 0 || target >= novas.length) return
    ;[novas[idx], novas[target]] = [novas[target], novas[idx]]
    const payload = novas.map((s, i) => ({ id: s.id, ordem: i + 1 }))
    await api.put('/formularios/secoes/reordenar', payload)
    setSecoes(novas.map((s, i) => ({ ...s, ordem: i + 1 })))
  }

  const salvarSecao = async () => {
    if (!editingSecao) return
    setSavingSecao(true)
    try {
      const payload = { ...editingSecao, especialidade_id: espId }
      if (editingSecao.id) {
        await api.put(`/formularios/secoes/${editingSecao.id}`, payload)
      } else {
        await api.post('/formularios/secoes', payload)
      }
      setEditingSecao(null)
      await carregarSecoes()
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Erro ao salvar seção')
    } finally {
      setSavingSecao(false)
    }
  }

  const excluirSecao = async (id: number) => {
    if (!confirm('Excluir esta seção e todos os seus campos?')) return
    await api.delete(`/formularios/secoes/${id}`)
    if (secaoSelecionada?.id === id) setSecaoSelecionada(null)
    await carregarSecoes()
  }

  // =========================================================
  // CAMPOS
  // =========================================================
  const moverCampo = async (secId: number, idx: number, dir: -1 | 1) => {
    const sec = secoes.find(s => s.id === secId)
    if (!sec) return
    const campos = [...sec.campos]
    const target = idx + dir
    if (target < 0 || target >= campos.length) return
    ;[campos[idx], campos[target]] = [campos[target], campos[idx]]
    const payload = campos.map((c, i) => ({ id: c.id, ordem: i + 1 }))
    await api.put('/formularios/campos/reordenar', payload)
    const novas = secoes.map(s => s.id === secId ? { ...s, campos: campos.map((c, i) => ({ ...c, ordem: i + 1 })) } : s)
    setSecoes(novas)
    setSecaoSelecionada(novas.find(s => s.id === secId) ?? null)
  }

  const salvarCampo = async () => {
    if (!editingCampo || !secaoSelecionada) return
    setSavingCampo(true)
    try {
      const payload = {
        ...editingCampo,
        secao_id: secaoSelecionada.id,
        opcoes: editingCampo.opcoes ? editingCampo.opcoes.split(',').map((o: string) => o.trim()).filter(Boolean) : undefined,
      }
      if (editingCampo.id) {
        await api.put(`/formularios/campos/${editingCampo.id}`, payload)
      } else {
        await api.post('/formularios/campos', payload)
      }
      setEditingCampo(null)
      await carregarSecoes()
      const updated = (await api.get(`/formularios/${espId}/admin`)).data
      setSecoes(updated)
      setSecaoSelecionada(updated.find((s: Secao) => s.id === secaoSelecionada.id) ?? null)
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Erro ao salvar campo')
    } finally {
      setSavingCampo(false)
    }
  }

  const excluirCampo = async (id: number) => {
    if (!confirm('Excluir este campo?')) return
    await api.delete(`/formularios/campos/${id}`)
    const updated = (await api.get(`/formularios/${espId}/admin`)).data
    setSecoes(updated)
    setSecaoSelecionada(updated.find((s: Secao) => s.id === secaoSelecionada?.id) ?? null)
  }

  if (loading) return <div className="esp-cfg-loading">Carregando...</div>

  return (
    <div className="esp-cfg-page">
      <div className="esp-cfg-header">
        <button className="btn-back" onClick={() => navigate('/admin/especialidades')}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <h1>Configurar: {espNome}</h1>
      </div>

      <div className="esp-cfg-tabs">
        <button className={`tab${tab === 'estacoes' ? ' tab--active' : ''}`} onClick={() => setTab('estacoes')}>
          Estações da Fila
        </button>
        <button className={`tab${tab === 'formulario' ? ' tab--active' : ''}`} onClick={() => setTab('formulario')}>
          Formulário
        </button>
      </div>

      {/* ====== TAB: ESTAÇÕES ====== */}
      {tab === 'estacoes' && (
        <div className="esp-cfg-section">
          <div className="esp-cfg-section-header">
            <h2>Estações da Fila</h2>
            <button className="btn-primary" onClick={() => setEditingEstacao({ ...emptyEstacao })}>
              <Plus size={14} /> Adicionar Estação
            </button>
          </div>
          <div className="estacoes-list">
            {estacoes.map((est, idx) => (
              <div key={est.id} className={`estacao-row${est.ativo ? '' : ' estacao-row--inativo'}`}>
                <div className="estacao-color" style={{ background: est.cor }} />
                <div className="estacao-info">
                  <strong>{est.label}</strong>
                  <span className="text-muted">{est.nome}</span>
                  <span className="badge">{est.prefixo_senha ? `senha: ${est.prefixo_senha}###` : 'sem senha'}</span>
                </div>
                <div className="estacao-actions">
                  <button className="btn-icon" onClick={() => moverEstacao(idx, -1)} disabled={idx === 0}><ChevronUp size={14} /></button>
                  <button className="btn-icon" onClick={() => moverEstacao(idx, 1)} disabled={idx === estacoes.length - 1}><ChevronDown size={14} /></button>
                  <button className="btn-icon" onClick={() => setEditingEstacao({ ...est })}><Edit2 size={14} /></button>
                  <button className="btn-icon btn-icon--danger" onClick={() => excluirEstacao(est.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {estacoes.length === 0 && <p className="text-muted">Nenhuma estação cadastrada.</p>}
          </div>
        </div>
      )}

      {/* ====== TAB: FORMULÁRIO ====== */}
      {tab === 'formulario' && (
        <div className="form-builder">
          {/* Seções */}
          <div className="form-builder-secoes">
            <div className="form-builder-secoes-header">
              <h3>Seções</h3>
              <button className="btn-icon" title="Nova seção" onClick={() => setEditingSecao({ ...emptySecao })}>
                <Plus size={16} />
              </button>
            </div>
            {secoes.map((sec, idx) => (
              <div
                key={sec.id}
                className={`secao-item${secaoSelecionada?.id === sec.id ? ' secao-item--selected' : ''}${sec.ativo ? '' : ' secao-item--inativo'}`}
                onClick={() => setSecaoSelecionada(sec)}
              >
                <span className="secao-label">{sec.label}</span>
                <div className="secao-actions">
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); moverSecao(idx, -1) }} disabled={idx === 0}><ChevronUp size={12} /></button>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); moverSecao(idx, 1) }} disabled={idx === secoes.length - 1}><ChevronDown size={12} /></button>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditingSecao({ ...sec }) }}><Edit2 size={12} /></button>
                  <button className="btn-icon btn-icon--danger" onClick={(e) => { e.stopPropagation(); excluirSecao(sec.id) }}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Campos da seção selecionada */}
          <div className="form-builder-campos">
            {secaoSelecionada ? (
              <>
                <div className="form-builder-campos-header">
                  <h3>Campos — {secaoSelecionada.label}</h3>
                  <button className="btn-primary" onClick={() => setEditingCampo({ ...emptyCampo })}>
                    <Plus size={14} /> Adicionar Campo
                  </button>
                </div>
                <div className="campos-list">
                  {secaoSelecionada.campos.map((campo, idx) => (
                    <div key={campo.id} className={`campo-row${campo.ativo ? '' : ' campo-row--inativo'}`}>
                      <GripVertical size={14} className="text-muted" />
                      <div className="campo-info">
                        <strong>{campo.label}</strong>
                        <span className="badge badge--tipo">{campo.tipo}</span>
                        {campo.obrigatorio ? <span className="badge badge--req">obrigatório</span> : null}
                        {campo.unidade && <span className="text-muted">({campo.unidade})</span>}
                      </div>
                      <div className="campo-actions">
                        <button className="btn-icon" onClick={() => moverCampo(secaoSelecionada.id, idx, -1)} disabled={idx === 0}><ChevronUp size={12} /></button>
                        <button className="btn-icon" onClick={() => moverCampo(secaoSelecionada.id, idx, 1)} disabled={idx === secaoSelecionada.campos.length - 1}><ChevronDown size={12} /></button>
                        <button className="btn-icon" onClick={() => setEditingCampo({ ...campo, opcoes: (campo.opcoes ?? []).join(', ') })}><Edit2 size={12} /></button>
                        <button className="btn-icon btn-icon--danger" onClick={() => excluirCampo(campo.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {secaoSelecionada.campos.length === 0 && <p className="text-muted">Nenhum campo. Clique em "Adicionar Campo".</p>}
                </div>
              </>
            ) : (
              <p className="text-muted" style={{ padding: 24 }}>Selecione uma seção para ver os campos.</p>
            )}
          </div>
        </div>
      )}

      {/* ====== MODAL ESTAÇÃO ====== */}
      {editingEstacao && (
        <div className="modal-overlay" onClick={() => setEditingEstacao(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>{editingEstacao.id ? 'Editar Estação' : 'Nova Estação'}</h2>
            <label>Nome interno *<input type="text" value={editingEstacao.nome ?? ''} onChange={(e) => setEditingEstacao({ ...editingEstacao, nome: e.target.value })} placeholder="ex: triagem" /></label>
            <label>Label (exibido) *<input type="text" value={editingEstacao.label ?? ''} onChange={(e) => setEditingEstacao({ ...editingEstacao, label: e.target.value })} placeholder="ex: Triagem" /></label>
            <label>Prefixo da senha<input type="text" value={editingEstacao.prefixo_senha ?? ''} onChange={(e) => setEditingEstacao({ ...editingEstacao, prefixo_senha: e.target.value.toUpperCase() })} placeholder="ex: TR" maxLength={4} /></label>
            <label>
              Tipo
              <select value={editingEstacao.tipo ?? 'atendimento'} onChange={(e) => setEditingEstacao({ ...editingEstacao, tipo: e.target.value })}>
                <option value="atendimento">Atendimento (gera senha)</option>
                <option value="saida">Saída (sem senha)</option>
              </select>
            </label>
            <label>
              Cor
              <div className="color-row">
                <input type="color" value={editingEstacao.cor ?? '#4299e1'} onChange={(e) => setEditingEstacao({ ...editingEstacao, cor: e.target.value })} />
                <input type="text" value={editingEstacao.cor ?? ''} onChange={(e) => setEditingEstacao({ ...editingEstacao, cor: e.target.value })} />
              </div>
            </label>
            <label>Ativo<select value={editingEstacao.ativo ?? 1} onChange={(e) => setEditingEstacao({ ...editingEstacao, ativo: parseInt(e.target.value) })}><option value={1}>Sim</option><option value={0}>Não</option></select></label>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditingEstacao(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarEstacao} disabled={savingEstacao}>{savingEstacao ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL SEÇÃO ====== */}
      {editingSecao && (
        <div className="modal-overlay" onClick={() => setEditingSecao(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>{editingSecao.id ? 'Editar Seção' : 'Nova Seção'}</h2>
            <label>Nome interno *<input type="text" value={editingSecao.nome ?? ''} onChange={(e) => setEditingSecao({ ...editingSecao, nome: slugify(e.target.value), label: editingSecao.label || e.target.value })} placeholder="ex: anamnese" /></label>
            <label>Label (exibido) *<input type="text" value={editingSecao.label ?? ''} onChange={(e) => setEditingSecao({ ...editingSecao, label: e.target.value })} placeholder="ex: Anamnese" /></label>
            <label>Ícone<input type="text" value={editingSecao.icone ?? ''} onChange={(e) => setEditingSecao({ ...editingSecao, icone: e.target.value })} placeholder="ex: clipboard" /></label>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditingSecao(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarSecao} disabled={savingSecao}>{savingSecao ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL CAMPO ====== */}
      {editingCampo && (
        <div className="modal-overlay" onClick={() => setEditingCampo(null)}>
          <div className="modal-box modal-box--wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editingCampo.id ? 'Editar Campo' : 'Novo Campo'}</h2>
            <label>Label (exibido) *<input type="text" value={editingCampo.label ?? ''} onChange={(e) => setEditingCampo({ ...editingCampo, label: e.target.value, nome: editingCampo.id ? editingCampo.nome : slugify(e.target.value) })} placeholder="ex: Queixa Principal" /></label>
            <label>Nome interno<input type="text" value={editingCampo.nome ?? ''} onChange={(e) => setEditingCampo({ ...editingCampo, nome: slugify(e.target.value) })} placeholder="ex: queixa_principal" /></label>
            <label>Tipo *
              <select value={editingCampo.tipo ?? 'texto'} onChange={(e) => setEditingCampo({ ...editingCampo, tipo: e.target.value })}>
                {TIPOS_CAMPO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            {editingCampo.tipo === 'select' && (
              <label>Opções (separadas por vírgula)<input type="text" value={editingCampo.opcoes ?? ''} onChange={(e) => setEditingCampo({ ...editingCampo, opcoes: e.target.value })} placeholder="ex: Sim, Não, Às vezes" /></label>
            )}
            <label>Placeholder<input type="text" value={editingCampo.placeholder ?? ''} onChange={(e) => setEditingCampo({ ...editingCampo, placeholder: e.target.value })} /></label>
            <label>Unidade (ex: kg, cmH₂O)<input type="text" value={editingCampo.unidade ?? ''} onChange={(e) => setEditingCampo({ ...editingCampo, unidade: e.target.value })} /></label>
            <label>
              Obrigatório
              <select value={editingCampo.obrigatorio ?? 0} onChange={(e) => setEditingCampo({ ...editingCampo, obrigatorio: parseInt(e.target.value) })}>
                <option value={0}>Não</option>
                <option value={1}>Sim</option>
              </select>
            </label>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditingCampo(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarCampo} disabled={savingCampo}>{savingCampo ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
