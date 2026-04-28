import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import api from '../../services/api.ts'
import { BarChart3, Download, FileSpreadsheet, Search, Filter, Calendar, Building2, Activity, Users, Clock, ChevronLeft, ChevronRight, ArrowLeft, FileText } from 'lucide-react'
import './RelatorioAtendimentos.css'

interface Resumo {
  total_atendimentos: number
  por_resultado: { resultado: string; total: number }[]
  por_escola: { escola: string; total: number }[]
  por_dia: { data_atendimento: string; total: number }[]
  media_minutos: number | null
  por_medico: { medico_nome: string; total: number }[]
}

interface HistoricoItem {
  id: number
  paciente_id: number
  nome_completo: string
  cpf: string
  sexo: string | null
  data_nascimento: string | null
  codigo: string | null
  escola: string | null
  data_atendimento: string
  hora_entrada: string
  hora_saida: string | null
  resultado: string
  diagnostico: string | null
  especialidade: string | null
  conduta_inicial: string | null
  conduta_final: string | null
  medico_nome: string | null
}

interface HistoricoResponse {
  data: HistoricoItem[]
  total: number
  page: number
  limit: number
  pages: number
}

const RESULTADO_LABELS: Record<string, string> = {
  alta: 'Alta',
  encaminhamento: 'Encaminhamento',
  oculos: 'Óculos (Alta)',
  oculos_encaminhamento: 'Óculos (Encaminhamento)',
}

const RESULTADO_COLORS: Record<string, string> = {
  alta: '#48bb78',
  encaminhamento: '#ed8936',
  oculos: '#4299e1',
  oculos_encaminhamento: '#ed64a6',
}

export default function RelatorioAtendimentos() {
  const [tab, setTab] = useState<'resumo' | 'lista'>('resumo')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [escola, setEscola] = useState('')
  const [resultado, setResultado] = useState('')
  const [escolas, setEscolas] = useState<string[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [historico, setHistorico] = useState<HistoricoResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchPaciente, setSearchPaciente] = useState('')

  useEffect(() => {
    api.get('/historico/escolas').then(r => setEscolas(r.data)).catch(() => {})
    const hoje = new Date()
    const inicio = new Date(hoje)
    inicio.setDate(inicio.getDate() - 30)
    setDataInicio(inicio.toISOString().split('T')[0])
    setDataFim(hoje.toISOString().split('T')[0])
  }, [])

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {}
    if (dataInicio) params.data_inicio = dataInicio
    if (dataFim) params.data_fim = dataFim
    if (escola) params.escola = escola
    if (resultado) params.resultado = resultado
    return params
  }, [dataInicio, dataFim, escola, resultado])

  const fetchResumo = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/historico/resumo', { params: buildParams() })
      setResumo(res.data)
    } catch {
      console.error('Erro ao carregar resumo')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  const fetchHistorico = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await api.get('/historico', { params: { ...buildParams(), page: p, limit: 25 } })
      setHistorico(res.data)
      setPage(p)
    } catch {
      console.error('Erro ao carregar histórico')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => {
    if (!dataInicio || !dataFim) return
    if (tab === 'resumo') fetchResumo()
    else fetchHistorico(1)
  }, [tab, dataInicio, dataFim, escola, resultado, fetchResumo, fetchHistorico])

  const exportarCSV = () => {
    const params = new URLSearchParams(buildParams())
    const baseUrl = api.defaults.baseURL || ''
    const token = localStorage.getItem('token')
    window.open(`${baseUrl}/historico/exportar?${params.toString()}&token=${token}`, '_blank')
  }

  const exportarPDF = async () => {
    const win = window.open('', '_blank')
    if (!win) { alert('Permita pop-ups para gerar o relatório.'); return }
    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Atendimentos</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background:#f5f3fa;font-family:'Segoe UI',Arial,sans-serif;color:#444}
  .loader-container{text-align:center}
  .spinner{width:48px;height:48px;border:4px solid #e8e0f3;border-top:4px solid #6743a5;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .loader-text{font-size:14pt;font-weight:600;color:#6743a5;letter-spacing:0.5px}
  .loader-sub{font-size:10pt;color:#999;margin-top:6px}
  .pulse-bar{width:120px;height:3px;background:#e8e0f3;border-radius:2px;margin:16px auto 0;overflow:hidden;position:relative}
  .pulse-bar::after{content:'';position:absolute;left:-40%;width:40%;height:100%;background:linear-gradient(90deg,transparent,#6743a5,transparent);animation:pulse 1.2s ease-in-out infinite}
  @keyframes pulse{to{left:100%}}
</style></head><body>
  <div class="loader-container">
    <div class="spinner"></div>
    <p class="loader-text">Gerando relatório...</p>
    <p class="loader-sub">Relatório de Atendimentos</p>
    <div class="pulse-bar"></div>
  </div>
</body></html>`)

    try {
      // Load logos as base64
      const loadImg = (src: string): Promise<string> => new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = img.naturalWidth; c.height = img.naturalHeight
          c.getContext('2d')!.drawImage(img, 0, 0)
          resolve(c.toDataURL('image/png'))
        }
        img.onerror = () => resolve('')
        img.src = src
      })
      const [logoSrc, logoCareSrc] = await Promise.all([
        loadImg('/imagens/logo_cerof.png'),
        loadImg('/imagens/logo_care.png'),
      ])
      const logoTag = logoSrc ? `<img class="logo-cerof" src="${logoSrc}" alt="Logo CEROF" />` : '<div></div>'
      const logoCareTag = logoCareSrc ? `<img class="logo-care" src="${logoCareSrc}" alt="Logo Care" />` : '<div></div>'

      const params = buildParams()
      const [resResumo, resLista] = await Promise.all([
        api.get('/historico/resumo', { params }),
        api.get('/historico', { params: { ...params, page: 1, limit: 9999 } }),
      ])
      const dadosResumo: Resumo = resResumo.data
      const dadosLista: HistoricoItem[] = resLista.data.data || []
      const periodoTexto = `${dataInicio ? new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} a ${dataFim ? new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}`
      const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

      const resultadosRows = dadosResumo.por_resultado.map(r => {
        const pct = dadosResumo.total_atendimentos > 0 ? ((r.total / dadosResumo.total_atendimentos) * 100).toFixed(1) : '0'
        const colors: Record<string, string> = { alta: '#48bb78', encaminhamento: '#ed8936', oculos: '#4299e1', oculos_encaminhamento: '#ed64a6' }
        const color = colors[r.resultado] || '#a0aec0'
        return `<tr>
          <td style="padding:6px 10px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${RESULTADO_LABELS[r.resultado] || r.resultado}</td>
          <td style="padding:6px 10px;text-align:center;font-weight:600">${r.total}</td>
          <td style="padding:6px 10px;text-align:center">${pct}%</td>
        </tr>`
      }).join('')

      const escolasRows = dadosResumo.por_escola.slice(0, 15).map(e =>
        `<tr><td style="padding:5px 10px">${e.escola}</td><td style="padding:5px 10px;text-align:center;font-weight:600">${e.total}</td></tr>`
      ).join('')

      const medicosRows = dadosResumo.por_medico.map(m =>
        `<tr><td style="padding:5px 10px">${m.medico_nome}</td><td style="padding:5px 10px;text-align:center;font-weight:600">${m.total}</td></tr>`
      ).join('')

      const cssReport = `
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; font-size:9pt; color:#222; background:#fff;
               -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .page { width:100%; padding:0 24px 10px; }

        /* Header identico ao pdfService */
        .doc-header {
          display:flex; align-items:center; justify-content:space-between;
          padding-bottom:14px; margin-bottom:6px; border-bottom:3px solid #6743a5;
        }
        .doc-header .logo-cerof { max-height:72px; }
        .doc-header .logo-care { max-height:48px; }

        /* Titulo do documento */
        .doc-title { text-align:center; font-size:13pt; font-weight:700; color:#6743a5;
                     margin:22px 0 6px; text-transform:uppercase; letter-spacing:3px; }
        .doc-title-line { width:60px; height:3px; background:linear-gradient(90deg,#6743a5,#9b6dff);
                          margin:0 auto 16px; border-radius:2px; }

        /* Periodo info */
        .periodo-info { text-align:center; font-size:8.5pt; color:#777; margin-bottom:18px; }
        .periodo-info strong { color:#6743a5; }

        .stats-row { display:flex; gap:12px; margin-bottom:18px; }
        .stat-card { flex:1; background:#f8f5ff; border:1px solid #e8e0f3; border-radius:8px; padding:10px 12px; text-align:center; }
        .stat-card .sv { font-size:18pt; font-weight:800; color:#6743a5; display:block; line-height:1.1; }
        .stat-card .sl { font-size:7pt; color:#999; text-transform:uppercase; letter-spacing:0.8px; margin-top:2px; }
        .section { margin-bottom:16px; }
        .section h3 { font-size:9.5pt; font-weight:700; color:#6743a5; text-transform:uppercase; letter-spacing:0.8px; padding-bottom:5px; margin-bottom:8px; border-bottom:2px solid #e8e0f3; }
        .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px; }
        table { width:100%; border-collapse:collapse; font-size:8pt; }
        table th { background:#6743a5; color:#fff; padding:6px 10px; text-align:left; font-size:7pt; text-transform:uppercase; letter-spacing:0.4px; }
        table td { padding:5px 10px; border-bottom:1px solid #ece6f5; }
        table tbody tr:nth-child(even) { background:#faf8ff; }
        .lista-table th { font-size:6.5pt; padding:5px 6px; }
        .lista-table td { padding:4px 6px; font-size:7.5pt; }
        .footer { text-align:center; margin-top:20px; padding-top:8px; border-top:1px solid #e8e0f3; font-size:7pt; color:#bbb; }
      `

      const headerBlock = `
    <div class="doc-header">
      ${logoTag}
      ${logoCareTag}
    </div>`

      // Part 1: Summary (portrait)
      const htmlSummary = `
<div class="page">
  ${headerBlock}
  <div class="doc-title">Relatório de Atendimentos</div>
  <div class="doc-title-line"></div>
  <div class="periodo-info"><strong>Período:</strong> ${periodoTexto} &nbsp;•&nbsp; Gerado em ${hoje}</div>
  <div class="stats-row">
    <div class="stat-card"><span class="sv">${dadosResumo.total_atendimentos}</span><span class="sl">Atendimentos</span></div>
    <div class="stat-card"><span class="sv">${dadosResumo.media_minutos ? dadosResumo.media_minutos + 'min' : '—'}</span><span class="sl">Tempo Médio</span></div>
    <div class="stat-card"><span class="sv">${dadosResumo.por_medico?.length ?? 0}</span><span class="sl">Médicos</span></div>
    <div class="stat-card"><span class="sv">${dadosResumo.por_escola?.length ?? 0}</span><span class="sl">Escolas</span></div>
  </div>
  ${dadosResumo.por_resultado.length > 0 ? `<div class="section"><h3>Distribuição por Resultado</h3><table><thead><tr><th>Resultado</th><th style="text-align:center">Total</th><th style="text-align:center">%</th></tr></thead><tbody>${resultadosRows}</tbody></table></div>` : ''}
  <div class="grid-2">
    ${dadosResumo.por_escola.length > 0 ? `<div class="section"><h3>Por Escola</h3><table><thead><tr><th>Escola</th><th style="text-align:center">Total</th></tr></thead><tbody>${escolasRows}</tbody></table></div>` : ''}
    ${dadosResumo.por_medico.length > 0 ? `<div class="section"><h3>Por Médico</h3><table><thead><tr><th>Médico</th><th style="text-align:center">Total</th></tr></thead><tbody>${medicosRows}</tbody></table></div>` : ''}
  </div>
  <div class="footer">NordcsCare — Saúde Ocular • Relatório gerado em ${hoje}</div>
</div>`

      const RENDER_WIDTH = 794 // A4 portrait px

      // Helper: render HTML to canvas
      const renderToCanvas = async (html: string) => {
        const el = document.createElement('div')
        el.style.cssText = `position:fixed;left:-9999px;top:0;width:${RENDER_WIDTH}px;background:#fff;padding:0;z-index:-1;`
        el.innerHTML = `<style>${cssReport}</style>${html}`
        document.body.appendChild(el)
        const c = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: RENDER_WIDTH, windowWidth: RENDER_WIDTH })
        document.body.removeChild(el)
        return c
      }

      // Helper: add canvas pages to PDF (for summary)
      const addCanvasPages = (pdf: jsPDF, canvas: HTMLCanvasElement, startNewPage: boolean) => {
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const marginTop = 2
        const marginBottom = 8
        const pxPerMm = canvas.width / pageWidth
        const usableHeightPx = Math.floor((pageHeight - marginTop - marginBottom) * pxPerMm)
        let yOffset = 0
        let first = true

        while (yOffset < canvas.height) {
          if (!first || startNewPage) pdf.addPage()
          first = false
          const sliceH = Math.min(usableHeightPx, canvas.height - yOffset)
          const pc = document.createElement('canvas')
          pc.width = canvas.width
          pc.height = sliceH
          const ctx = pc.getContext('2d')!
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, pc.width, pc.height)
          ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
          pdf.addImage(pc.toDataURL('image/png'), 'PNG', 0, marginTop, pageWidth, sliceH / pxPerMm)
          yOffset += sliceH
        }
      }

      // Render list in row-aware pages to avoid cutting rows at page breaks
      const renderListPages = async (pdf: jsPDF) => {
        const pageWidth = pdf.internal.pageSize.getWidth()
        const marginTop = 2
        const ROWS_FIRST_PAGE = 28 // fewer rows on first page (has header+title)
        const ROWS_OTHER_PAGES = 42

        const totalRows = dadosLista.length
        let offset = 0
        let pageNum = 0

        while (offset < totalRows) {
          const rowsThisPage = pageNum === 0 ? ROWS_FIRST_PAGE : ROWS_OTHER_PAGES
          const chunk = dadosLista.slice(offset, offset + rowsThisPage)
          const chunkRows = chunk.map(item => {
            const colors: Record<string, string> = { alta: '#48bb78', encaminhamento: '#ed8936', oculos: '#4299e1', oculos_encaminhamento: '#ed64a6' }
            const color = colors[item.resultado] || '#a0aec0'
            const sexoLabel = item.sexo === 'M' ? 'Masc.' : item.sexo === 'F' ? 'Fem.' : item.sexo || '\u2014'
            const dataNasc = item.data_nascimento ? new Date(item.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '\u2014'
            return `<tr>
              <td>${new Date(item.data_atendimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
              <td>${item.nome_completo}</td>
              <td>${sexoLabel}</td>
              <td>${dataNasc}</td>
              <td>${item.cpf || '\u2014'}</td>
              <td><span style="background:${color}18;color:${color};padding:1px 6px;border-radius:8px;font-size:7pt;font-weight:600">${RESULTADO_LABELS[item.resultado] || item.resultado}</span></td>
              <td>${item.especialidade || '\u2014'}</td>
            </tr>`
          }).join('')

          const isFirst = pageNum === 0
          const isLast = offset + rowsThisPage >= totalRows
          const pageHtml = `
<div class="page">
  ${isFirst ? headerBlock : ''}
  ${isFirst ? `<div class="doc-title">Lista de Atendimentos</div><div class="doc-title-line"></div><div class="periodo-info">${dadosLista.length} registros &nbsp;•&nbsp; <strong>Per\u00edodo:</strong> ${periodoTexto}${escola ? ` &nbsp;•&nbsp; <strong>Escola:</strong> ${escola}` : ''}</div>` : ''}
  <table class="lista-table">
    <thead><tr><th>Data</th><th>Paciente</th><th>Sexo</th><th>Nasc.</th><th>CPF</th><th>Desfecho</th><th>Especialidade</th></tr></thead>
    <tbody>${chunkRows}</tbody>
  </table>
  ${isLast ? `<div class="footer">NordcsCare \u2014 Sa\u00fade Ocular \u2022 Relat\u00f3rio gerado em ${hoje}</div>` : ''}
</div>`

          const canvas = await renderToCanvas(pageHtml)
          pdf.addPage()
          const pxPerMm = canvas.width / pageWidth
          const imgH = canvas.height / pxPerMm
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, marginTop, pageWidth, imgH)
          offset += rowsThisPage
          pageNum++
        }
      }

      const canvasSummary = await renderToCanvas(htmlSummary)

      const pdf = new jsPDF('p', 'mm', 'a4')
      addCanvasPages(pdf, canvasSummary, false)
      await renderListPages(pdf)

      const pdfBlob = pdf.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      win.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 120000)
    } catch {
      win.close()
      alert('Erro ao gerar relatório. Tente novamente.')
    }
  }

  const maxBar = resumo?.por_escola?.length
    ? Math.max(...resumo.por_escola.map(e => e.total))
    : 0

  const maxDiaBar = resumo?.por_dia?.length
    ? Math.max(...resumo.por_dia.map(d => d.total))
    : 0

  const filteredHistorico = historico?.data?.filter(item =>
    !searchPaciente || item.nome_completo.toLowerCase().includes(searchPaciente.toLowerCase())
  ) || []

  return (
    <div className="rela-page">
      {/* Hero */}
      <div className="rela-hero">
        <div className="rela-hero-bg-deco" />
        <div className="rela-hero-top">
          <Link to="/relatorios" className="rela-btn-back">
            <ArrowLeft size={16} /> Relatórios
          </Link>
        </div>
        <div className="rela-hero-content">
          <div className="rela-hero-icon">
            <BarChart3 size={28} />
          </div>
          <div>
            <h1>Relatório de Atendimentos</h1>
            <p className="rela-hero-subtitle">Histórico completo de atendimentos finalizados</p>
          </div>
        </div>
        <div className="rela-hero-stats">
          <div className="rela-hero-stat">
            <div className="rela-hero-stat-icon rela-hsi-total">
              <Activity size={16} />
            </div>
            <div className="rela-hero-stat-info">
              <span className="rela-hero-stat-value">{resumo?.total_atendimentos ?? '—'}</span>
              <span className="rela-hero-stat-label">Atendimentos</span>
            </div>
          </div>
          <div className="rela-hero-stat">
            <div className="rela-hero-stat-icon rela-hsi-tempo">
              <Clock size={16} />
            </div>
            <div className="rela-hero-stat-info">
              <span className="rela-hero-stat-value">{resumo?.media_minutos ? `${resumo.media_minutos}min` : '—'}</span>
              <span className="rela-hero-stat-label">Tempo Médio</span>
            </div>
          </div>
          <div className="rela-hero-stat">
            <div className="rela-hero-stat-icon rela-hsi-medicos">
              <Users size={16} />
            </div>
            <div className="rela-hero-stat-info">
              <span className="rela-hero-stat-value">{resumo?.por_medico?.length ?? '—'}</span>
              <span className="rela-hero-stat-label">Médicos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="rela-filters">
        <div className="rela-filters-row">
          <div className="rela-filter-group">
            <Calendar size={14} />
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            <span className="rela-filter-sep">até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div className="rela-filter-group">
            <Building2 size={14} />
            <select value={escola} onChange={e => setEscola(e.target.value)}>
              <option value="">Todas as escolas</option>
              {escolas.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="rela-filter-group">
            <Filter size={14} />
            <select value={resultado} onChange={e => setResultado(e.target.value)}>
              <option value="">Todos os resultados</option>
              <option value="alta">Alta</option>
              <option value="encaminhamento">Encaminhamento</option>
              <option value="oculos">Óculos (Alta)</option>
              <option value="oculos_encaminhamento">Óculos (Encaminhamento)</option>
            </select>
          </div>
          <button className="rela-btn-export" onClick={exportarCSV}>
            <Download size={14} />
            Exportar CSV
          </button>
          <button className="rela-btn-export rela-btn-pdf" onClick={exportarPDF}>
            <FileText size={14} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rela-tabs">
        <button className={`rela-tab ${tab === 'resumo' ? 'active' : ''}`} onClick={() => setTab('resumo')}>
          <BarChart3 size={15} /> Resumo
        </button>
        <button className={`rela-tab ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>
          <FileSpreadsheet size={15} /> Lista de Atendimentos
        </button>
      </div>

      {loading && <div className="rela-loading">Carregando...</div>}

      {/* Resumo Tab */}
      {tab === 'resumo' && resumo && !loading && (
        <div className="rela-resumo">
          {/* Resultado Distribution */}
          <div className="rela-card">
            <h3>Distribuição por Resultado</h3>
            {resumo.por_resultado.length === 0 ? (
              <p className="rela-empty">Nenhum dado no período</p>
            ) : (
              <div className="rela-resultado-grid">
                {resumo.por_resultado.map(r => {
                  const pct = resumo.total_atendimentos > 0 ? ((r.total / resumo.total_atendimentos) * 100).toFixed(1) : '0'
                  return (
                    <div key={r.resultado} className="rela-resultado-item">
                      <div className="rela-resultado-header">
                        <span className="rela-resultado-dot" style={{ background: RESULTADO_COLORS[r.resultado] || '#a0aec0' }} />
                        <span className="rela-resultado-label">{RESULTADO_LABELS[r.resultado] || r.resultado}</span>
                        <span className="rela-resultado-count">{r.total}</span>
                      </div>
                      <div className="rela-resultado-bar-bg">
                        <div className="rela-resultado-bar" style={{ width: `${pct}%`, background: RESULTADO_COLORS[r.resultado] || '#a0aec0' }} />
                      </div>
                      <span className="rela-resultado-pct">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Por Escola */}
          <div className="rela-card">
            <h3>Atendimentos por Escola</h3>
            {resumo.por_escola.length === 0 ? (
              <p className="rela-empty">Nenhum dado no período</p>
            ) : (
              <div className="rela-escola-list">
                {resumo.por_escola.slice(0, 10).map(e => (
                  <div key={e.escola} className="rela-escola-item">
                    <span className="rela-escola-nome">{e.escola}</span>
                    <div className="rela-escola-bar-bg">
                      <div className="rela-escola-bar" style={{ width: `${maxBar > 0 ? (e.total / maxBar) * 100 : 0}%` }} />
                    </div>
                    <span className="rela-escola-count">{e.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evolução por Dia */}
          {resumo.por_dia.length > 0 && (
            <div className="rela-card rela-card-full">
              <h3>Evolução Diária</h3>
              <div className="rela-chart-bars">
                {resumo.por_dia.map(d => (
                  <div key={d.data_atendimento} className="rela-chart-col">
                    <span className="rela-chart-val">{d.total}</span>
                    <div className="rela-chart-bar" style={{ height: `${maxDiaBar > 0 ? (d.total / maxDiaBar) * 100 : 0}%` }} />
                    <span className="rela-chart-label">{new Date(d.data_atendimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Por Médico */}
          {resumo.por_medico.length > 0 && (
            <div className="rela-card">
              <h3>Atendimentos por Médico</h3>
              <div className="rela-escola-list">
                {resumo.por_medico.map(m => {
                  const maxMedico = Math.max(...resumo.por_medico.map(x => x.total))
                  return (
                    <div key={m.medico_nome} className="rela-escola-item">
                      <span className="rela-escola-nome">{m.medico_nome}</span>
                      <div className="rela-escola-bar-bg">
                        <div className="rela-escola-bar" style={{ width: `${maxMedico > 0 ? (m.total / maxMedico) * 100 : 0}%`, background: '#805ad5' }} />
                      </div>
                      <span className="rela-escola-count">{m.total}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista Tab */}
      {tab === 'lista' && !loading && historico && (
        <div className="rela-lista">
          <div className="rela-lista-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Filtrar por nome do paciente..."
              value={searchPaciente}
              onChange={e => setSearchPaciente(e.target.value)}
            />
          </div>

          <div className="rela-table-wrap">
              <table className="rela-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Sexo</th>
                  <th>Nasc.</th>
                  <th>CPF</th>
                  <th>Escola</th>
                  <th>Desfecho</th>
                  <th>Especialidade</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistorico.length === 0 ? (
                  <tr><td colSpan={8} className="rela-empty">Nenhum atendimento encontrado</td></tr>
                ) : (
                  filteredHistorico.map(item => (
                    <tr key={item.id}>
                      <td>{new Date(item.data_atendimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td><strong>{item.nome_completo}</strong></td>
                      <td>{item.sexo === 'M' ? 'Masc.' : item.sexo === 'F' ? 'Fem.' : item.sexo || '—'}</td>
                      <td>{item.data_nascimento ? new Date(item.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td>{item.cpf || '—'}</td>
                      <td>{item.escola || '—'}</td>
                      <td>
                        <span className="rela-resultado-badge" style={{ background: (RESULTADO_COLORS[item.resultado] || '#a0aec0') + '22', color: RESULTADO_COLORS[item.resultado] || '#a0aec0' }}>
                          {RESULTADO_LABELS[item.resultado] || item.resultado}
                        </span>
                      </td>
                      <td>{item.especialidade || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {historico.pages > 1 && (
            <div className="rela-pagination">
              <button disabled={page <= 1} onClick={() => fetchHistorico(page - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span>Página {page} de {historico.pages} ({historico.total} registros)</span>
              <button disabled={page >= historico.pages} onClick={() => fetchHistorico(page + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
