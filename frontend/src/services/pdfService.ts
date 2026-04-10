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
    color: #222;
    line-height: 1.6;
    padding: 0;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc-container { max-width: 760px; margin: 0 auto; padding: 10px 24px; }
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

  /* ===== Header ===== */
  .doc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    margin-bottom: 6px;
    border-bottom: 3px solid #6743a5;
  }
  .doc-header .logo-cerof {
    max-height: 72px;
  }
  .doc-header .logo-care {
    max-height: 48px;
  }
  .doc-header .header-brand {
    text-align: right;
  }
  .doc-header h1 {
    font-size: 20pt;
    font-weight: 800;
    color: #6743a5;
    margin-bottom: 2px;
    letter-spacing: 1.5px;
  }
  .doc-header .subtitle {
    font-size: 9.5pt;
    color: #666;
    letter-spacing: 0.5px;
  }

  /* ===== Título do documento ===== */
  .doc-title {
    text-align: center;
    font-size: 15pt;
    font-weight: 700;
    color: #6743a5;
    margin: 28px 0 8px;
    text-transform: uppercase;
    letter-spacing: 3px;
  }
  .doc-title-line {
    width: 60px;
    height: 3px;
    background: linear-gradient(90deg, #6743a5, #9b6dff);
    margin: 0 auto 20px;
    border-radius: 2px;
  }

  /* ===== Paciente info ===== */
  .paciente-info {
    background: #faf8ff;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 22px;
    font-size: 10.5pt;
    border-left: 4px solid #6743a5;
    border: 1px solid #e8e0f3;
    border-left: 4px solid #6743a5;
  }
  .paciente-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 24px;
  }
  .paciente-info-grid .info-full {
    grid-column: 1 / -1;
  }
  .paciente-info p { margin-bottom: 3px; color: #333; }
  .paciente-info strong {
    color: #6743a5;
    font-weight: 600;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: block;
    margin-bottom: 1px;
  }
  .paciente-info .info-value {
    font-size: 11pt;
    color: #222;
    font-weight: 500;
  }

  /* ===== Conteúdo genérico ===== */
  .doc-body { margin: 20px 0; }
  .doc-body p { margin-bottom: 8px; }
  .doc-body .texto-livre {
    white-space: pre-wrap;
    font-size: 12pt;
    line-height: 1.8;
    padding: 16px 20px;
    background: #fdfcff;
    border-radius: 8px;
    border: 1px solid #ece6f5;
  }

  /* ===== Info line (Tipo, DP, etc.) ===== */
  .doc-info-line {
    display: flex;
    gap: 32px;
    margin-bottom: 12px;
    padding: 8px 0;
  }
  .doc-info-line .info-item strong {
    color: #6743a5;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: block;
    margin-bottom: 2px;
    font-weight: 600;
  }
  .doc-info-line .info-item span {
    font-size: 11pt;
    font-weight: 500;
    color: #222;
  }

  /* ===== Tabela RX ===== */
  .rx-table {
    width: 85%;
    margin: 20px auto;
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #d4c8ef;
  }
  .rx-table th {
    background: #6743a5;
    color: #fff;
    font-weight: 600;
    padding: 10px 16px;
    text-align: center;
    font-size: 9.5pt;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }
  .rx-table th:first-child {
    background: #5a3a94;
  }
  .rx-table td {
    padding: 12px 16px;
    text-align: center;
    font-size: 12pt;
    font-weight: 500;
    color: #222;
    background: #fff;
  }
  .rx-table tbody tr:not(:last-child) td {
    border-bottom: 1px solid #ece6f5;
  }
  .rx-table .eye-label {
    font-weight: 800;
    background: #f5f1fc;
    color: #6743a5;
    width: 60px;
    font-size: 13pt;
    letter-spacing: 1px;
    border-right: 1px solid #ece6f5;
  }

  .rx-adicao {
    width: 28%;
    margin: 8px auto 20px;
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #d4c8ef;
  }
  .rx-adicao th {
    background: #6743a5;
    color: #fff;
    font-weight: 600;
    padding: 6px 14px;
    text-align: center;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .rx-adicao td {
    padding: 8px 14px;
    text-align: center;
    font-size: 12pt;
    font-weight: 600;
    background: #fff;
    color: #222;
  }

  /* ===== Tabelas RX para impressão P&B ===== */
  .rx-table.rx-print th {
    background: transparent;
    color: #222;
    font-weight: 700;
    border: 1.5px solid #333;
  }
  .rx-table.rx-print th:first-child {
    background: transparent;
  }
  .rx-table.rx-print td {
    border: 1.5px solid #333;
    background: transparent;
  }
  .rx-table.rx-print .eye-label {
    background: transparent;
    color: #222;
    font-weight: 800;
    border-right: 1.5px solid #333;
  }
  .rx-table.rx-print {
    border: 1.5px solid #333;
  }
  .rx-adicao.rx-print th {
    background: transparent;
    color: #222;
    font-weight: 700;
    border: 1.5px solid #333;
  }
  .rx-adicao.rx-print td {
    border: 1.5px solid #333;
    background: transparent;
  }
  .rx-adicao.rx-print {
    border: 1.5px solid #333;
  }

  /* ===== Tipo de Lente abaixo das tabelas ===== */
  .rx-tipo-lente {
    text-align: left;
    margin: 16px auto 0;
    font-size: 11pt;
  }
  .rx-tipo-lente strong {
    color: #333;
    font-weight: 700;
  }
  .rx-tipo-lente span {
    font-weight: 500;
    color: #222;
  }

  /* ===== Seções do relatório ===== */
  .section {
    margin-bottom: 20px;
    page-break-inside: avoid;
    break-inside: avoid;
    padding: 14px 16px;
    background: #fdfcff;
    border-radius: 8px;
    border: 1px solid #ece6f5;
  }
  .section h3 {
    font-size: 11pt;
    font-weight: 700;
    color: #6743a5;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding-bottom: 6px;
    margin-bottom: 10px;
    border-bottom: 2px solid #e8e0f3;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section h3::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 16px;
    background: #6743a5;
    border-radius: 2px;
  }
  .section p {
    font-size: 10.5pt;
    margin-bottom: 5px;
    line-height: 1.6;
  }
  .section p strong {
    color: #444;
    font-weight: 600;
  }

  /* ===== Rodapé / Assinatura ===== */
  .doc-footer {
    margin-top: 50px;
    text-align: center;
    padding-top: 10px;
  }
  .doc-footer .assinatura-block {
    display: inline-block;
    text-align: center;
    margin-top: 30px;
  }
  .doc-footer .assinatura-line {
    width: 280px;
    border-top: 2px solid #6743a5;
    margin: 0 auto 10px;
  }
  .doc-footer .medico-nome {
    font-weight: 700;
    font-size: 12pt;
    color: #222;
  }
  .doc-footer .medico-crm {
    font-size: 9.5pt;
    color: #666;
    margin-top: 2px;
  }
  .doc-footer .data {
    margin-top: 20px;
    font-size: 9.5pt;
    color: #888;
    letter-spacing: 0.3px;
  }
  .doc-footer .footer-line {
    width: 100%;
    height: 1px;
    background: #e0d6f0;
    margin-top: 16px;
  }
  .doc-footer .footer-brand {
    font-size: 7.5pt;
    color: #bbb;
    margin-top: 8px;
    letter-spacing: 0.5px;
  }

  @media print {
    body { padding: 0; margin: 0; }
    .no-print { display: none !important; }
  }
`

async function gerarPdfReal(html: string, titulo: string) {
  const win = window.open('', '_blank')
  if (!win) { alert('Permita pop-ups para gerar o documento.'); return }

  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
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
    <p class="loader-text">Gerando documento...</p>
    <p class="loader-sub">${titulo}</p>
    <div class="pulse-bar"></div>
  </div>
</body></html>`)

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
let _logoCareBase64: string | null = null

function loadImageBase64(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d')!.drawImage(img, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve('')
    img.src = src
  })
}

async function loadLogoBase64(): Promise<string> {
  if (_logoBase64) return _logoBase64
  _logoBase64 = await loadImageBase64('/imagens/logo_cerof.png')
  return _logoBase64
}

async function loadLogoCareBase64(): Promise<string> {
  if (_logoCareBase64) return _logoCareBase64
  _logoCareBase64 = await loadImageBase64('/imagens/logo_care.png')
  return _logoCareBase64
}

function headerHtml(logoSrc: string, logoCareSrc?: string): string {
  const logoTag = logoSrc ? `<img class="logo-cerof" src="${logoSrc}" alt="Logo CEROF" />` : '<div></div>'
  const logoCareTag = logoCareSrc ? `<img class="logo-care" src="${logoCareSrc}" alt="Logo Care" />` : `<div class="header-brand"><h1>NordcsCare</h1><p class="subtitle">Saúde Ocular — Atendimento Oftalmológico</p></div>`
  return `
    <div class="doc-header">
      ${logoTag}
      ${logoCareTag}
    </div>`
}

function titleHtml(title: string): string {
  return `
    <div class="doc-title">${title}</div>
    <div class="doc-title-line"></div>`
}

function pacienteHtml(p: PacientePdf): string {
  const idade = p.data_nascimento ? `${calcIdade(p.data_nascimento)} anos` : ''
  const nascFmt = p.data_nascimento ? new Date(p.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
  const cpfFmt = p.cpf ? p.cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''
  return `
    <div class="paciente-info">
      <div class="paciente-info-grid">
        <div class="info-full"><strong>Paciente</strong><span class="info-value">${p.nome_completo}</span></div>
        ${p.data_nascimento ? `<div><strong>Nascimento</strong><span class="info-value">${nascFmt} ${idade ? `(${idade})` : ''}</span></div>` : ''}
        ${cpfFmt ? `<div><strong>CPF</strong><span class="info-value">${cpfFmt}</span></div>` : ''}
        ${p.endereco ? `<div class="info-full"><strong>Endereço</strong><span class="info-value">${p.endereco}</span></div>` : ''}
      </div>
    </div>`
}

function fmtEsf(v: string | number | null | undefined): string {
  if (!v && v !== 0) return '—'
  const s = String(v).trim().toLowerCase()
  if (s === 'plano' || s === 'pl' || s === 'contra peso') return s
  const n = parseFloat(s)
  if (isNaN(n)) return String(v).trim()
  const formatted = n.toFixed(2)
  return (n > 0 && !formatted.startsWith('+')) ? '+' + formatted : formatted
}
function fmtCil(v: string | number | null | undefined): string {
  if (!v && v !== 0) return '—'
  const s = String(v).trim().toLowerCase()
  if (s === 'plano' || s === 'pl') return s
  const n = parseFloat(s)
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
      <div class="assinatura-block">
        <div class="assinatura-line"></div>
        <p class="medico-nome">Dr(a). ${medico.nome}</p>
        ${medico.crm ? `<p class="medico-crm">CRM ${medico.crm}${medico.uf ? ` — ${medico.uf}` : ''}</p>` : ''}
        ${medico.especialidade ? `<p class="medico-crm">${medico.especialidade}</p>` : ''}
      </div>
      <p class="data">Goiânia, ${dataFormatada()}</p>
      <div class="footer-line"></div>
      <p class="footer-brand">NordcsCare — Sistema de Saúde Ocular</p>
    </div>`
}

// ===================================================================
// 1. RECEITA OCULAR
// ===================================================================
export async function gerarReceitaOcular(paciente: PacientePdf, rx: PrescricaoPdf, medico: MedicoPdf) {
  const logo = await loadLogoBase64()
  const logoCare = await loadLogoCareBase64()
  const tipoLabel = rx.tipo === 'lentes_contato' ? 'Lente de Contato' : 'Óculos'
  const body = `
    <div class="doc-container doc-centered">
      ${headerHtml(logo, logoCare)}
      <div class="doc-content">
      ${titleHtml('Receita Ocular')}
      ${pacienteHtml(paciente)}
      <div class="doc-body">
        <div class="doc-info-line">
          <div class="info-item"><strong>Tipo</strong><span>${tipoLabel}</span></div>
          ${rx.dp ? `<div class="info-item"><strong>DP</strong><span>${rx.dp} mm</span></div>` : ''}
        </div>
        <table class="rx-table rx-print">
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
        ${rx.od_adicao ? `<table class="rx-adicao rx-print"><thead><tr><th>Adição</th></tr></thead><tbody><tr><td>${fmtEsf(rx.od_adicao)}</td></tr></tbody></table>` : ''}
        ${rx.observacoes ? `<div class="rx-tipo-lente"><strong>Tipo de Lente:</strong> <span>${rx.observacoes}</span></div>` : ''}
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
  const logoCare = await loadLogoCareBase64()
  const body = `
    <div class="doc-container doc-centered">
      ${headerHtml(logo, logoCare)}
      <div class="doc-content">
      ${titleHtml('Atestado Médico')}
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
  const logoCare = await loadLogoCareBase64()
  const body = `
    <div class="doc-container doc-centered">
      ${headerHtml(logo, logoCare)}
      <div class="doc-content">
      ${titleHtml('Receita Médica')}
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
    spotVisionImage?: string
  }
) {
  const { anamnese, exames, prescricao, laudo, acuidade, spotVisionImage } = opts

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
    exames.filter(ex => ex.tipo_exame !== 'tonometria').forEach(ex => {
      sections += `<p><strong>${tipoExameLabel(ex.tipo_exame)}</strong> — ${ex.olho} ${ex.resultado ? `— ${ex.resultado}` : ''}</p>`
      if (ex.observacoes) sections += `<p style="margin-left:12px;font-size:10pt"><em>Obs: ${ex.observacoes}</em></p>`
    })
    const tonoOD = exames.find(ex => ex.tipo_exame === 'tonometria' && ex.olho === 'OD')
    const tonoOE = exames.find(ex => ex.tipo_exame === 'tonometria' && ex.olho === 'OE')
    if (tonoOD || tonoOE) {
      sections += `<p><strong>Tonometria</strong>${tonoOD?.resultado ? ` — OD: ${tonoOD.resultado} mmHg` : ''}${tonoOE?.resultado ? ` / OE: ${tonoOE.resultado} mmHg` : ''}</p>`
    }
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

  // Exames por Equipamento (SpotVision, Retinografia)
  if (spotVisionImage) {
    sections += `<div class="section"><h3>Exames por Equipamento</h3>`
    sections += `<p><strong>SpotVision</strong></p>`
    sections += `<div style="text-align:center;margin:8px 0"><img src="${spotVisionImage}" style="max-width:100%;border:1px solid #ddd;border-radius:4px" /></div>`
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
  const logoCare = await loadLogoCareBase64()
  const body = `
    <div class="doc-container">
      ${headerHtml(logo, logoCare)}
      ${titleHtml('Relatório do Atendimento')}
      ${pacienteHtml(paciente)}
      <div class="doc-body">${sections}</div>
      ${footerHtml(medico)}
    </div>`
  await gerarPdfReal(body, `Relatório — ${paciente.nome_completo}`)
}
