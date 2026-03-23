/* ===================================================================
   PDF Service — Gera PDF real via jsPDF + html2canvas
   =================================================================== */
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface PacientePdf {
  nome_completo: string
  cpf?: string
  data_nascimento?: string
  sexo?: string
  telefone?: string
  endereco?: string
  convenio?: string
  codigo?: string
  responsavel?: string
}

interface MedicoPdf {
  nome: string
  crm?: string
  uf?: string
  especialidade?: string
}

interface PrescricaoPdf {
  tipo?: string
  od_esferico?: string; od_cilindrico?: string; od_eixo?: string; od_adicao?: string
  oe_esferico?: string; oe_cilindrico?: string; oe_eixo?: string; oe_adicao?: string
  dp?: string; observacoes?: string
}

interface LaudoPdf {
  diagnostico?: string
  conduta_inicial?: string
  conduta_final?: string
  observacoes?: string
}

interface AnamnesePdf {
  queixa_principal?: string; historico_ocular?: string; historico_familiar?: string
  alergias?: string; medicamentos_em_uso?: string; cirurgias_anteriores?: string; observacoes?: string
}

interface ExamePdf {
  tipo_exame: string; olho: string; resultado?: string; observacoes?: string
}

interface AcuidadePdf {
  sem_oculos_od?: string | null; sem_oculos_oe?: string | null
  usa_oculos?: number; com_oculos_od?: string | null; com_oculos_oe?: string | null
  dilata?: number; observacoes?: string | null
}

function calcIdade(dataNasc: string): number {
  const birth = new Date(dataNasc)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function dataFormatada(): string {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function condutaLabel(val: string): string {
  const map: Record<string, string> = { alta: 'Alta', onibus: 'Ônibus', encaminhamento: 'Encaminhamento' }
  return map[val] ?? val
}

function tipoExameLabel(val: string): string {
  const map: Record<string, string> = {
    acuidade_visual: 'Acuidade Visual', refracao: 'Refração', tonometria: 'Tonometria',
    spot_vision: 'Spot Vision', eyer: 'Eyer', outro: 'Outro',
  }
  return map[val] ?? val
}

// ===== Estilos globais do documento PDF =====
const CSS_BASE = `
  @page { size: A4; margin: 20mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 12pt;
    color: #1a1a1a;
    line-height: 1.5;
    padding: 0;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-container { max-width: 760px; margin: 0 auto; padding: 10px 20px; }
  .doc-container.doc-centered {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .doc-container.doc-centered .doc-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  /* Header */
  .doc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #6743a5;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .doc-header .logo-cerof {
    max-height: 70px;
  }
  .doc-header .header-brand {
    text-align: right;
  }
  .doc-header h1 {
    font-size: 18pt;
    color: #6743a5;
    margin-bottom: 2px;
    letter-spacing: 1px;
  }
  .doc-header .subtitle {
    font-size: 10pt;
    color: #2e2e2e;
  }
  
  /* Título do documento */
  .doc-title {
    text-align: center;
    font-size: 16pt;
    font-weight: 700;
    color: #6743a5;
    margin: 24px 0 16px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  
  /* Paciente info */
  .paciente-info {
    background: #f5f5f5;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 20px;
    font-size: 11pt;
  }
  .paciente-info p { margin-bottom: 4px; }
  .paciente-info strong { color: #333; }
  
  /* Conteúdo genérico */
  .doc-body { margin: 20px 0; }
  .doc-body p { margin-bottom: 8px; }
  .doc-body .texto-livre {
    white-space: pre-wrap;
    font-size: 12pt;
    line-height: 1.7;
    padding: 10px 0;
  }
  
  /* Tabela RX */
  .rx-table {
    width: 80%;
    margin: 16px auto;
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 13px;
    overflow: hidden;
    border: 1.5px solid #333;
  }
  .rx-table th {
    background: transparent;
    color: #1a1a1a;
    font-weight: 700;
    padding: 10px 14px;
    text-align: center;
    font-size: 10pt;
    letter-spacing: 0.5px;
    border-bottom: 2px solid #333;
  }
  .rx-table td {
    padding: 10px 14px;
    text-align: center;
    font-size: 11pt;
    font-weight: 500;
    color: #1a1a1a;
    background: #fff;
  }
  .rx-table tbody tr:not(:last-child) td {
    border-bottom: 1px solid #ccc;
  }
  .rx-table .eye-label {
    font-weight: 700;
    background: #f0f0f0;
    color: #1a1a1a;
    width: 60px;
    font-size: 13pt;
    letter-spacing: 1px;
  }
  .rx-adicao {
    width: 25%;
    margin: 8px auto 16px;
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 13px;
    overflow: hidden;
    border: 1.5px solid #333;
  }
  .rx-adicao th {
    background: transparent;
    color: #1a1a1a;
    font-weight: 700;
    padding: 5px 12px;
    text-align: center;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 2px solid #333;
  }
  .rx-adicao td {
    padding: 6px 12px;
    text-align: center;
    font-size: 11pt;
    font-weight: 600;
    background: #fff;
    color: #1a1a1a;
  }
  
  /* Seções do relatório */
  .section {
    margin-bottom: 18px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .section h3 {
    font-size: 12pt;
    color: #6743a5;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  .section p { font-size: 11pt; margin-bottom: 4px; }
  
  /* Rodapé / Assinatura */
  .doc-footer {
    margin-top: 60px;
    text-align: center;
    border-top: 1px solid #ccc;
    padding-top: 20px;
  }
  .doc-footer .assinatura-line {
    width: 300px;
    border-top: 1px solid #333;
    margin: 40px auto 8px;
  }
  .doc-footer .medico-nome { font-weight: 700; font-size: 12pt; }
  .doc-footer .medico-crm { font-size: 10pt; color: #555; }
  .doc-footer .data { margin-top: 16px; font-size: 10pt; color: #777; }

  @media print {
    body { padding: 0; margin: 0; }
    .no-print { display: none !important; }
  }
`

async function gerarPdfReal(html: string, titulo: string) {
  const win = window.open('', '_blank')
  if (!win) { alert('Permita pop-ups para gerar o documento.'); return }
  win.document.write('<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#555"><p>Gerando PDF...</p></body></html>')

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:0;z-index:-1;'
  container.innerHTML = `<style>${CSS_BASE}</style>${html}`
  document.body.appendChild(container)

  try {
    // Mede a altura do cabeçalho (header + título + paciente-info) para saber
    // onde termina e onde começa o conteúdo real
    const headerEl = container.querySelector('.doc-header') as HTMLElement | null
    const titleEl = container.querySelector('.doc-title') as HTMLElement | null
    const pacienteEl = container.querySelector('.paciente-info') as HTMLElement | null
    const containerRect = container.getBoundingClientRect()

    // O conteúdo começa após o último elemento do cabeçalho
    let headerEndPx = 0
    const topElements = [headerEl, titleEl, pacienteEl].filter(Boolean) as HTMLElement[]
    for (const el of topElements) {
      const rect = el.getBoundingClientRect()
      const bottom = rect.bottom - containerRect.top
      if (bottom > headerEndPx) headerEndPx = bottom
    }

    // Coleta as posições Y dos títulos de seção (pontos de quebra preferidos)
    const breakElements = container.querySelectorAll('.section, .doc-footer')
    const sectionTops: number[] = []
    breakElements.forEach(el => {
      const rect = el.getBoundingClientRect()
      const yRelative = rect.top - containerRect.top
      if (yRelative > headerEndPx) sectionTops.push(yRelative)
    })
    sectionTops.sort((a, b) => a - b)

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    })

    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()   // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight()  // 297mm
    const marginTop = 15  // mm — margem superior para páginas 2+
    const marginBottom = 15 // mm — margem inferior
    const pxPerMm = canvas.width / pageWidth
    const scaleFactor = canvas.width / 794

    // Cabeçalho em pixels do canvas
    const headerEndCanvasPx = Math.floor(headerEndPx * scaleFactor)

    // Área útil de conteúdo por página (em px do canvas)
    const usableHeightPx = Math.floor((pageHeight - marginTop - marginBottom) * pxPerMm)
    // Primeira página: conteúdo começa após o cabeçalho
    const firstPageContentPx = Math.floor((pageHeight - marginBottom) * pxPerMm) - headerEndCanvasPx

    // Converte posições de seção de CSS px para canvas px
    const sectionBreaks = sectionTops.map(y => Math.floor(y * scaleFactor))

    function findBreakPoint(startY: number, availableHeight: number): number {
      const endY = Math.min(startY + availableHeight, canvas.height)
      if (endY >= canvas.height) return canvas.height

      // Procura o último título de seção que cabe nesta página
      let bestBreak = -1
      for (const sy of sectionBreaks) {
        if (sy <= startY) continue
        if (sy > endY) break
        bestBreak = sy
      }

      // Se encontrou um título nos últimos 30%, quebra antes dele
      if (bestBreak > 0 && bestBreak > startY + availableHeight * 0.7) {
        return bestBreak
      }

      // Fallback: procura linha branca nos últimos 15%
      const ctx = canvas.getContext('2d')!
      const searchRange = Math.floor(availableHeight * 0.15)
      const scanStart = endY - searchRange
      for (let y = endY; y >= scanStart; y--) {
        const row = ctx.getImageData(0, y, canvas.width, 1).data
        let isWhite = true
        for (let i = 0; i < row.length; i += 16) {
          if (row[i] < 250 || row[i + 1] < 250 || row[i + 2] < 250) {
            isWhite = false
            break
          }
        }
        if (isWhite) return y
      }
      return endY
    }

    // ===== PÁGINA 1: Cabeçalho + início do conteúdo =====
    // Renderiza o cabeçalho no topo
    const headerCanvas = document.createElement('canvas')
    headerCanvas.width = canvas.width
    headerCanvas.height = headerEndCanvasPx
    const hCtx = headerCanvas.getContext('2d')!
    hCtx.fillStyle = '#ffffff'
    hCtx.fillRect(0, 0, headerCanvas.width, headerCanvas.height)
    hCtx.drawImage(canvas, 0, 0, canvas.width, headerEndCanvasPx, 0, 0, canvas.width, headerEndCanvasPx)
    const headerImg = headerCanvas.toDataURL('image/png')
    const headerHMm = headerEndCanvasPx / pxPerMm
    pdf.addImage(headerImg, 'PNG', 0, 0, pageWidth, headerHMm)

    // Conteúdo da primeira página (após cabeçalho)
    let yOffset = headerEndCanvasPx
    let breakY = findBreakPoint(yOffset, firstPageContentPx)
    let sliceHeight = breakY - yOffset

    if (sliceHeight > 0) {
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceHeight
      const pCtx = pageCanvas.getContext('2d')!
      pCtx.fillStyle = '#ffffff'
      pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      pCtx.drawImage(canvas, 0, yOffset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
      const imgData = pageCanvas.toDataURL('image/png')
      const imgH = sliceHeight / pxPerMm
      pdf.addImage(imgData, 'PNG', 0, headerHMm, pageWidth, imgH)
      yOffset = breakY
    }

    // ===== PÁGINAS SEGUINTES =====
    while (yOffset < canvas.height) {
      pdf.addPage()

      breakY = findBreakPoint(yOffset, usableHeightPx)
      sliceHeight = breakY - yOffset
      if (sliceHeight <= 0) break

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceHeight
      const pCtx = pageCanvas.getContext('2d')!
      pCtx.fillStyle = '#ffffff'
      pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      pCtx.drawImage(canvas, 0, yOffset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

      const imgData = pageCanvas.toDataURL('image/png')
      const imgH = sliceHeight / pxPerMm
      pdf.addImage(imgData, 'PNG', 0, marginTop, pageWidth, imgH)

      yOffset = breakY
    }

    const pdfBlob = pdf.output('blob')
    const url = URL.createObjectURL(pdfBlob)
    win.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 120000)
    document.title = titulo
  } catch {
    win.close()
  } finally {
    document.body.removeChild(container)
  }
}

export function formatTexto(t: string): string {
  return t
    .replace(/\|\|(.*?)\|\|/g, '<div style="text-align:center">$1</div>')
    .replace(/\-\-(.*?)\-\-/g, '<span style="font-size:9pt">$1</span>')
    .replace(/\+\+(.*?)\+\+/g, '<span style="font-size:16pt">$1</span>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

let _logoBase64: string | null = null
async function loadLogoBase64(): Promise<string> {
  if (_logoBase64) return _logoBase64
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d')!.drawImage(img, 0, 0)
      _logoBase64 = c.toDataURL('image/png')
      resolve(_logoBase64)
    }
    img.onerror = () => resolve('')
    img.src = '/imagens/logo_cerof.png'
  })
}

function headerHtml(logoSrc: string): string {
  const logoTag = logoSrc ? `<img class="logo-cerof" src="${logoSrc}" alt="Logo CEROF" />` : '<div></div>'
  return `
    <div class="doc-header">
      ${logoTag}
      <div class="header-brand">
        <h1>NordcsCare</h1>
        <p class="subtitle">Saúde Ocular — Atendimento Oftalmológico</p>
      </div>
    </div>`
}

function pacienteHtml(p: PacientePdf): string {
  const idade = p.data_nascimento ? `${calcIdade(p.data_nascimento)} anos` : ''
  const nascFmt = p.data_nascimento ? new Date(p.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
  const cpfFmt = p.cpf ? p.cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''
  return `
    <div class="paciente-info">
      <p><strong>Paciente:</strong> ${p.nome_completo} ${p.codigo ? `` : ''}</p>
      ${p.data_nascimento ? `<p><strong>Data de nascimento:</strong> ${nascFmt} ${idade ? `(${idade})` : ''}</p>` : ''}
      ${cpfFmt ? `<p><strong>CPF:</strong> ${cpfFmt}</p>` : ''}
      ${p.endereco ? `<p><strong>Endereço:</strong> ${p.endereco}</p>` : ''}
    </div>`
}

function fmtEsf(v: string | number | null | undefined): string {
  if (!v && v !== 0) return '—'
  const n = parseFloat(String(v))
  if (isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2)
}
function fmtCil(v: string | number | null | undefined): string {
  if (!v && v !== 0) return '—'
  const n = parseFloat(String(v))
  if (isNaN(n)) return '—'
  return (n > 0 ? '-' : '') + n.toFixed(2)
}
function fmtEixo(v: string | number | null | undefined): string {
  if (!v && v !== 0) return '—'
  const n = parseInt(String(v), 10)
  if (isNaN(n)) return '—'
  return n + '°'
}

function footerHtml(medico: MedicoPdf): string {
  return `
    <div class="doc-footer">
      <div class="assinatura-line"></div>
      <p class="medico-nome">Dr(a). ${medico.nome}</p>
      ${medico.crm ? `<p class="medico-crm">CRM ${medico.crm}${medico.uf ? ` — ${medico.uf}` : ''}</p>` : ''}
      ${medico.especialidade ? `<p class="medico-crm">${medico.especialidade}</p>` : ''}
      <p class="data">${dataFormatada()}</p>
    </div>`
}

// ===================================================================
// 1. RECEITA OCULAR
// ===================================================================
export async function gerarReceitaOcular(paciente: PacientePdf, rx: PrescricaoPdf, medico: MedicoPdf) {
  const logo = await loadLogoBase64()
  const tipoLabel = rx.tipo === 'lentes_contato' ? 'Lente de Contato' : 'Óculos'
  const body = `
    <div class="doc-container doc-centered">
      ${headerHtml(logo)}
      <div class="doc-content">
      <div class="doc-title">Receita Ocular</div>
      ${pacienteHtml(paciente)}
      <div class="doc-body">
        <p><strong>Tipo:</strong> ${tipoLabel}</p>
        <table class="rx-table">
          <thead><tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th></tr></thead>
          <tbody>
            <tr>
              <td class="eye-label">OD</td>
              <td>${fmtEsf(rx.od_esferico)}</td>
              <td>${fmtCil(rx.od_cilindrico)}</td>
              <td>${fmtEixo(rx.od_eixo)}</td>
            </tr>
            <tr>
              <td class="eye-label">OE</td>
              <td>${fmtEsf(rx.oe_esferico)}</td>
              <td>${fmtCil(rx.oe_cilindrico)}</td>
              <td>${fmtEixo(rx.oe_eixo)}</td>
            </tr>
          </tbody>
        </table>
        ${rx.od_adicao ? `<table class="rx-adicao"><thead><tr><th>Adição</th></tr></thead><tbody><tr><td>${fmtEsf(rx.od_adicao)}</td></tr></tbody></table>` : ''}
        ${rx.dp ? `<p><strong>DP:</strong> ${rx.dp} mm</p>` : ''}
        ${rx.observacoes ? `<p><strong>Observações:</strong> ${rx.observacoes}</p>` : ''}
      </div>
      </div>
      ${footerHtml(medico)}
    </div>`
  await gerarPdfReal(body, `Receita Ocular — ${paciente.nome_completo}`)
}

// ===================================================================
// 2. ATESTADO
// ===================================================================
export async function gerarAtestado(paciente: PacientePdf, texto: string, medico: MedicoPdf) {
  const logo = await loadLogoBase64()
  const body = `
    <div class="doc-container doc-centered">
      ${headerHtml(logo)}
      <div class="doc-content">
      <div class="doc-title">Atestado Médico</div>
      <div class="doc-body">
        <div class="texto-livre">${formatTexto(texto)}</div>
      </div>
      </div>
      ${footerHtml(medico)}
    </div>`
  await gerarPdfReal(body, `Atestado — ${paciente.nome_completo}`)
}

// ===================================================================
// 3. RECEITA MÉDICA
// ===================================================================
export async function gerarReceitaMedica(paciente: PacientePdf, texto: string, medico: MedicoPdf) {
  const logo = await loadLogoBase64()
  const body = `
    <div class="doc-container doc-centered">
      ${headerHtml(logo)}
      <div class="doc-content">
      <div class="doc-title">Receita Médica</div>
      ${pacienteHtml(paciente)}
      <div class="doc-body">
        <div class="texto-livre">${formatTexto(texto)}</div>
      </div>
      </div>
      ${footerHtml(medico)}
    </div>`
  await gerarPdfReal(body, `Receita Médica — ${paciente.nome_completo}`)
}

// ===================================================================
// 4. RELATÓRIO COMPLETO
// ===================================================================
export async function gerarRelatorio(
  paciente: PacientePdf,
  medico: MedicoPdf,
  opts: {
    anamnese?: AnamnesePdf
    exames?: ExamePdf[]
    prescricao?: PrescricaoPdf
    laudo?: LaudoPdf
    acuidade?: AcuidadePdf | null
  }
) {
  const { anamnese, exames, prescricao, laudo, acuidade } = opts

  let sections = ''

  // Acuidade Visual
  if (acuidade) {
    sections += `<div class="section"><h3>Acuidade Visual</h3>`
    sections += `<p><strong>Sem Óculos OD:</strong> ${acuidade.sem_oculos_od || '—'} &nbsp;&nbsp; <strong>OE:</strong> ${acuidade.sem_oculos_oe || '—'}</p>`
    if (acuidade.usa_oculos === 1) {
      sections += `<p><strong>Com Óculos OD:</strong> ${acuidade.com_oculos_od || '—'} &nbsp;&nbsp; <strong>OE:</strong> ${acuidade.com_oculos_oe || '—'}</p>`
    }
    sections += `<p><strong>Usa Óculos:</strong> ${acuidade.usa_oculos === 1 ? 'Sim' : 'Não'} &nbsp;&nbsp; <strong>Dilata:</strong> ${acuidade.dilata === 1 ? 'Sim' : 'Não'}</p>`
    if (acuidade.observacoes) sections += `<p><strong>Obs:</strong> ${acuidade.observacoes}</p>`
    sections += `</div>`
  }

  // Anamnese
  if (anamnese) {
    sections += `<div class="section"><h3>Anamnese</h3>`
    if (anamnese.queixa_principal) sections += `<p><strong>Queixa Principal:</strong> ${anamnese.queixa_principal}</p>`
    if (anamnese.historico_ocular) sections += `<p><strong>Histórico Ocular:</strong> ${anamnese.historico_ocular}</p>`
    if (anamnese.historico_familiar) sections += `<p><strong>Histórico Familiar:</strong> ${anamnese.historico_familiar}</p>`
    if (anamnese.alergias) sections += `<p><strong>Alergias:</strong> ${anamnese.alergias}</p>`
    if (anamnese.medicamentos_em_uso) sections += `<p><strong>Medicamentos:</strong> ${anamnese.medicamentos_em_uso}</p>`
    if (anamnese.cirurgias_anteriores) sections += `<p><strong>Cirurgias Anteriores:</strong> ${anamnese.cirurgias_anteriores}</p>`
    if (anamnese.observacoes) sections += `<p><strong>Obs:</strong> ${anamnese.observacoes}</p>`
    sections += `</div>`
  }

  // Exames
  if (exames && exames.length > 0) {
    sections += `<div class="section"><h3>Exames</h3>`
    exames.forEach(ex => {
      sections += `<p><strong>${tipoExameLabel(ex.tipo_exame)}</strong> — ${ex.olho} ${ex.resultado ? `— ${ex.resultado}` : ''}</p>`
      if (ex.observacoes) sections += `<p style="margin-left:12px;font-size:10pt"><em>Obs: ${ex.observacoes}</em></p>`
    })
    sections += `</div>`
  }

  // Laudo
  if (laudo) {
    sections += `<div class="section"><h3>Diagnóstico e Conduta</h3>`
    if (laudo.diagnostico) sections += `<p><strong>Diagnóstico:</strong> ${formatTexto(laudo.diagnostico)}</p>`
    if (laudo.conduta_inicial) sections += `<p><strong>Conduta Inicial:</strong> ${condutaLabel(laudo.conduta_inicial)}</p>`
    if (laudo.observacoes) sections += `<p><strong>Obs:</strong> ${formatTexto(laudo.observacoes)}</p>`
    sections += `</div>`
  }

  // Prescrição
  if (prescricao && (prescricao.od_esferico || prescricao.oe_esferico)) {
    const tipoLabel = prescricao.tipo === 'lentes_contato' ? 'Lente de Contato' : 'Óculos'
    sections += `<div class="section"><h3>Prescrição (${tipoLabel})</h3>
      <table class="rx-table">
        <thead><tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th></tr></thead>
        <tbody>
          <tr><td class="eye-label">OD</td><td>${fmtEsf(prescricao.od_esferico)}</td><td>${fmtCil(prescricao.od_cilindrico)}</td><td>${fmtEixo(prescricao.od_eixo)}</td></tr>
          <tr><td class="eye-label">OE</td><td>${fmtEsf(prescricao.oe_esferico)}</td><td>${fmtCil(prescricao.oe_cilindrico)}</td><td>${fmtEixo(prescricao.oe_eixo)}</td></tr>
        </tbody>
      </table>
      ${prescricao.od_adicao ? `<table class="rx-adicao"><thead><tr><th>Adição</th></tr></thead><tbody><tr><td>${fmtEsf(prescricao.od_adicao)}</td></tr></tbody></table>` : ''}`
    if (prescricao.dp) sections += `<p><strong>DP:</strong> ${prescricao.dp} mm</p>`
    if (prescricao.observacoes) sections += `<p><strong>Obs:</strong> ${prescricao.observacoes}</p>`
    if (laudo?.conduta_final) sections += `<p><strong>Conduta Final:</strong> ${condutaLabel(laudo.conduta_final)}</p>`
    sections += `</div>`
  }

  const logo = await loadLogoBase64()
  const body = `
    <div class="doc-container">
      ${headerHtml(logo)}
      <div class="doc-title">Relatório do Atendimento</div>
      ${pacienteHtml(paciente)}
      <div class="doc-body">${sections}</div>
      ${footerHtml(medico)}
    </div>`
  await gerarPdfReal(body, `Relatório — ${paciente.nome_completo}`)
}
