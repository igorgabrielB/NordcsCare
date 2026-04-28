import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../services/api.ts'
import { User, Heart, Phone, MapPin, FileText } from 'lucide-react'
import IOSDatePicker from '../../components/IOSDatePicker/IOSDatePicker.tsx'
import './Pacientes.css'

interface PacienteForm {
  nome_completo: string
  cpf: string
  data_nascimento: string
  sexo: string
  nacionalidade: string
  naturalidade: string
  telefone: string
  email: string
  cep: string
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  convenio: string
  escola: string
  responsavel: string
  observacoes: string
}

const NACIONALIDADES = [
  'Brasil', 'Afeganistão', 'Albânia', 'Alemanha', 'Andorra', 'Angola', 'Antígua e Barbuda',
  'Arábia Saudita', 'Argélia', 'Argentina', 'Armênia', 'Austrália', 'Áustria', 'Azerbaijão',
  'Bahamas', 'Bangladesh', 'Barbados', 'Barein', 'Bélgica', 'Belize', 'Benim',
  'Bielorrússia', 'Bolívia', 'Bósnia e Herzegovina', 'Botsuana', 'Brunei', 'Bulgária',
  'Burkina Faso', 'Burundi', 'Butão',
  'Cabo Verde', 'Camarões', 'Camboja', 'Canadá', 'Catar', 'Cazaquistão',
  'Chade', 'Chile', 'China', 'Chipre', 'Colômbia', 'Comores', 'Congo',
  'Coreia do Norte', 'Coreia do Sul', 'Costa do Marfim', 'Costa Rica', 'Croácia', 'Cuba',
  'Dinamarca', 'Djibuti', 'Dominica',
  'Egito', 'El Salvador', 'Emirados Árabes Unidos', 'Equador', 'Eritreia', 'Eslováquia',
  'Eslovênia', 'Espanha', 'Estados Unidos', 'Estônia', 'Etiópia',
  'Fiji', 'Filipinas', 'Finlândia', 'França',
  'Gabão', 'Gâmbia', 'Gana', 'Geórgia', 'Granada', 'Grécia', 'Guatemala',
  'Guiana', 'Guiné', 'Guiné-Bissau', 'Guiné Equatorial',
  'Haiti', 'Holanda', 'Honduras', 'Hungria',
  'Iêmen', 'Índia', 'Indonésia', 'Irã', 'Iraque', 'Irlanda', 'Islândia', 'Israel', 'Itália',
  'Jamaica', 'Japão', 'Jordânia',
  'Kuwait', 'Quirguistão',
  'Laos', 'Lesoto', 'Letônia', 'Líbano', 'Libéria', 'Líbia',
  'Liechtenstein', 'Lituânia', 'Luxemburgo',
  'Macedônia do Norte', 'Madagascar', 'Malásia', 'Malauí', 'Maldivas', 'Mali',
  'Malta', 'Marrocos', 'Maurício', 'Mauritânia', 'México', 'Mianmar',
  'Micronésia', 'Moçambique', 'Moldávia', 'Mônaco', 'Mongólia', 'Montenegro',
  'Namíbia', 'Nauru', 'Nepal', 'Nicarágua', 'Níger', 'Nigéria',
  'Noruega', 'Nova Zelândia',
  'Omã',
  'Palau', 'Palestina', 'Panamá', 'Papua-Nova Guiné', 'Paquistão', 'Paraguai',
  'Peru', 'Polônia', 'Portugal',
  'Quênia',
  'República Dominicana', 'República Tcheca', 'Romênia', 'Ruanda', 'Rússia',
  'Ilhas Salomão', 'Samoa', 'Santa Lúcia', 'São Cristóvão e Névis',
  'São Tomé e Príncipe', 'São Vicente e Granadinas', 'Senegal', 'Serra Leoa', 'Sérvia',
  'Seychelles', 'Singapura', 'Síria', 'Somália', 'Sri Lanka',
  'Suazilândia', 'Sudão', 'Sudão do Sul', 'Suécia', 'Suíça', 'Suriname',
  'Tailândia', 'Taiwan', 'Tajiquistão', 'Tanzânia', 'Timor-Leste', 'Togo',
  'Tonga', 'Trinidad e Tobago', 'Tunísia', 'Turcomenistão', 'Turquia', 'Tuvalu',
  'Ucrânia', 'Uganda', 'Uruguai', 'Uzbequistão',
  'Vanuatu', 'Vaticano', 'Venezuela', 'Vietnã',
  'Zâmbia', 'Zimbábue',
]

const emptyForm: PacienteForm = {
  nome_completo: '',
  cpf: '',
  data_nascimento: '',
  sexo: '',
  nacionalidade: '',
  naturalidade: '',
  telefone: '',
  email: '',
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  convenio: '',
  escola: '',
  responsavel: '',
  observacoes: '',
}

export default function PacienteForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id

  const formTopRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<PacienteForm>(emptyForm)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [escolas, setEscolas] = useState<string[]>([])
  const [escolaSearch, setEscolaSearch] = useState('')
  const [showEscolaDropdown, setShowEscolaDropdown] = useState(false)

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [error])

  useEffect(() => {
    if (fieldErrors.size > 0) {
      const timer = setTimeout(() => setFieldErrors(new Set()), 3000)
      return () => clearTimeout(timer)
    }
  }, [fieldErrors])

  useEffect(() => {
    api.get('/pacientes/escolas').then(res => setEscolas(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (isEditing) {
      api.get(`/pacientes/${id}`).then((res) => {
        const data = res.data
        setForm({
          nome_completo: data.nome_completo || '',
          cpf: data.cpf || '',
          data_nascimento: data.data_nascimento || '',
          sexo: data.sexo || '',
          nacionalidade: data.nacionalidade || '',
          naturalidade: data.naturalidade || '',
          telefone: data.telefone || '',
          email: data.email || '',
          cep: data.cep || '',
          rua: data.rua || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          estado: data.estado || '',
          convenio: data.convenio || '',
          escola: data.escola || '',
          responsavel: data.responsavel || '',
          observacoes: data.observacoes || '',
        })
        setEscolaSearch(data.escola || '')
      }).catch(() => {
        setError('Erro ao carregar dados do paciente')
      })
    }
  }, [id, isEditing])

  const isMenor = (() => {
    if (!form.data_nascimento) return false
    const nascimento = new Date(form.data_nascimento + 'T00:00:00')
    const hoje = new Date()
    let idade = hoje.getFullYear() - nascimento.getFullYear()
    const m = hoje.getMonth() - nascimento.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--
    return idade < 18
  })()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let value = e.target.value
    if (e.target.name === 'cpf') {
      value = value.replace(/\D/g, '').slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    }
    setForm({ ...form, [e.target.name]: value })
    setFieldErrors(prev => {
      const next = new Set(prev)
      next.delete(e.target.name)
      return next
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors(new Set())

    const campos: string[] = []
    if (!form.nome_completo.trim()) campos.push('nome_completo')
    if (!form.cpf.trim()) campos.push('cpf')
    if (!form.data_nascimento) campos.push('data_nascimento')
    if (!form.sexo) campos.push('sexo')
    if (!form.nacionalidade) campos.push('nacionalidade')
    if (!form.naturalidade.trim()) campos.push('naturalidade')
    if (!form.convenio) campos.push('convenio')
    if (isMenor && !form.responsavel.trim()) campos.push('responsavel')

    if (campos.length > 0) {
      setFieldErrors(new Set(campos))
      setError('Preencha todos os campos obrigatórios destacados.')
      formTopRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    setLoading(true)

    try {
      if (isEditing) {
        await api.put(`/pacientes/${id}`, form)
        setSuccessMessage('Paciente atualizado com sucesso!')
      } else {
        await api.post('/pacientes', form)
        setSuccessMessage('Paciente cadastrado com sucesso!')
      }
      
      setShowSuccess(true)
      
      // Navega depois de 2 segundos, passando o nome como query param
      setTimeout(() => {
        navigate(`/pacientes?search=${encodeURIComponent(form.nome_completo)}`)
      }, 2000)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Erro ao salvar paciente')
      formTopRef.current?.scrollIntoView({ behavior: 'smooth' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="paciente-form-page" ref={formTopRef}>
      {showSuccess && (
        <div className="toast toast-success">
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="toast toast-error">
          <span>{error}</span>
          <button className="toast-close" onClick={() => setError('')}>&times;</button>
        </div>
      )}


      <div className="page-header">
        <h1>Cadastro de paciente</h1>
      </div>

      <form onSubmit={handleSubmit} className="card form-card" noValidate>

        <div className="form-section">
          <div className="form-section-header">
            <User size={16} />
            <span>Dados Pessoais</span>
          </div>
          <div className="form-grid">
            <div className={`form-group span-2${fieldErrors.has('nome_completo') ? ' field-error' : ''}`}>
              <label htmlFor="nome_completo">Nome Completo <span className="required-asterisk">*</span></label>
              <input
                id="nome_completo"
                name="nome_completo"
                type="text"
                value={form.nome_completo}
                onChange={handleChange}
                autoFocus
              />
            </div>

            <div className={`form-group${fieldErrors.has('cpf') ? ' field-error' : ''}`}>
              <label htmlFor="cpf">CPF <span className="required-asterisk">*</span></label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                value={form.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>

            <div className={`form-group${fieldErrors.has('data_nascimento') ? ' field-error' : ''}`}>
              <label>Data de Nascimento <span className="required-asterisk">*</span></label>
              <IOSDatePicker
                value={form.data_nascimento}
                onChange={val => {
                  setForm(prev => ({ ...prev, data_nascimento: val }))
                  setFieldErrors(prev => { const n = new Set(prev); n.delete('data_nascimento'); return n })
                }}
                error={fieldErrors.has('data_nascimento')}
              />
            </div>

            <div className={`form-group${fieldErrors.has('sexo') ? ' field-error' : ''}`}>
              <label>Sexo <span className="required-asterisk">*</span></label>
              <div className="sexo-radio">
                <label className="radio-label">
                  <input type="radio" name="sexo" value="F" checked={form.sexo === 'F'} onChange={handleChange} />
                  <span>F</span>
                </label>
                <label className="radio-label">
                  <input type="radio" name="sexo" value="M" checked={form.sexo === 'M'} onChange={handleChange} />
                  <span>M</span>
                </label>
                <label className="radio-label">
                  <input type="radio" name="sexo" value="Outro" checked={form.sexo === 'Outro'} onChange={handleChange} />
                  <span>Outro</span>
                </label>
              </div>
            </div>

            <div className={`form-group${fieldErrors.has('nacionalidade') ? ' field-error' : ''}`}>
              <label htmlFor="nacionalidade">Nacionalidade <span className="required-asterisk">*</span></label>
              <select id="nacionalidade" name="nacionalidade" value={form.nacionalidade} onChange={handleChange}>
                <option value="">Selecione</option>
                {NACIONALIDADES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className={`form-group${fieldErrors.has('naturalidade') ? ' field-error' : ''}`}>
              <label htmlFor="naturalidade">Naturalidade <span className="required-asterisk">*</span></label>
              <input id="naturalidade" name="naturalidade" type="text" value={form.naturalidade} onChange={handleChange} placeholder="Ex: Goiânia - GO" />
            </div>

            <div className={`form-group${fieldErrors.has('responsavel') ? ' field-error' : ''}`}>
              <label htmlFor="responsavel">Responsável{isMenor && <span className="required-asterisk"> *</span>}</label>
              <input id="responsavel" name="responsavel" type="text" value={form.responsavel} onChange={handleChange} placeholder="Nome do responsável ou mãe" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-header">
            <Phone size={16} />
            <span>Contato</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="telefone">Telefone</label>
              <input id="telefone" name="telefone" type="tel" value={form.telefone} onChange={handleChange} placeholder="(00) 00000-0000" />
            </div>
            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-header">
            <Heart size={16} />
            <span>Convênio & Escola</span>
          </div>
          <div className="form-grid">
            <div className={`form-group${fieldErrors.has('convenio') ? ' field-error' : ''}`}>
              <label htmlFor="convenio">Convênio <span className="required-asterisk">*</span></label>
              <select id="convenio" name="convenio" value={form.convenio} onChange={handleChange}>
                <option value="">Selecione</option>
                <option value="SEDUC">SEDUC</option>
              </select>
            </div>

            <div className="form-group escola-search-group">
              <label htmlFor="escola">Escola</label>
              <div className="escola-search-wrapper">
                <input
                  id="escola"
                  type="text"
                  value={escolaSearch}
                  onChange={(e) => {
                    setEscolaSearch(e.target.value)
                    setForm({ ...form, escola: e.target.value })
                    setShowEscolaDropdown(true)
                  }}
                  onFocus={() => setShowEscolaDropdown(true)}
                  onBlur={() => setTimeout(() => setShowEscolaDropdown(false), 200)}
                  placeholder="Digite ou selecione a escola"
                  autoComplete="off"
                />
                {showEscolaDropdown && escolas.filter(e => e.toLowerCase().includes(escolaSearch.toLowerCase())).length > 0 && (
                  <ul className="escola-dropdown">
                    {escolas
                      .filter(e => e.toLowerCase().includes(escolaSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(e => (
                        <li key={e} onMouseDown={() => { setForm({ ...form, escola: e }); setEscolaSearch(e); setShowEscolaDropdown(false) }}>
                          {e}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-header">
            <MapPin size={16} />
            <span>Endereço</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="cep">CEP</label>
              <input id="cep" name="cep" type="text" value={form.cep} onChange={handleChange} placeholder="00000-000" maxLength={9} />
            </div>
            <div className="form-group span-2">
              <label htmlFor="rua">Rua</label>
              <input id="rua" name="rua" type="text" value={form.rua} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="numero">Número</label>
              <input id="numero" name="numero" type="text" value={form.numero} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="complemento">Complemento</label>
              <input id="complemento" name="complemento" type="text" value={form.complemento} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="bairro">Bairro</label>
              <input id="bairro" name="bairro" type="text" value={form.bairro} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="cidade">Cidade</label>
              <input id="cidade" name="cidade" type="text" value={form.cidade} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="estado">Estado (UF)</label>
              <input id="estado" name="estado" type="text" value={form.estado} onChange={handleChange} maxLength={2} placeholder="GO" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-header">
            <FileText size={16} />
            <span>Observações</span>
          </div>
          <div className="form-grid">
            <div className="form-group span-2">
              <label htmlFor="observacoes">Observações</label>
              <textarea id="observacoes" name="observacoes" value={form.observacoes} onChange={handleChange} rows={3} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/pacientes')}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
