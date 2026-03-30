import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { User, X, Pencil, ClipboardList, Bus, Save, FileText, Microscope, Glasses, CheckCircle2, BookOpen, Eye, Trash2, Printer } from 'lucide-react'
import { gerarReceitaOcular, gerarAtestado, gerarReceitaMedica, gerarRelatorio, formatTexto } from '../../services/pdfService'
// import RedCheckExames from './RedCheckUpload'
import './Prontuario.css'

interface Paciente {
  id: number
  codigo: string
  nome_completo: string
  cpf: string
  data_nascimento: string
  sexo: string
  telefone: string
  email: string
  endereco: string
  convenio: string
  numero_convenio: string
  responsavel: string
  observacoes: string
  created_at: string
}

interface Anamnese {
  id: number; queixa_principal: string; historico_ocular: string; historico_familiar: string
  alergias: string; medicamentos_em_uso: string; cirurgias_anteriores: string
  observacoes: string; medico_nome: string; medico_role?: string; created_at: string
}

interface Exame {
  id: number; tipo_exame: string; olho: string; resultado: string
  observacoes: string; medico_nome: string; medico_role?: string; created_at: string
}

interface Prescricao {
  id: number; tipo: string
  od_esferico: string; od_cilindrico: string; od_eixo: string; od_adicao: string
  oe_esferico: string; oe_cilindrico: string; oe_eixo: string; oe_adicao: string
  dp: string; acuidade_od: string; acuidade_oe: string; observacoes: string; medico_nome: string; medico_role?: string; created_at: string
}

interface Laudo {
  id: number; diagnostico: string; conduta_inicial: string; conduta_final: string
  observacoes: string; especialidade: string; medico_nome: string; medico_role?: string; created_at: string
}

interface AcuidadeVisual {
  id: number
  sem_oculos_od: string | null
  sem_oculos_oe: string | null
  usa_oculos: number
  com_oculos_od: string | null
  com_oculos_oe: string | null
  dilata: number
  observacoes: string | null
  medico_nome: string | null
  medico_role?: string | null
  created_at: string
}

interface ProntuarioData {
  paciente: Paciente
  anamneses: Anamnese[]
  exames: Exame[]
  prescricoes: Prescricao[]
  laudos: Laudo[]
  acuidade_visual: AcuidadeVisual | null
}

interface ModeloLaudo {
  id: number; nome: string; autor_nome: string; autor_role?: string
  dados: {
    anamnese: {
      queixa_principal: string; historico_ocular: string; historico_familiar: string
      alergias: string; medicamentos_em_uso: string; cirurgias_anteriores: string; observacoes: string
    }
    laudo: {
      diagnostico: string; conduta_inicial: string; conduta_final: string; observacoes: string; especialidade: string
    }
  } | null
}

interface LaudoPronto {
  id: number; titulo: string; diagnostico: string; conduta: string | null; observacoes: string | null; especialidade: string | null
}

const TIPOS_EXAME = [
  { value: 'acuidade_visual', label: 'Acuidade Visual' },
  { value: 'refracao', label: 'Refração' },
  { value: 'tonometria', label: 'Tonometria' },
  { value: 'spot_vision', label: 'Spot Vision' },
  { value: 'eyer', label: 'Eyer' },
  { value: 'retinografia', label: 'Retinografia' },
  { value: 'outro', label: 'Outro' },
]

const ACUIDADE_OPTIONS = [
  '20/200', '20/150', '20/100', '20/80', '20/70', '20/60', '20/50', '20/40',
  '20/30', '20/25', '20/20',
]

const CONDUTAS_INICIAIS = [
  { value: 'alta', label: 'Alta' },
  { value: 'onibus', label: 'Ônibus' },
  { value: 'encaminhamento', label: 'Encaminhamento ao CEROF' },
  { value: 'onibus_encaminhamento', label: 'Ônibus + Encaminhamento' },
]

const CONDUTAS_FINAIS = [
  { value: 'alta', label: 'Alta' },
  { value: 'encaminhamento', label: 'Encaminhamento ao CEROF' },
]

const emptyForm = {
  anamnese: {
    queixa_principal: '', historico_ocular: '', historico_familiar: '',
    alergias: '', medicamentos_em_uso: '', cirurgias_anteriores: '', historico_pessoal: '', observacoes: '',
  },
  exames_observacoes: '',
  tonometria_od: '',
  tonometria_oe: '',
  prescricao: {
    tipo: 'oculos',
    od_esferico: '', od_cilindrico: '', od_eixo: '', od_adicao: '',
    oe_esferico: '', oe_cilindrico: '', oe_eixo: '', oe_adicao: '',
    dp: '', acuidade_od: '', acuidade_oe: '', observacoes: '',
  },
  laudo: { diagnostico: '', conduta_inicial: '', conduta_final: '', observacoes: '', especialidade: '' },
  acuidade: {
    sem_oculos_od: '', sem_oculos_oe: '', usa_oculos: false,
    com_oculos_od: '', com_oculos_oe: '', dilata: false, observacoes: '',
  },
}

export default function Prontuario() {
  const { pacienteId } = useParams<{ pacienteId: string }>()
  const { user } = useAuth()
  const [data, setData] = useState<ProntuarioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState<'laudos' | 'onibus' | 'acuidade' | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set())
  const [form, setForm] = useState(structuredClone(emptyForm))
  const [modelos, setModelos] = useState<ModeloLaudo[]>([])
  const [showSalvarModelo, setShowSalvarModelo] = useState(false)
  const [nomeModelo, setNomeModelo] = useState('')
  const [medicoInfo, setMedicoInfo] = useState<{ nome: string; crm?: string; uf?: string; especialidade?: string }>({ nome: user?.nome || '' })
  const [pdfModal, setPdfModal] = useState<'atestado' | 'receita_medica' | null>(null)
  const [pdfTexto, setPdfTexto] = useState('')
  const [modelosDoc, setModelosDoc] = useState<{ id: number; tipo: string; nome: string; conteudo: string }[]>([])
  const [laudosProntos, setLaudosProntos] = useState<LaudoPronto[]>([])

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 3000)
      return () => clearTimeout(t)
    }
  }, [successMsg])

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(''), 5000)
      return () => clearTimeout(t)
    }
  }, [errorMsg])

  useEffect(() => {
    if (fieldErrors.size > 0) {
      const t = setTimeout(() => setFieldErrors(new Set()), 3000)
      return () => clearTimeout(t)
    }
  }, [fieldErrors])

  // Helpers: montar form a partir de dados existentes
  function buildFormFromExisting(d: ProntuarioData) {
    const f = structuredClone(emptyForm)
    if (d.anamneses.length > 0) {
      const a = d.anamneses[0]
      f.anamnese = {
        queixa_principal: a.queixa_principal || '',
        historico_ocular: a.historico_ocular || '',
        historico_familiar: a.historico_familiar || '',
        alergias: a.alergias || '',
        medicamentos_em_uso: a.medicamentos_em_uso || '',
        cirurgias_anteriores: a.cirurgias_anteriores || '',
        historico_pessoal: a.historico_pessoal || '',
        observacoes: a.observacoes || '',
      }
    }
    if (d.laudos.length > 0) {
      const l = d.laudos[0]
      f.laudo.diagnostico = l.diagnostico || ''
      f.laudo.conduta_inicial = l.conduta_inicial || ''
      f.laudo.conduta_final = l.conduta_final || ''
      f.laudo.observacoes = l.observacoes || ''
      f.laudo.especialidade = l.especialidade || ''
    }
    if (d.prescricoes.length > 0) {
      const p = d.prescricoes[0]
      const fmtEsf = (v: any) => { if (!v && v !== 0) return ''; const s = String(v).trim().toLowerCase(); if (s === 'plano' || s === 'pl') return s; const n = parseFloat(v); return isNaN(n) ? '' : n.toFixed(2) }
      const fmtCil = (v: any) => { if (!v && v !== 0) return ''; const s = String(v).trim().toLowerCase(); if (s === 'plano' || s === 'pl') return s; const n = parseFloat(v); return isNaN(n) ? '' : (n > 0 ? '-' : '') + n.toFixed(2) }
      const fmtEixo = (v: any) => { if (!v && v !== 0) return ''; const n = parseInt(v, 10); return isNaN(n) ? '' : n + '°' }
      f.prescricao = {
        tipo: p.tipo || 'oculos',
        od_esferico: fmtEsf(p.od_esferico),
        od_cilindrico: fmtCil(p.od_cilindrico),
        od_eixo: fmtEixo(p.od_eixo),
        od_adicao: fmtEsf(p.od_adicao),
        oe_esferico: fmtEsf(p.oe_esferico),
        oe_cilindrico: fmtCil(p.oe_cilindrico),
        oe_eixo: fmtEixo(p.oe_eixo),
        oe_adicao: fmtEsf(p.oe_adicao),
        dp: p.dp || '',
        acuidade_od: p.acuidade_od || '',
        acuidade_oe: p.acuidade_oe || '',
        observacoes: p.observacoes || 'Monofocal para longe',
      }
    }
    if (d.acuidade_visual) {
      const a = d.acuidade_visual
      f.acuidade = {
        sem_oculos_od: a.sem_oculos_od || '',
        sem_oculos_oe: a.sem_oculos_oe || '',
        usa_oculos: a.usa_oculos === 1,
        com_oculos_od: a.com_oculos_od || '',
        com_oculos_oe: a.com_oculos_oe || '',
        dilata: a.dilata === 1,
        observacoes: a.observacoes || '',
      }
    }
    const tonoOD = d.exames?.find((ex: any) => ex.tipo_exame === 'tonometria' && ex.olho === 'OD')
    const tonoOE = d.exames?.find((ex: any) => ex.tipo_exame === 'tonometria' && ex.olho === 'OE')
    if (tonoOD) f.tonometria_od = tonoOD.resultado || ''
    if (tonoOE) f.tonometria_oe = tonoOE.resultado || ''
    return f
  }

  function openEstacao(estacao: 'laudos' | 'onibus' | 'acuidade') {
    if (showForm === estacao) {
      setShowForm(null)
      setForm(structuredClone(emptyForm))
      return
    }
    // Se já tem dados, preencher o form para edição
    if (data) {
      const f = buildFormFromExisting(data)
      setForm(f)
    } else {
      setForm(structuredClone(emptyForm))
    }
    setShowForm(estacao)
  }

  async function loadModelosDoc() {
    try { const r = await api.get('/modelos-documentos'); setModelosDoc(r.data) } catch { /* ignore */ }
  }

  async function loadLaudosProntos() {
    try { const r = await api.get('/laudos-prontos/ativos'); setLaudosProntos(r.data) } catch { /* ignore */ }
  }

  useEffect(() => { loadProntuario(); loadModelos(); loadMedicoPerfil(); loadModelosDoc(); loadLaudosProntos() }, [pacienteId])

  async function loadMedicoPerfil() {
    try {
      const { data: m } = await api.get('/medicos/perfil')
      setMedicoInfo(m)
    } catch { setMedicoInfo({ nome: user?.nome || '' }) }
  }

  async function loadModelos() {
    try {
      const { data: m } = await api.get('/modelos-laudos')
      setModelos(m)
    } catch { /* ignore */ }
  }

  async function loadProntuario() {
    try {
      setLoading(true)
      const { data: d } = await api.get(`/prontuario/${pacienteId}`)
      setData(d)
    } catch { /* interceptor */ } finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const campos: string[] = []
    if (showForm === 'laudos') {
      if (!form.anamnese.queixa_principal.trim()) campos.push('anamnese_queixa_principal')
      if (!form.anamnese.historico_ocular.trim()) campos.push('anamnese_historico_ocular')
      if (!form.anamnese.historico_familiar.trim()) campos.push('anamnese_historico_familiar')
      if (!form.anamnese.alergias.trim()) campos.push('anamnese_alergias')
      if (!form.anamnese.medicamentos_em_uso.trim()) campos.push('anamnese_medicamentos')
      if (!form.anamnese.cirurgias_anteriores.trim()) campos.push('anamnese_cirurgias')
      if (!form.anamnese.historico_pessoal.trim()) campos.push('anamnese_historico_pessoal')
      if (!form.laudo.diagnostico.trim()) campos.push('laudo_diagnostico')
    }
    if (showForm === 'onibus') {
      if (!form.prescricao.observacoes.trim()) campos.push('tipo_lente')
      if (!form.prescricao.acuidade_od.trim()) campos.push('acuidade_od')
      if (!form.prescricao.acuidade_oe.trim()) campos.push('acuidade_oe')
    }
    if (campos.length > 0) {
      setFieldErrors(new Set(campos))
      setErrorMsg('Preencha todos os campos obrigatórios destacados.')
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      // Enviar apenas os dados da estação ativa para evitar interferência entre seções
      let payload: Record<string, any> = {}
      if (showForm === 'laudos') {
        payload.anamnese = form.anamnese
        payload.laudo = form.laudo
        payload.tonometria_od = form.tonometria_od
        payload.tonometria_oe = form.tonometria_oe
      } else if (showForm === 'onibus') {
        const rx = { ...form.prescricao }
        payload.prescricao = rx
        payload.laudo = form.laudo
      } else if (showForm === 'acuidade') {
        const ac = { ...form.acuidade }
        if (ac.sem_oculos_od === '__outro__') ac.sem_oculos_od = ''
        if (ac.sem_oculos_oe === '__outro__') ac.sem_oculos_oe = ''
        if (ac.com_oculos_od === '__outro__') ac.com_oculos_od = ''
        if (ac.com_oculos_oe === '__outro__') ac.com_oculos_oe = ''
        payload.acuidade = ac
      }
      await api.post(`/prontuario/${pacienteId}/atendimento`, payload)
      setForm(structuredClone(emptyForm))
      setShowForm(null)
      setSuccessMsg('Atendimento salvo com sucesso!')
      setTimeout(() => setSuccessMsg(''), 4000)
      loadProntuario()
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erro ao salvar o atendimento. Tente novamente.'
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(''), 6000)
    } finally { setSaving(false) }
  }

  function updateAnamnese(field: string, value: string) {
    setForm(f => ({ ...f, anamnese: { ...f.anamnese, [field]: value } }))
  }

  function updateExamesObservacoes(value: string) {
    setForm(f => ({ ...f, exames_observacoes: value }))
  }

  function updatePrescricao(field: string, value: string) {
    if (field.includes('esferico') || field.includes('adicao')) {
      const lower = value.toLowerCase().replace(/[^a-z]/g, '')
      if (lower && 'plano'.startsWith(lower)) {
        value = lower
      } else {
        const sign = value.startsWith('-') ? '-' : value.startsWith('+') ? '+' : ''
        let nums = value.replace(/[^0-9]/g, '').slice(0, 3)
        if (nums.length >= 2) {
          nums = nums.slice(0, -2) + '.' + nums.slice(-2)
        }
        value = nums ? sign + nums : sign || ''
      }
    } else if (field.includes('cilindrico')) {
      const lower = value.toLowerCase().replace(/[^a-z]/g, '')
      if (lower && 'plano'.startsWith(lower)) {
        value = lower
      } else {
        let nums = value.replace(/[^0-9]/g, '').slice(0, 3)
        if (nums.length >= 2) {
          nums = nums.slice(0, -2) + '.' + nums.slice(-2)
        }
        value = nums ? '-' + nums : ''
      }
    } else if (field.includes('eixo')) {
      const nums = value.replace(/[^0-9]/g, '').slice(0, 3)
      value = nums ? nums + '°' : ''
    }
    setForm(f => ({ ...f, prescricao: { ...f.prescricao, [field]: value } }))
  }

  function updateLaudo(field: string, value: string) {
    setForm(f => ({ ...f, laudo: { ...f.laudo, [field]: value } }))
  }

  function updateAcuidade(field: string, value: string | boolean) {
    setForm(f => ({ ...f, acuidade: { ...f.acuidade, [field]: value } }))
  }

  function aplicarModelo(modeloId: string) {
    if (!modeloId) return
    const m = modelos.find(x => x.id === Number(modeloId))
    if (!m || !m.dados) return
    setForm(f => ({
      ...f,
      anamnese: { ...structuredClone(emptyForm.anamnese), ...m.dados!.anamnese },
      laudo: { ...structuredClone(emptyForm.laudo), ...m.dados!.laudo },
    }))
  }

  async function salvarModelo() {
    const nome = nomeModelo.trim()
    if (!nome) return
    try {
      await api.post('/modelos-laudos', {
        nome,
        dados: {
          anamnese: form.anamnese,
          laudo: { diagnostico: form.laudo.diagnostico, conduta_inicial: form.laudo.conduta_inicial, observacoes: form.laudo.observacoes },
        },
      })
      setNomeModelo('')
      setShowSalvarModelo(false)
      setSuccessMsg('Modelo salvo com sucesso!')
      setTimeout(() => setSuccessMsg(''), 4000)
      loadModelos()
    } catch { /* interceptor */ }
  }

  async function excluirModelo(id: number) {
    if (!confirm('Excluir este modelo de laudo?')) return
    try {
      await api.delete(`/modelos-laudos/${id}`)
      loadModelos()
    } catch { /* interceptor */ }
  }

  if (loading) return <div className="loading">Carregando prontuário...</div>
  if (!data) return <div className="loading">Paciente não encontrado</div>

  const { paciente, anamneses, exames, prescricoes, laudos } = data
  const hasLaudo = laudos.length > 0 || anamneses.length > 0 || exames.length > 0
  const hasPrescricao = prescricoes.length > 0

  function calcAge(dateStr: string): number {
    const birth = new Date(dateStr)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  function tipoExameLabel(val: string) {
    return TIPOS_EXAME.find(t => t.value === val)?.label ?? val
  }

  function condutaInicialLabel(val: string) {
    return CONDUTAS_INICIAIS.find(c => c.value === val)?.label ?? val
  }

  function condutaFinalLabel(val: string) {
    return CONDUTAS_FINAIS.find(c => c.value === val)?.label ?? val
  }

  function condutaColor(val: string) {
    switch (val) {
      case 'alta': return '#38a169'
      case 'onibus': return '#3182ce'
      case 'encaminhamento': return '#d69e2e'
      case 'onibus_encaminhamento': return '#805ad5'
      default: return '#718096'
    }
  }

  function rolePrefix(role?: string | null) {
    switch (role) {
      case 'medico': return 'Dr(a).'
      case 'administrativo': return 'Assist.'
      case 'admin': return 'Adm.'
      default: return ''
    }
  }

  return (
    <div className="prontuario-page">
      {/* ===== HEADER ===== */}
      <div className="page-header">
        <div>
          <h1>Prontuário Ambulatorial</h1>
          <p className="paciente-meta">
            <span className="meta-codigo">#{paciente.codigo}</span>
            <span style={{color:'var(--text-secondary)',fontSize:'0.88rem'}}>{paciente.nome_completo}</span>
          </p>
        </div>
        <Link to="/pacientes" className="btn btn-secondary">← Voltar</Link>
      </div>

      {/* ===== DADOS DO PACIENTE ===== */}
      <div className="section-card">
        <h2 className="section-title"><User size={16} />Dados do Paciente</h2>
        <div className="info-grid">
          <div><strong>Nome</strong> {paciente.nome_completo}</div>
          <div><strong>CPF</strong> {paciente.cpf || '—'}</div>
          <div><strong>Nascimento</strong> {paciente.data_nascimento ? `${new Date(paciente.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')} (${calcAge(paciente.data_nascimento)} anos)` : '—'}</div>
          <div><strong>Sexo</strong> {paciente.sexo ? (paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Feminino' : 'Outro') : '—'}</div>
          <div><strong>Telefone</strong> {paciente.telefone || '—'}</div>
          <div><strong>Email</strong> {paciente.email || '—'}</div>
          <div><strong>Endereço</strong> {paciente.endereco || '—'}</div>
          <div><strong>Convênio</strong> {paciente.convenio || '—'} {paciente.numero_convenio ? `(${paciente.numero_convenio})` : ''}</div>
          {paciente.responsavel && <div><strong>Responsável</strong> {paciente.responsavel}</div>}
          {paciente.observacoes && <div style={{whiteSpace:'normal'}}><strong>Observações</strong> {paciente.observacoes}</div>}
        </div>
      </div>

      {/* ===== MENSAGENS ===== */}
      {successMsg && (
        <div className="toast toast-success">
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="toast toast-error">
          <span>{errorMsg}</span>
          <button className="toast-close" onClick={() => setErrorMsg('')}>&times;</button>
        </div>
      )}

      {/* ===== BOTÕES DAS ESTAÇÕES ===== */}

      <div className="station-buttons">
        {(user?.role === 'admin' || user?.role === 'medico') && (
        <button className={`btn btn-station btn-station-laudos${showForm === 'laudos' ? ' active' : ''}`} onClick={() => openEstacao('laudos')}>
          {showForm === 'laudos' ? <><X size={14} style={{verticalAlign:'middle',marginRight:4}} />Fechar</> : hasLaudo ? <><Pencil size={14} style={{verticalAlign:'middle',marginRight:4}} />Editar Laudo</> : <><ClipboardList size={14} style={{verticalAlign:'middle',marginRight:4}} />Novo Laudo</>}
        </button>
        )}
        {(user?.role === 'admin' || user?.role === 'administrativo') && (
        <button className={`btn btn-station btn-station-acuidade${showForm === 'acuidade' ? ' active' : ''}`} onClick={() => openEstacao('acuidade')}>
          {showForm === 'acuidade' ? <><X size={14} style={{verticalAlign:'middle',marginRight:4}} />Fechar</> : <><Eye size={14} style={{verticalAlign:'middle',marginRight:4}} />Acuidade Visual</>}
        </button>
        )}
        {(user?.role === 'admin' || user?.role === 'medico') && laudos.length > 0 && (laudos[0].conduta_inicial === 'onibus' || laudos[0].conduta_inicial === 'onibus_encaminhamento') && (
          <button className={`btn btn-station btn-station-onibus${showForm === 'onibus' ? ' active' : ''}`} onClick={() => openEstacao('onibus')}>
            {showForm === 'onibus' ? <><X size={14} style={{verticalAlign:'middle',marginRight:4}} />Fechar</> : hasPrescricao ? <><Pencil size={14} style={{verticalAlign:'middle',marginRight:4}} />Editar Prescrição</> : <><Bus size={14} style={{verticalAlign:'middle',marginRight:4}} />Nova Prescrição</>}
          </button>
        )}
      </div>

      {/* ===== BOTÕES DE IMPRESSÃO ===== */}
      {(user?.role === 'admin' || user?.role === 'medico') && (
      <div className="pdf-buttons">
        <span className="pdf-buttons-label"><Printer size={14} /> Documentos:</span>
        {prescricoes.length > 0 && (
          <button className="btn btn-pdf" onClick={async () => gerarReceitaOcular(
            paciente, prescricoes[0], medicoInfo
          )}>Receita Ocular</button>
        )}
        <button className="btn btn-pdf" onClick={() => { setPdfTexto(''); setPdfModal('atestado') }}>Atestado</button>
        <button className="btn btn-pdf" onClick={() => { setPdfTexto(''); setPdfModal('receita_medica') }}>Receita Médica</button>
        {user?.role === 'admin' && (
          <button className="btn btn-pdf" onClick={async () => gerarRelatorio(
            paciente, medicoInfo, {
              anamnese: anamneses[0],
              exames,
              prescricao: prescricoes[0],
              laudo: laudos[0],
              acuidade: data.acuidade_visual,
            }
          )}>Relatório Completo</button>
        )}
      </div>
      )}

      {/* ===== MODAL ATESTADO / RECEITA MÉDICA ===== */}
      {pdfModal && (
        <div className="pdf-modal-overlay" onClick={() => setPdfModal(null)}>
          <div className="pdf-modal" onClick={e => e.stopPropagation()}>
            <div className="pdf-modal-header">
              <div className="pdf-modal-header-icon">
                {pdfModal === 'atestado' ? <ClipboardList size={20} /> : <FileText size={20} />}
              </div>
              <div className="pdf-modal-header-text">
                <h3>{pdfModal === 'atestado' ? 'Atestado Médico' : 'Receita Médica'}</h3>
                <span className="pdf-modal-subtitle">Paciente: {paciente.nome_completo}</span>
              </div>
              <button className="pdf-modal-close" onClick={() => setPdfModal(null)}><X size={18} /></button>
            </div>

            <div className="pdf-modal-body">
              {modelosDoc.filter(m => m.tipo === pdfModal).length > 0 && (
                <div className="modelo-selector">
                  <label><BookOpen size={14} /> Modelos disponíveis</label>
                  <div className="modelo-cards">
                    {modelosDoc.filter(m => m.tipo === pdfModal).map(m => (
                      <button key={m.id} className="modelo-card" onClick={() => {
                        const hoje = new Date().toLocaleDateString('pt-BR')
                        let texto = m.conteudo
                          .replace(/\{\{nome\}\}/g, paciente.nome_completo)
                          .replace(/\{\{cpf\}\}/g, (paciente.cpf || '').replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'))
                          .replace(/\{\{data_nascimento\}\}/g, paciente.data_nascimento ? new Date(paciente.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : '')
                          .replace(/\{\{sexo\}\}/g, paciente.sexo || '')
                          .replace(/\{\{telefone\}\}/g, paciente.telefone || '')
                          .replace(/\{\{email\}\}/g, paciente.email || '')
                          .replace(/\{\{endereco\}\}/g, paciente.endereco || '')
                          .replace(/\{\{convenio\}\}/g, paciente.convenio || '')
                          .replace(/\{\{codigo\}\}/g, paciente.codigo || '')
                          .replace(/\{\{data\}\}/g, hoje)
                          .replace(/\{\{medico\}\}/g, medicoInfo.nome || '')
                          .replace(/\{\{crm\}\}/g, medicoInfo.crm || '')
                        setPdfTexto(texto)
                      }}>
                        <FileText size={16} />
                        <span>{m.nome}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pdf-modal-editor">
                <label>{pdfModal === 'atestado' ? 'Texto do Atestado:' : 'Prescrição / Medicamentos:'}</label>
                <textarea
                  rows={8}
                  value={pdfTexto}
                  onChange={e => setPdfTexto(e.target.value)}
                  placeholder={pdfModal === 'atestado'
                    ? 'Atesto para os devidos fins que o(a) paciente...'
                    : 'Medicamento, posologia, duração...'}
                  autoFocus
                />
              </div>
            </div>

            <div className="pdf-modal-footer">
              <button className="btn btn-secondary" onClick={() => setPdfModal(null)}>
                <X size={14} /> Cancelar
              </button>
              <button className="btn btn-primary" disabled={!pdfTexto.trim()} onClick={async () => {
                if (pdfModal === 'atestado') await gerarAtestado(paciente, pdfTexto, medicoInfo)
                else await gerarReceitaMedica(paciente, pdfTexto, medicoInfo)
                setPdfModal(null)
              }}>
                <Printer size={14} /> Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ESTAÇÃO LAUDOS ===== */}
      {showForm === 'laudos' && (
        <form className="atendimento-form station-form station-laudos" onSubmit={handleSubmit}>
          <div className="station-header station-header-laudos">
            <div className="station-header-icon"><ClipboardList size={22} /></div>
            <div className="station-header-text">
              <h2>Estação Laudos</h2>
              <p>Anamnese, exames, diagnóstico e conduta inicial</p>
            </div>
          </div>

          {/* --- Modelo selector (topo da estação) --- */}
          <div className="modelo-selector">
            <div className="modelo-selector-header"><BookOpen size={14} /> Modelos de Anamnese</div>
            <div className="form-row">
              <div className="form-group">
                <label>Usar Modelo</label>
                <select onChange={e => { aplicarModelo(e.target.value); e.target.value = '' }}>
                  <option value="">— Selecione um modelo —</option>
                  {modelos.map(m => <option key={m.id} value={m.id}>{m.nome} ({rolePrefix(m.autor_role)} {m.autor_nome})</option>)}
                </select>
              </div>
              <div className="form-group modelo-actions">
                <label>&nbsp;</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSalvarModelo(!showSalvarModelo)}>
                  {showSalvarModelo ? <><X size={14} style={{verticalAlign:'middle',marginRight:3}} />Cancelar</> : <><Save size={14} style={{verticalAlign:'middle',marginRight:3}} />Salvar como Modelo</>}
                </button>
              </div>
            </div>
            {showSalvarModelo && (
              <div className="modelo-save-row">
                <input placeholder="Nome do modelo (ex: Miopia Leve)" value={nomeModelo} onChange={e => setNomeModelo(e.target.value)} />
                <button type="button" className="btn btn-primary btn-sm" onClick={salvarModelo} disabled={!nomeModelo.trim()}>Salvar</button>
              </div>
            )}
            {modelos.length > 0 && (
              <div className="modelo-list">
                {modelos.map(m => (
                  <span key={m.id} className="modelo-tag">
                    {m.nome}
                    <button type="button" onClick={() => excluirModelo(m.id)} title="Excluir modelo">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* --- Anamnese --- */}
          <fieldset className="form-section">
            <legend><FileText size={16} style={{verticalAlign:'middle',marginRight:6}} />Anamnese</legend>
            <div className={`form-group${fieldErrors.has('anamnese_queixa_principal') ? ' field-error' : ''}`}>
              <label>Queixa Principal *</label>
              <textarea rows={2} value={form.anamnese.queixa_principal} onChange={e => updateAnamnese('queixa_principal', e.target.value)} placeholder="Descreva a queixa do paciente..." />
            </div>
            <div className="form-row form-row-3">
              <div className={`form-group${fieldErrors.has('anamnese_historico_ocular') ? ' field-error' : ''}`}>
                <label>Histórico Ocular *</label>
                <textarea rows={2} value={form.anamnese.historico_ocular} onChange={e => updateAnamnese('historico_ocular', e.target.value)} />
              </div>
              <div className={`form-group${fieldErrors.has('anamnese_historico_familiar') ? ' field-error' : ''}`}>
                <label>Histórico Familiar *</label>
                <textarea rows={2} value={form.anamnese.historico_familiar} onChange={e => updateAnamnese('historico_familiar', e.target.value)} />
              </div>
              <div className={`form-group${fieldErrors.has('anamnese_historico_pessoal') ? ' field-error' : ''}`}>
                <label>Histórico Pessoal *</label>
                <textarea rows={2} value={form.anamnese.historico_pessoal} onChange={e => updateAnamnese('historico_pessoal', e.target.value)} />
              </div>
            </div>
            <div className="form-row form-row-3">
              <div className={`form-group${fieldErrors.has('anamnese_alergias') ? ' field-error' : ''}`}>
                <label>Alergias *</label>
                <input value={form.anamnese.alergias} onChange={e => updateAnamnese('alergias', e.target.value)} />
              </div>
              <div className={`form-group${fieldErrors.has('anamnese_medicamentos') ? ' field-error' : ''}`}>
                <label>Medicamentos em Uso *</label>
                <input value={form.anamnese.medicamentos_em_uso} onChange={e => updateAnamnese('medicamentos_em_uso', e.target.value)} />
              </div>
              <div className={`form-group${fieldErrors.has('anamnese_cirurgias') ? ' field-error' : ''}`}>
                <label>Cirurgias Anteriores *</label>
                <input value={form.anamnese.cirurgias_anteriores} onChange={e => updateAnamnese('cirurgias_anteriores', e.target.value)} />
              </div>
            </div>
            <div className={`form-group${fieldErrors.has('anamnese_observacoes') ? ' field-error' : ''}`}>
              <label>Observações</label>
              <textarea rows={1} value={form.anamnese.observacoes} onChange={e => updateAnamnese('observacoes', e.target.value)} />
            </div>
          </fieldset>

          {/* --- Exames (Equipamentos) --- */}
          <fieldset className="form-section">
            <legend><Microscope size={16} style={{verticalAlign:'middle',marginRight:6}} />Exames (Equipamentos)</legend>
            <p className="exames-info-text">Os exames serão adicionados automaticamente através dos equipamentos integrados. Abaixo você pode adicionar observações sobre os exames realizados.</p>
            {exames.length > 0 && (
              <div className="exames-recebidos">
                <div className="exames-recebidos-header"><CheckCircle2 size={14} /> Exames Recebidos</div>
                <div className="exames-recebidos-list">
                  {exames.filter(ex => ex.tipo_exame !== 'tonometria').map((ex, idx) => (
                    <div key={idx} className="exames-recebidos-item">
                      <span className="exame-tipo-badge">{tipoExameLabel(ex.tipo_exame)}</span>
                      <span className="exame-olho">{ex.olho}</span>
                      {ex.resultado && <span className="exame-resultado">{ex.resultado}</span>}
                    </div>
                  ))}
                  {exames.some(ex => ex.tipo_exame === 'tonometria') && (() => {
                    const tonoOD = exames.find(ex => ex.tipo_exame === 'tonometria' && ex.olho === 'OD')
                    const tonoOE = exames.find(ex => ex.tipo_exame === 'tonometria' && ex.olho === 'OE')
                    return (
                      <div className="exames-recebidos-item">
                        <span className="exame-tipo-badge">Tonometria</span>
                        {tonoOD?.resultado && <span className="exame-resultado">OD: {tonoOD.resultado} mmHg</span>}
                        {tonoOE?.resultado && <span className="exame-resultado">OE: {tonoOE.resultado} mmHg</span>}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
            <div className="redcheck-em-breve">
              <span>📡 Integração com equipamentos — <strong>Em breve</strong></span>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Tonometria OD (mmHg)</label>
                <input type="text" inputMode="decimal" placeholder="ex: 14" value={form.tonometria_od} onChange={e => setForm(f => ({ ...f, tonometria_od: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Tonometria OE (mmHg)</label>
                <input type="text" inputMode="decimal" placeholder="ex: 14" value={form.tonometria_oe} onChange={e => setForm(f => ({ ...f, tonometria_oe: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Observações sobre Exames</label>
              <textarea rows={2} value={form.exames_observacoes} onChange={e => updateExamesObservacoes(e.target.value)} placeholder="Adicione qualquer observação pertinente aos exames realizados..." />
            </div>
          </fieldset>

          {/* --- Laudo (Conduta Inicial) --- */}
          <fieldset className="form-section">
            <legend><ClipboardList size={16} style={{verticalAlign:'middle',marginRight:6}} />Laudo</legend>
            {laudosProntos.length > 0 && (
              <div className="form-group" style={{maxWidth:400,marginBottom:16}}>
                <label>Laudo</label>
                <select onChange={e => {
                  const lp = laudosProntos.find(x => x.id === Number(e.target.value))
                  if (lp) {
                    setForm(f => ({
                      ...f,
                      laudo: {
                        ...f.laudo,
                        diagnostico: lp.diagnostico,
                        conduta_inicial: lp.conduta || f.laudo.conduta_inicial,
                        observacoes: lp.observacoes || f.laudo.observacoes,
                        especialidade: lp.especialidade || f.laudo.especialidade,
                      },
                    }))
                  }
                  e.target.value = ''
                }}>
                  <option value="">— Selecionar laudo —</option>
                  {laudosProntos.map(lp => <option key={lp.id} value={lp.id}>{lp.titulo}</option>)}
                </select>
              </div>
            )}
            <div className={`form-group${fieldErrors.has('laudo_diagnostico') ? ' field-error' : ''}`}>
              <label>Diagnóstico *</label>
              <textarea rows={2} value={form.laudo.diagnostico} onChange={e => updateLaudo('diagnostico', e.target.value)} placeholder="Descreva o diagnóstico..." />
            </div>
            <div className="form-group">
              <label>Conduta Inicial</label>
              <div className="conduta-btn-group">
                {CONDUTAS_INICIAIS.map(c => (
                  <button key={c.value} type="button" className={`conduta-btn conduta-btn-${c.value}${form.laudo.conduta_inicial === c.value ? ' active' : ''}`} onClick={() => updateLaudo('conduta_inicial', form.laudo.conduta_inicial === c.value ? '' : c.value)}>{c.label}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Observações (Laudo)</label>
              <input value={form.laudo.observacoes} onChange={e => updateLaudo('observacoes', e.target.value)} />
            </div>
          </fieldset>

          <div className="form-actions-main">
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'Salvando...' : hasLaudo ? <><Save size={14} style={{verticalAlign:'middle',marginRight:4}} />Atualizar Laudo</> : <><Save size={14} style={{verticalAlign:'middle',marginRight:4}} />Salvar Laudo</>}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* ===== ESTAÇÃO ÔNIBUS ===== */}
      {showForm === 'onibus' && (
        <form className="atendimento-form station-form station-onibus" onSubmit={handleSubmit}>
          <div className="station-header station-header-onibus">
            <div className="station-header-icon"><Bus size={22} /></div>
            <div className="station-header-text">
              <h2>Estação Ônibus</h2>
              <p>Refração e conduta final</p>
            </div>
          </div>

          {/* --- Prescrição / Refração --- */}
          <fieldset className="form-section">
            <legend><Glasses size={16} style={{verticalAlign:'middle',marginRight:6}} />Refração</legend>
            <div className="rx-tipo-row">
              <div className="form-group">
                <label>Tipo</label>
                <div className="rx-tipo-buttons">
                  <button type="button" className={`rx-tipo-btn${form.prescricao.tipo === 'oculos' ? ' active' : ''}`} onClick={() => updatePrescricao('tipo', 'oculos')}><Glasses size={14} /> Óculos</button>
                  <button type="button" className={`rx-tipo-btn${form.prescricao.tipo === 'lentes_contato' ? ' active' : ''}`} onClick={() => updatePrescricao('tipo', 'lentes_contato')}><Eye size={14} /> Lente de Contato</button>
                </div>
              </div>
            </div>
            <div className="rx-table">
              <table>
                <thead>
                  <tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="eye-label"><Eye size={12} style={{marginRight:2}} />OD</td>
                    <td className={fieldErrors.has('od_esferico') ? 'field-error' : ''}><input type="text" value={form.prescricao.od_esferico} onChange={e => updatePrescricao('od_esferico', e.target.value)} placeholder="+0.00" /></td>
                    <td className={fieldErrors.has('od_cilindrico') ? 'field-error' : ''}><input type="text" value={form.prescricao.od_cilindrico} onChange={e => updatePrescricao('od_cilindrico', e.target.value)} placeholder="-0.00" /></td>
                    <td className={fieldErrors.has('od_eixo') ? 'field-error' : ''}><input type="text" value={form.prescricao.od_eixo} onChange={e => updatePrescricao('od_eixo', e.target.value)} placeholder="0°" /></td>
                  </tr>
                  <tr>
                    <td className="eye-label"><Eye size={12} style={{marginRight:2}} />OE</td>
                    <td className={fieldErrors.has('oe_esferico') ? 'field-error' : ''}><input type="text" value={form.prescricao.oe_esferico} onChange={e => updatePrescricao('oe_esferico', e.target.value)} placeholder="+0.00" /></td>
                    <td className={fieldErrors.has('oe_cilindrico') ? 'field-error' : ''}><input type="text" value={form.prescricao.oe_cilindrico} onChange={e => updatePrescricao('oe_cilindrico', e.target.value)} placeholder="-0.00" /></td>
                    <td className={fieldErrors.has('oe_eixo') ? 'field-error' : ''}><input type="text" value={form.prescricao.oe_eixo} onChange={e => updatePrescricao('oe_eixo', e.target.value)} placeholder="0°" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rx-extras">
              <div className="rx-extra-item">
                <label>Adição</label>
                <input type="text" value={form.prescricao.od_adicao} onChange={e => { updatePrescricao('od_adicao', e.target.value); updatePrescricao('oe_adicao', e.target.value) }} placeholder="+0.00" />
              </div>
              <div className="rx-extra-item">
                <label>DP (mm)</label>
                <input type="text" value={form.prescricao.dp} onChange={e => updatePrescricao('dp', e.target.value)} placeholder="63" />
              </div>
              <div className={`rx-extra-item rx-extra-wide${fieldErrors.has('tipo_lente') ? ' field-error' : ''}`}>
                <label>Tipo de Lente *</label>
                <select value={form.prescricao.observacoes} onChange={e => updatePrescricao('observacoes', e.target.value)}>
                  <option value="">— Selecione —</option>
                  <option value="Monofocal para longe">Monofocal para longe</option>
                  <option value="Monofocal para perto">Monofocal para perto</option>
                  <option value="Multifocal">Multifocal</option>
                  <option value="Monofocal para longe alto índice">Monofocal para longe alto índice</option>
                  <option value="Monofocal para perto alto índice">Monofocal para perto alto índice</option>
                  <option value="Multifocal alto índice">Multifocal alto índice</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* --- Acuidade com Óculos Novo --- */}
          <fieldset className="form-section">
            <legend><Eye size={16} style={{verticalAlign:'middle',marginRight:6}} />Acuidade com Óculos Novo</legend>
            <div className="acuidade-eyes-row">
              <div className="acuidade-eye-card">
                <div className="acuidade-eye-indicator od">OD</div>
                <div className={`form-group${fieldErrors.has('acuidade_od') ? ' field-error' : ''}`}>
                  <label>Olho Direito *</label>
                  <input type="text" value={form.prescricao.acuidade_od || '20/'} onChange={e => { let v = e.target.value; if (!v.startsWith('20/')) v = '20/'; updatePrescricao('acuidade_od', v) }} placeholder="20/" />
                </div>
              </div>
              <div className="acuidade-eye-card">
                <div className="acuidade-eye-indicator oe">OE</div>
                <div className={`form-group${fieldErrors.has('acuidade_oe') ? ' field-error' : ''}`}>
                  <label>Olho Esquerdo *</label>
                  <input type="text" value={form.prescricao.acuidade_oe || '20/'} onChange={e => { let v = e.target.value; if (!v.startsWith('20/')) v = '20/'; updatePrescricao('acuidade_oe', v) }} placeholder="20/" />
                </div>
              </div>
            </div>
          </fieldset>

          {/* --- Conduta Final --- */}
          <fieldset className="form-section">
            <legend><CheckCircle2 size={16} style={{verticalAlign:'middle',marginRight:6}} />Conduta Final</legend>
            <div className="form-group">
              <label>Conduta Final</label>
              <div className="conduta-btn-group">
                {CONDUTAS_FINAIS.map(c => (
                  <button key={c.value} type="button" className={`conduta-btn conduta-btn-${c.value}${form.laudo.conduta_final === c.value ? ' active' : ''}`} onClick={() => updateLaudo('conduta_final', form.laudo.conduta_final === c.value ? '' : c.value)}>{c.label}</button>
                ))}
              </div>
            </div>
          </fieldset>

          <div className="form-actions-main">
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'Salvando...' : hasPrescricao ? <><Save size={14} style={{verticalAlign:'middle',marginRight:4}} />Atualizar Prescrição</> : <><Save size={14} style={{verticalAlign:'middle',marginRight:4}} />Salvar Prescrição</>}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* ===== ESTAÇÃO ACUIDADE VISUAL ===== */}
      {showForm === 'acuidade' && (
        <form className="atendimento-form station-form station-acuidade" onSubmit={handleSubmit}>
          <div className="station-header station-header-acuidade">
            <div className="station-header-icon"><Eye size={22} /></div>
            <div className="station-header-text">
              <h2>Acuidade Visual</h2>
              <p>Medição de acuidade com e sem óculos</p>
            </div>
          </div>

          {/* --- Acuidade Sem Óculos --- */}
          <fieldset className="form-section">
            <legend>Acuidade Sem Óculos</legend>
            <div className="form-row">
              <div className="form-group">
                <label>OD (Olho Direito)</label>
                <select value={ACUIDADE_OPTIONS.includes(form.acuidade.sem_oculos_od) || form.acuidade.sem_oculos_od === '' ? form.acuidade.sem_oculos_od : 'outro'} onChange={e => updateAcuidade('sem_oculos_od', e.target.value === 'outro' ? '__outro__' : e.target.value)}>
                  <option value="">— Selecione —</option>
                  {ACUIDADE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  <option value="outro">Outro</option>
                </select>
                {!ACUIDADE_OPTIONS.includes(form.acuidade.sem_oculos_od) && form.acuidade.sem_oculos_od !== '' && (
                  <input type="text" value={form.acuidade.sem_oculos_od === '__outro__' ? '' : form.acuidade.sem_oculos_od} onChange={e => updateAcuidade('sem_oculos_od', e.target.value || '__outro__')} placeholder="Digite a acuidade..." style={{marginTop:6}} />
                )}
              </div>
              <div className="form-group">
                <label>OE (Olho Esquerdo)</label>
                <select value={ACUIDADE_OPTIONS.includes(form.acuidade.sem_oculos_oe) || form.acuidade.sem_oculos_oe === '' ? form.acuidade.sem_oculos_oe : 'outro'} onChange={e => updateAcuidade('sem_oculos_oe', e.target.value === 'outro' ? '__outro__' : e.target.value)}>
                  <option value="">— Selecione —</option>
                  {ACUIDADE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  <option value="outro">Outro</option>
                </select>
                {!ACUIDADE_OPTIONS.includes(form.acuidade.sem_oculos_oe) && form.acuidade.sem_oculos_oe !== '' && (
                  <input type="text" value={form.acuidade.sem_oculos_oe === '__outro__' ? '' : form.acuidade.sem_oculos_oe} onChange={e => updateAcuidade('sem_oculos_oe', e.target.value || '__outro__')} placeholder="Digite a acuidade..." style={{marginTop:6}} />
                )}
              </div>
            </div>
          </fieldset>

          {/* --- Usa Óculos --- */}
          <fieldset className="form-section">
            <legend>Usa Óculos?</legend>
            <div className="conduta-btn-group">
              <button 
                type="button"
                className={`conduta-btn conduta-btn-nao${!form.acuidade.usa_oculos ? ' active' : ''}`}
                onClick={() => updateAcuidade('usa_oculos', false)}
              >
                Não
              </button>
              <button 
                type="button"
                className={`conduta-btn conduta-btn-sim${form.acuidade.usa_oculos ? ' active' : ''}`}
                onClick={() => updateAcuidade('usa_oculos', true)}
              >
                Sim
              </button>
            </div>
          </fieldset>

          {/* --- Acuidade Com Óculos (condicional) --- */}
          {form.acuidade.usa_oculos && (
            <fieldset className="form-section">
              <legend>Acuidade Com Óculos</legend>
              <div className="form-row">
                <div className="form-group">
                  <label>OD (Olho Direito)</label>
                  <select value={ACUIDADE_OPTIONS.includes(form.acuidade.com_oculos_od) || form.acuidade.com_oculos_od === '' ? form.acuidade.com_oculos_od : 'outro'} onChange={e => updateAcuidade('com_oculos_od', e.target.value === 'outro' ? '__outro__' : e.target.value)}>
                    <option value="">— Selecione —</option>
                    {ACUIDADE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    <option value="outro">Outro</option>
                  </select>
                  {!ACUIDADE_OPTIONS.includes(form.acuidade.com_oculos_od) && form.acuidade.com_oculos_od !== '' && (
                    <input type="text" value={form.acuidade.com_oculos_od === '__outro__' ? '' : form.acuidade.com_oculos_od} onChange={e => updateAcuidade('com_oculos_od', e.target.value || '__outro__')} placeholder="Digite a acuidade..." style={{marginTop:6}} />
                  )}
                </div>
                <div className="form-group">
                  <label>OE (Olho Esquerdo)</label>
                  <select value={ACUIDADE_OPTIONS.includes(form.acuidade.com_oculos_oe) || form.acuidade.com_oculos_oe === '' ? form.acuidade.com_oculos_oe : 'outro'} onChange={e => updateAcuidade('com_oculos_oe', e.target.value === 'outro' ? '__outro__' : e.target.value)}>
                    <option value="">— Selecione —</option>
                    {ACUIDADE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    <option value="outro">Outro</option>
                  </select>
                  {!ACUIDADE_OPTIONS.includes(form.acuidade.com_oculos_oe) && form.acuidade.com_oculos_oe !== '' && (
                    <input type="text" value={form.acuidade.com_oculos_oe === '__outro__' ? '' : form.acuidade.com_oculos_oe} onChange={e => updateAcuidade('com_oculos_oe', e.target.value || '__outro__')} placeholder="Digite a acuidade..." style={{marginTop:6}} />
                  )}
                </div>
              </div>
            </fieldset>
          )}

          {/* --- Dilatação --- */}
          <fieldset className="form-section">
            <legend>Dilatação</legend>
            <div className="conduta-btn-group">
              <button 
                type="button"
                className={`conduta-btn conduta-btn-nao${!form.acuidade.dilata ? ' active' : ''}`}
                onClick={() => updateAcuidade('dilata', false)}
              >
                Não
              </button>
              <button 
                type="button"
                className={`conduta-btn conduta-btn-sim${form.acuidade.dilata ? ' active' : ''}`}
                onClick={() => updateAcuidade('dilata', true)}
              >
                Sim
              </button>
            </div>
          </fieldset>

          {/* --- Observações --- */}
          <fieldset className="form-section">
            <legend>Observações</legend>
            <div className="form-group">
              <textarea value={form.acuidade.observacoes} onChange={e => updateAcuidade('observacoes', e.target.value)} style={{minHeight:'100px'}} />
            </div>
          </fieldset>

          <div className="form-actions-main">
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'Salvando...' : <><Save size={14} style={{verticalAlign:'middle',marginRight:4}} />Salvar Acuidade</>}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* ===== HISTÓRICO (Laudo Unificado) ===== */}
      <div className="historico-section">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2 className="section-title" style={{margin:0}}><BookOpen size={16} />Laudo do Atendimento</h2>
          {user?.role === 'admin' && (anamneses.length > 0 || exames.length > 0 || laudos.length > 0 || data.acuidade_visual) && (
            <button className="btn btn-danger btn-sm" onClick={async () => {
              if (!confirm('Tem certeza que deseja excluir todo o laudo deste paciente? Esta ação não pode ser desfeita.')) return
              try {
                await api.delete(`/prontuario/${pacienteId}/laudo`)
                setSuccessMsg('Laudo excluído com sucesso!')
                setTimeout(() => setSuccessMsg(''), 4000)
                loadProntuario()
              } catch (err: any) {
                setErrorMsg(err?.response?.data?.error || 'Erro ao excluir laudo.')
                setTimeout(() => setErrorMsg(''), 6000)
              }
            }}>
              <Trash2 size={14} style={{verticalAlign:'middle',marginRight:4}} />Excluir Laudo
            </button>
          )}
        </div>

        {anamneses.length === 0 && exames.length === 0 && laudos.length === 0 && !data.acuidade_visual ? (
          <p className="empty-msg">Nenhum atendimento registrado para este paciente.</p>
        ) : (
          <div className="hist-group">
            <div className="hist-group-body">
              <div className="hist-card">
                <div className="hist-body">
                  {/* --- Acuidade Visual --- */}
                  {data.acuidade_visual && (
                    <div className="laudo-section">
                      <div className="laudo-section-header">
                        <h4><Eye size={14} style={{verticalAlign:'middle',marginRight:4}} />Acuidade Visual</h4>
                        {data.acuidade_visual.medico_nome && (
                          <span className="section-author">{rolePrefix(data.acuidade_visual.medico_role)} {data.acuidade_visual.medico_nome} — {new Date(data.acuidade_visual.created_at).toLocaleDateString('pt-BR')} {new Date(data.acuidade_visual.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
                        )}
                      </div>
                      <div className="laudo-detail-grid">
                        <p><strong>Sem Óculos OD:</strong> {data.acuidade_visual.sem_oculos_od || '—'}</p>
                        <p><strong>Sem Óculos OE:</strong> {data.acuidade_visual.sem_oculos_oe || '—'}</p>
                        {data.acuidade_visual.usa_oculos === 1 && (
                          <>
                            <p><strong>Com Óculos OD:</strong> {data.acuidade_visual.com_oculos_od || '—'}</p>
                            <p><strong>Com Óculos OE:</strong> {data.acuidade_visual.com_oculos_oe || '—'}</p>
                          </>
                        )}
                        <p><strong>Usa Óculos:</strong> {data.acuidade_visual.usa_oculos === 1 ? 'Sim' : 'Não'}</p>
                        <p><strong>Dilatação:</strong> <span className={`dilata-badge ${data.acuidade_visual.dilata === 1 ? 'dilata-sim' : 'dilata-nao'}`}>{data.acuidade_visual.dilata === 1 ? 'Sim' : 'Não'}</span></p>
                      </div>
                      {data.acuidade_visual.observacoes && <p style={{marginTop:4}}><strong>Obs:</strong> {data.acuidade_visual.observacoes}</p>}
                    </div>
                  )}

                  {/* --- Anamnese --- */}
                  {anamneses.length > 0 && (() => {
                    const a = anamneses[0]
                    return (
                      <div className="laudo-section">
                        <div className="laudo-section-header">
                          <h4><FileText size={14} style={{verticalAlign:'middle',marginRight:4}} />Anamnese</h4>
                          <span className="section-author">{rolePrefix(a.medico_role)} {a.medico_nome} — {new Date(a.created_at).toLocaleDateString('pt-BR')} {new Date(a.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        {a.queixa_principal && <p><strong>Queixa Principal:</strong> {a.queixa_principal}</p>}
                        {a.historico_ocular && <p><strong>Histórico Ocular:</strong> {a.historico_ocular}</p>}
                        {a.historico_familiar && <p><strong>Histórico Familiar:</strong> {a.historico_familiar}</p>}
                        {a.alergias && <p><strong>Alergias:</strong> {a.alergias}</p>}
                        {a.medicamentos_em_uso && <p><strong>Medicamentos:</strong> {a.medicamentos_em_uso}</p>}
                        {a.cirurgias_anteriores && <p><strong>Cirurgias Anteriores:</strong> {a.cirurgias_anteriores}</p>}
                        {a.observacoes && <p><strong>Obs:</strong> {a.observacoes}</p>}
                      </div>
                    )
                  })()}

                  {/* --- Exames --- */}
                  {exames.length > 0 && (
                    <div className="laudo-section">
                      <div className="laudo-section-header">
                        <h4><Microscope size={14} style={{verticalAlign:'middle',marginRight:4}} />Exames</h4>
                      </div>
                      {exames.filter(ex => ex.tipo_exame !== 'tonometria').map(ex => (
                        <div key={ex.id} style={{marginBottom:6}}>
                          <p><strong>{tipoExameLabel(ex.tipo_exame)}</strong> — {ex.olho} {ex.resultado ? `— ${ex.resultado}` : ''}</p>
                          {ex.observacoes && <p style={{marginLeft:12, fontSize:'0.85rem'}}><em>Obs: {ex.observacoes}</em></p>}
                        </div>
                      ))}
                      {exames.some(ex => ex.tipo_exame === 'tonometria') && (() => {
                        const tonoOD = exames.find(ex => ex.tipo_exame === 'tonometria' && ex.olho === 'OD')
                        const tonoOE = exames.find(ex => ex.tipo_exame === 'tonometria' && ex.olho === 'OE')
                        return (
                          <div style={{marginBottom:6}}>
                            <p><strong>Tonometria</strong>{tonoOD?.resultado ? ` — OD: ${tonoOD.resultado} mmHg` : ''}{tonoOE?.resultado ? ` / OE: ${tonoOE.resultado} mmHg` : ''}</p>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* --- Laudo (Diagnóstico + Condutas) --- */}
                  {laudos.length > 0 && (() => {
                    const l = laudos[0]
                    return (
                      <div className="laudo-section">
                        <div className="laudo-section-header">
                          <h4><ClipboardList size={14} style={{verticalAlign:'middle',marginRight:4}} />Diagnóstico e Conduta</h4>
                          <span className="section-author">{rolePrefix(l.medico_role)} {l.medico_nome} — {new Date(l.created_at).toLocaleDateString('pt-BR')} {new Date(l.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        {l.diagnostico && <p><strong>Diagnóstico:</strong> <span dangerouslySetInnerHTML={{ __html: formatTexto(l.diagnostico) }} /></p>}
                        {l.conduta_inicial && <p><strong>Conduta Inicial:</strong> <span className="conduta-badge" style={{backgroundColor: condutaColor(l.conduta_inicial)}}>{condutaInicialLabel(l.conduta_inicial)}</span></p>}
                        {l.observacoes && <p><strong>Obs:</strong> <span dangerouslySetInnerHTML={{ __html: formatTexto(l.observacoes) }} /></p>}
                      </div>
                    )
                  })()}

                  {/* --- Prescrição --- */}
                  {prescricoes.length > 0 && (() => {
                    const p = prescricoes[0]
                    return (
                      <div className="laudo-section">
                        <div className="laudo-section-header">
                          <h4><Glasses size={14} style={{verticalAlign:'middle',marginRight:4}} />Prescrição</h4>
                          <span className="section-author">{rolePrefix(p.medico_role)} {p.medico_nome} — {new Date(p.created_at).toLocaleDateString('pt-BR')} {new Date(p.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        <p><strong>Tipo:</strong> {p.tipo === 'lentes_contato' ? 'Lente de Contato' : 'Óculos'}</p>
                        <div className="rx-table rx-table-readonly">
                          <table>
                            <thead><tr><th></th><th>Esf</th><th>Cil</th><th>Eixo</th></tr></thead>
                            <tbody>
                              <tr><td className="eye-label">OD</td><td>{p.od_esferico||'—'}</td><td>{p.od_cilindrico||'—'}</td><td>{p.od_eixo||'—'}</td></tr>
                              <tr><td className="eye-label">OE</td><td>{p.oe_esferico||'—'}</td><td>{p.oe_cilindrico||'—'}</td><td>{p.oe_eixo||'—'}</td></tr>
                            </tbody>
                          </table>
                        </div>
                        {p.od_adicao && <p><strong>Adição:</strong> {p.od_adicao}</p>}
                        {p.dp && <p><strong>DP:</strong> {p.dp} mm</p>}
                        {p.observacoes && <p><strong>Obs:</strong> {p.observacoes}</p>}
                        {laudos[0]?.conduta_final && <p><strong>Conduta Final:</strong> <span className="conduta-badge" style={{backgroundColor: condutaColor(laudos[0].conduta_final)}}>{condutaFinalLabel(laudos[0].conduta_final)}</span></p>}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
