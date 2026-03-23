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
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 12pt;
    color: #1a1a1a;
    line-height: 1.5;
    padding: 0;
  }
  .doc-container { max-width: 760px; margin: 0 auto; padding: 10px 20px; }
  
  /* Header */
  .doc-header {
    text-align: center;
    border-bottom: 2px solid #6743a5;
    padding-bottom: 12px;
    margin-bottom: 20px;
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
  .doc-body { margin: 20px 0; min-height: 300px; }
  .doc-body p { margin-bottom: 8px; }
  .doc-body .texto-livre {
    white-space: pre-wrap;
    font-size: 12pt;
    line-height: 1.7;
    padding: 10px 0;
  }
  
  /* Tabela RX */
  .rx-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .rx-table th, .rx-table td {
    border: 1px solid #bbb;
    padding: 8px 12px;
    text-align: center;
    font-size: 11pt;
  }
  .rx-table th { background: #6743a5; color: #fff; font-weight: 600; }
  .rx-table .eye-label { font-weight: 700; background: #eef5f0; width: 60px; }
  
  /* Seções do relatório */
  .section { margin-bottom: 18px; }
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
    body { padding: 0; }
    .no-print { display: none !important; }
  }
`

async function gerarPdfReal(html: string, _titulo: string) {
  // Abre a aba ANTES do await para não ser bloqueado como pop-up
  const win = window.open('', '_blank')
  if (!win) { alert('Permita pop-ups para gerar o documento.'); return }
  win.document.write('<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#555"><p>Gerando PDF...</p></body></html>')

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:0;z-index:-1;'
  container.innerHTML = `<style>${CSS_BASE}</style>${html}`
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    } else {
      let yOffset = 0
      while (yOffset < imgHeight) {
        if (yOffset > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight)
        yOffset += pageHeight
      }
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

function formatTexto(t: string): string {
  return t
    .replace(/\|\|(.*?)\|\|/g, '<div style="text-align:center">$1</div>')
    .replace(/\-\-(.*?)\-\-/g, '<span style="font-size:9pt">$1</span>')
    .replace(/\+\+(.*?)\+\+/g, '<span style="font-size:16pt">$1</span>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
}

function headerHtml(): string {
  return `
    <div class="doc-header">
      <h1>NordcsCare</h1>
      <p class="subtitle">Saúde Ocular — Atendimento Oftalmológico</p>
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
  const tipoLabel = rx.tipo === 'lentes_contato' ? 'Lente de Contato' : 'Óculos'
  const body = `
    <div class="doc-container">
      ${headerHtml()}
      <div class="doc-title">Receita Ocular</div>
      ${pacienteHtml(paciente)}
      <div class="doc-body">
        <p><strong>Tipo:</strong> ${tipoLabel}</p>
        <table class="rx-table">
          <thead><tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>Adição</th></tr></thead>
          <tbody>
            <tr>
              <td class="eye-label">OD</td>
              <td>${fmtEsf(rx.od_esferico)}</td>
              <td>${fmtCil(rx.od_cilindrico)}</td>
              <td>${fmtEixo(rx.od_eixo)}</td>
              <td>${fmtEsf(rx.od_adicao)}</td>
            </tr>
            <tr>
              <td class="eye-label">OE</td>
              <td>${fmtEsf(rx.oe_esferico)}</td>
              <td>${fmtCil(rx.oe_cilindrico)}</td>
              <td>${fmtEixo(rx.oe_eixo)}</td>
              <td>${fmtEsf(rx.oe_adicao)}</td>
            </tr>
          </tbody>
        </table>
        ${rx.dp ? `<p><strong>DP:</strong> ${rx.dp} mm</p>` : ''}
        ${rx.observacoes ? `<p><strong>Observações:</strong> ${rx.observacoes}</p>` : ''}
      </div>
      ${footerHtml(medico)}
    </div>`
  await gerarPdfReal(body, `Receita Ocular — ${paciente.nome_completo}`)
}

// ===================================================================
// 2. ATESTADO
// ===================================================================
export async function gerarAtestado(paciente: PacientePdf, texto: string, medico: MedicoPdf) {
  const body = `
    <div class="doc-container">
      ${headerHtml()}
      <div class="doc-title">Atestado Médico</div>
      <div class="doc-body">
        <div class="texto-livre">${formatTexto(texto)}</div>
      </div>
      ${footerHtml(medico)}
    </div>`
  await gerarPdfReal(body, `Atestado — ${paciente.nome_completo}`)
}

// ===================================================================
// 3. RECEITA MÉDICA
// ===================================================================
export async function gerarReceitaMedica(paciente: PacientePdf, texto: string, medico: MedicoPdf) {
  const body = `
    <div class="doc-container">
      ${headerHtml()}
      <div class="doc-title">Receita Médica</div>
      ${pacienteHtml(paciente)}
      <div class="doc-body">
        <div class="texto-livre">${formatTexto(texto)}</div>
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
    if (laudo.diagnostico) sections += `<p><strong>Diagnóstico:</strong> ${laudo.diagnostico}</p>`
    if (laudo.conduta_inicial) sections += `<p><strong>Conduta Inicial:</strong> ${condutaLabel(laudo.conduta_inicial)}</p>`
    if (laudo.conduta_final) sections += `<p><strong>Conduta Final:</strong> ${condutaLabel(laudo.conduta_final)}</p>`
    if (laudo.observacoes) sections += `<p><strong>Obs:</strong> ${laudo.observacoes}</p>`
    sections += `</div>`
  }

  // Prescrição
  if (prescricao && (prescricao.od_esferico || prescricao.oe_esferico)) {
    const tipoLabel = prescricao.tipo === 'lentes_contato' ? 'Lente de Contato' : 'Óculos'
    sections += `<div class="section"><h3>Prescrição (${tipoLabel})</h3>
      <table class="rx-table">
        <thead><tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>Adição</th></tr></thead>
        <tbody>
          <tr><td class="eye-label">OD</td><td>${fmtEsf(prescricao.od_esferico)}</td><td>${fmtCil(prescricao.od_cilindrico)}</td><td>${fmtEixo(prescricao.od_eixo)}</td><td>${fmtEsf(prescricao.od_adicao)}</td></tr>
          <tr><td class="eye-label">OE</td><td>${fmtEsf(prescricao.oe_esferico)}</td><td>${fmtCil(prescricao.oe_cilindrico)}</td><td>${fmtEixo(prescricao.oe_eixo)}</td><td>${fmtEsf(prescricao.oe_adicao)}</td></tr>
        </tbody>
      </table>`
    if (prescricao.dp) sections += `<p><strong>DP:</strong> ${prescricao.dp} mm</p>`
    if (prescricao.observacoes) sections += `<p><strong>Obs:</strong> ${prescricao.observacoes}</p>`
    sections += `</div>`
  }

  const body = `
    <div class="doc-container">
      ${headerHtml()}
      <div class="doc-title">Relatório do Atendimento</div>
      ${pacienteHtml(paciente)}
      <div class="doc-body">${sections}</div>
      ${footerHtml(medico)}
    </div>`
  await gerarPdfReal(body, `Relatório — ${paciente.nome_completo}`)
}
