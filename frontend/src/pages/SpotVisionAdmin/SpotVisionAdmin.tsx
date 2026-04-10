import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { Eye, ArrowLeft, Loader2, Pencil, Check, X, RotateCcw, Search, ScanLine } from 'lucide-react'
import './SpotVisionAdmin.css'

interface SpotExame {
  key: string
  filename: string
  size: number
  modified: string
  codigo_arquivo: string
  codigo_efetivo: string
  mapeado: boolean
  paciente_nome: string | null
  ocr_nome: string | null
  ocr_id: string | null
}

export default function SpotVisionAdmin() {
  const [exames, setExames] = useState<SpotExame[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'mapeados' | 'sem_paciente'>('todos')
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState<string | null>(null)
  const [ocrResults, setOcrResults] = useState<Record<string, { nome_completo: string | null; individuo_id: string | null }>>({})
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState('') 

  async function loadExames() {
    try {
      setLoading(true)
      const { data } = await api.get('/spotvision-admin/all')
      setExames(data)
    } catch {
      setExames([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadExames() }, [])

  useEffect(() => {
    if (msg) { const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t) }
  }, [msg])

  const filtered = exames.filter(e => {
    if (filtro === 'mapeados' && !e.mapeado) return false
    if (filtro === 'sem_paciente' && e.paciente_nome) return false
    if (search) {
      const s = search.toLowerCase()
      return e.filename.toLowerCase().includes(s) ||
        e.codigo_arquivo.toLowerCase().includes(s) ||
        e.codigo_efetivo.toLowerCase().includes(s) ||
        (e.paciente_nome || '').toLowerCase().includes(s) ||
        (e.ocr_nome || '').toLowerCase().includes(s)
    }
    return true
  })

  async function salvarMapeamento(key: string) {
    if (!editVal.trim()) return
    try {
      setSaving(true)
      const { data } = await api.put('/spotvision-admin/mapear', { key, codigo_correto: editVal.trim() })
      setMsg({ text: `Mapeado para: ${data.paciente_nome}`, type: 'ok' })
      setEditKey(null)
      setEditVal('')
      loadExames()
    } catch (err: any) {
      setMsg({ text: err.response?.data?.error || 'Erro ao salvar', type: 'err' })
    } finally {
      setSaving(false)
    }
  }

  async function removerMapeamento(key: string) {
    try {
      setSaving(true)
      await api.delete(`/spotvision-admin/mapear?key=${encodeURIComponent(key)}`)
      setMsg({ text: 'Mapeamento removido — voltou ao código original', type: 'ok' })
      loadExames()
    } catch {
      setMsg({ text: 'Erro ao remover mapeamento', type: 'err' })
    } finally {
      setSaving(false)
    }
  }

  async function abrirPreview(key: string) {
    setPreviewKey(key)
    setPreviewImg(null)
    setPreviewLoading(true)
    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch(`/api/spotvision/image?key=${encodeURIComponent(key)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const blob = await res.blob()
        const reader = new FileReader()
        reader.onloadend = () => { setPreviewImg(reader.result as string); setPreviewLoading(false) }
        reader.readAsDataURL(blob)
      } else {
        setPreviewLoading(false)
      }
    } catch {
      setPreviewLoading(false)
    }
  }

  async function executarOcr(key: string) {
    setOcrLoading(key)
    try {
      const { data } = await api.get(`/spotvision-admin/ocr?key=${encodeURIComponent(key)}`)
      setOcrResults(prev => ({ ...prev, [key]: data }))
      if (data.nome_completo) {
        setMsg({ text: `OCR: ${data.nome_completo} (ID: ${data.individuo_id || '?'})`, type: 'ok' })
        // Atualizar cache local
        setExames(prev => prev.map(e => e.key === key ? { ...e, ocr_nome: data.nome_completo, ocr_id: data.individuo_id } : e))
      } else {
        setMsg({ text: 'OCR não encontrou nome no PDF', type: 'err' })
      }
    } catch {
      setMsg({ text: 'Erro ao executar OCR', type: 'err' })
    } finally {
      setOcrLoading(null)
    }
  }

  async function processarTodos() {
    const semCache = exames.filter(e => !e.ocr_nome)
    if (semCache.length === 0) {
      setMsg({ text: 'Todos os exames já foram processados', type: 'ok' })
      return
    }
    setBatchLoading(true)
    setBatchProgress(`Processando ${semCache.length} exames...`)
    try {
      const { data } = await api.post('/spotvision-admin/ocr-batch')
      setMsg({ text: `Processados: ${data.processed} | Erros: ${data.errors}`, type: data.errors > 0 ? 'err' : 'ok' })
      loadExames()
    } catch {
      setMsg({ text: 'Erro ao processar em lote', type: 'err' })
    } finally {
      setBatchLoading(false)
      setBatchProgress('')
    }
  }

  return (
    <div className="sv-admin-page">
      <div className="sv-hero">
        <div className="sv-hero-icon"><Eye size={26} /></div>
        <div>
          <h1>SpotVision — Gerenciamento</h1>
          <p>Visualize todos os exames do S3 e corrija o código do paciente quando necessário</p>
        </div>
      </div>

      <Link to="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Voltar para Admin
      </Link>

      {msg && (
        <div style={{ padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.84rem', fontWeight: 500,
          background: msg.type === 'ok' ? 'rgba(56,161,105,0.15)' : 'rgba(229,62,62,0.15)',
          color: msg.type === 'ok' ? '#38a169' : '#e53e3e',
          border: `1px solid ${msg.type === 'ok' ? 'rgba(56,161,105,0.3)' : 'rgba(229,62,62,0.3)'}` }}>
          {msg.text}
        </div>
      )}

      <div className="sv-toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por arquivo, código ou paciente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value as any)}>
          <option value="todos">Todos</option>
          <option value="mapeados">Apenas mapeados</option>
          <option value="sem_paciente">Sem paciente</option>
        </select>
        <button className="sv-btn-icon" onClick={loadExames} disabled={loading} title="Recarregar">
          {loading ? <Loader2 size={14} className="sv-spin" /> : <RotateCcw size={14} />}
        </button>
        <button className="sv-btn-batch" onClick={processarTodos} disabled={batchLoading || loading} title="Processar OCR em todos os PDFs sem cache">
          {batchLoading ? <><Loader2 size={14} className="sv-spin" /> {batchProgress}</> : <><ScanLine size={14} /> Processar Todos</>}
        </button>
        <span className="sv-count">{filtered.length} exame{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="sv-loading"><Loader2 size={20} className="sv-spin" /> Carregando exames do S3...</div>
      ) : filtered.length === 0 ? (
        <div className="sv-empty">Nenhum exame encontrado</div>
      ) : (
        <div className="sv-table-wrap">
          <table className="sv-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Data</th>
                <th>Código Arquivo</th>
                <th>Código Efetivo</th>
                <th>Paciente</th>
                <th>Nome no PDF</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.key}>
                  <td className="sv-filename" title={e.filename}>
                    <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }} onClick={() => abrirPreview(e.key)}>
                      {e.filename}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.modified).toLocaleDateString('pt-BR')}</td>
                  <td className="sv-code">{e.codigo_arquivo}</td>
                  <td className="sv-code">
                    {editKey === e.key ? (
                      <div className="sv-edit-row">
                        <input
                          value={editVal}
                          onChange={ev => setEditVal(ev.target.value)}
                          placeholder="Novo código"
                          autoFocus
                          onKeyDown={ev => { if (ev.key === 'Enter') salvarMapeamento(e.key); if (ev.key === 'Escape') setEditKey(null) }}
                        />
                        <button className="sv-btn-icon sv-save" onClick={() => salvarMapeamento(e.key)} disabled={saving} title="Salvar">
                          {saving ? <Loader2 size={14} className="sv-spin" /> : <Check size={14} />}
                        </button>
                        <button className="sv-btn-icon sv-cancel" onClick={() => setEditKey(null)} title="Cancelar">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      e.codigo_efetivo
                    )}
                  </td>
                  <td>{e.paciente_nome || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}</td>
                  <td>
                    {e.ocr_nome || ocrResults[e.key]?.nome_completo ? (
                      <span style={{ fontSize: '0.8rem' }}>
                        {e.ocr_nome || ocrResults[e.key]?.nome_completo}
                      </span>
                    ) : ocrLoading === e.key ? (
                      <Loader2 size={14} className="sv-spin" />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    {e.mapeado ? (
                      <span className="sv-badge-mapped">Mapeado</span>
                    ) : e.paciente_nome ? (
                      <span className="sv-badge-ok">OK</span>
                    ) : (
                      <span className="sv-badge-no-patient">Sem paciente</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {editKey !== e.key && (
                        <button className="sv-btn-icon" onClick={() => { setEditKey(e.key); setEditVal(e.codigo_efetivo) }} title="Alterar código">
                          <Pencil size={14} />
                        </button>
                      )}
                      {editKey !== e.key && (
                        <button className="sv-btn-icon" onClick={() => executarOcr(e.key)} disabled={ocrLoading !== null} title="Ler nome via OCR">
                          {ocrLoading === e.key ? <Loader2 size={14} className="sv-spin" /> : <ScanLine size={14} />}
                        </button>
                      )}
                      {e.mapeado && editKey !== e.key && (
                        <button className="sv-btn-icon sv-undo" onClick={() => removerMapeamento(e.key)} title="Restaurar código original">
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview modal */}
      {previewKey && (
        <div className="sv-preview-overlay" onClick={() => { setPreviewKey(null); setPreviewImg(null) }}>
          <div className="sv-preview-modal" onClick={ev => ev.stopPropagation()}>
            <button className="sv-preview-close" onClick={() => { setPreviewKey(null); setPreviewImg(null) }}>
              <X size={16} />
            </button>
            {previewLoading ? (
              <div className="sv-loading"><Loader2 size={20} className="sv-spin" /> Carregando imagem...</div>
            ) : previewImg ? (
              <img src={previewImg} alt="SpotVision Preview" />
            ) : (
              <div className="sv-empty">Não foi possível carregar a imagem</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
