import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { Upload, FileSpreadsheet, ArrowLeft, Download, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import './Alunos.css'

interface CsvRow {
  [key: string]: string
}

interface ParsedPatient {
  nome_completo: string
  cpf?: string
  data_nascimento?: string
  sexo?: string
  telefone?: string
  email?: string
  cep?: string
  rua?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  convenio?: string
  escola?: string
  responsavel?: string
  numero_convenio?: string
  observacoes?: string
  _rowIndex: number
  _error?: string
  _duplicate?: boolean
}

interface ImportResult {
  type: 'success' | 'partial' | 'error'
  message: string
  details?: string[]
}

const DB_FIELDS = [
  { key: 'nome_completo', label: 'Nome Completo', required: true },
  { key: 'cpf', label: 'CPF', required: false },
  { key: 'data_nascimento', label: 'Data Nascimento', required: false },
  { key: 'sexo', label: 'Sexo', required: false },
  { key: 'telefone', label: 'Telefone', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'cep', label: 'CEP', required: false },
  { key: 'rua', label: 'Rua', required: false },
  { key: 'numero', label: 'Número', required: false },
  { key: 'complemento', label: 'Complemento', required: false },
  { key: 'bairro', label: 'Bairro', required: false },
  { key: 'cidade', label: 'Cidade', required: false },
  { key: 'estado', label: 'Estado', required: false },
  { key: 'convenio', label: 'Convênio', required: false },
  { key: 'escola', label: 'Escola', required: false },
  { key: 'responsavel', label: 'Responsável', required: false },
  { key: '_nome_da_mae', label: 'Nome da Mãe', required: false },
  { key: 'numero_convenio', label: 'Nº Convênio', required: false },
  { key: 'observacoes', label: 'Observações', required: false },
]

function parseCsvText(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  // Parse CSV respecting quoted fields
  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === ',' || ch === ';') {
          result.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    const row: CsvRow = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ''
    })
    rows.push(row)
  }
  return { headers, rows }
}

function normalizeHeader(h: string): string {
  return h.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function autoMap(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const aliases: Record<string, string[]> = {
    nome_completo: ['nome_completo', 'nome', 'name', 'aluno', 'paciente', 'nome_paciente', 'nome_aluno'],
    cpf: ['cpf', 'cpf_do_aluno', 'documento', 'doc'],
    data_nascimento: ['data_nascimento', 'data_de_nascimento', 'nascimento', 'data_nasc', 'dt_nascimento', 'dt_nasc', 'birth', 'birthday'],
    sexo: ['sexo', 'genero', 'sex', 'gender'],
    telefone: ['telefone', 'telefone_residencial', 'telefone_responsavel', 'tel', 'celular', 'phone', 'fone', 'whatsapp'],
    email: ['email', 'e_mail', 'mail'],
    cep: ['cep', 'zip', 'codigo_postal'],
    rua: ['rua', 'logradouro', 'endereco', 'street', 'address'],
    numero: ['numero', 'num', 'nro', 'number'],
    complemento: ['complemento', 'compl'],
    bairro: ['bairro', 'neighborhood'],
    cidade: ['cidade', 'city', 'municipio'],
    estado: ['estado', 'uf', 'state'],
    convenio: ['convenio', 'plano', 'insurance'],
    escola: ['escola', 'school', 'instituicao', 'colegio', 'unidade_escolar'],
    responsavel: ['responsavel', 'nome_do_responsavel', 'responsible'],
    _nome_da_mae: ['nome_da_mae', 'mae', 'nome_mae'],
    numero_convenio: ['numero_convenio', 'num_convenio', 'carteirinha'],
    observacoes: ['observacoes', 'obs', 'observacao', 'notas', 'notes'],
  }

  for (const csvH of csvHeaders) {
    const norm = normalizeHeader(csvH)
    for (const [dbField, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(norm) && !mapping[dbField]) {
        mapping[dbField] = csvH
        break
      }
    }
  }
  return mapping
}

function normalizeDate(val: string): string | undefined {
  if (!val) return undefined
  const v = val.trim()

  let day = '', month = '', year = ''

  // CSV vem no formato americano: mm/dd/yyyy
  const usMatch = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (usMatch) { month = usMatch[1]; day = usMatch[2]; year = usMatch[3] }

  // mm/dd/yy (2-digit year, formato americano)
  if (!year) {
    const usShort = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/)
    if (usShort) {
      month = usShort[1]; day = usShort[2]
      year = Number(usShort[3]) > 50 ? `19${usShort[3]}` : `20${usShort[3]}`
    }
  }

  // yyyy-mm-dd (ISO)
  if (!year) {
    const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) { year = isoMatch[1]; month = isoMatch[2]; day = isoMatch[3] }
  }

  if (!year) return undefined

  const d = Number(day), m = Number(month)
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function normalizeSexo(val: string): string | undefined {
  if (!val) return undefined
  const v = val.trim().toUpperCase()
  if (v === 'M' || v === 'MASCULINO') return 'M'
  if (v === 'F' || v === 'FEMININO') return 'F'
  return 'Outro'
}

function formatDateBR(isoDate?: string): string {
  if (!isoDate) return '—'
  const parts = isoDate.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return isoDate
}

function generateTemplate() {
  const headers = DB_FIELDS.map(f => f.label).join(';')
  const example = 'João da Silva;123.456.789-00;01/01/1990;M;(11) 99999-0000;joao@email.com;01001-000;Rua X;100;Apt 1;Centro;São Paulo;SP;SUS;Escola Municipal X;;Aluno'
  const bom = '\uFEFF'
  const blob = new Blob([bom + headers + '\n' + example + '\n'], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo_importacao_pacientes.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Alunos() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [patients, setPatients] = useState<ParsedPatient[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Selecione um arquivo .csv')
      return
    }
    setResult(null)
    setPatients([])
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCsvText(text)
      if (headers.length === 0 || rows.length === 0) {
        alert('Arquivo CSV vazio ou sem dados')
        return
      }
      setCsvHeaders(headers)
      setCsvRows(rows)
      setFileName(file.name)
      const autoMapping = autoMap(headers)
      setMapping(autoMapping)
      buildPatients(rows, autoMapping)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const buildPatients = (rows: CsvRow[], currentMapping: Record<string, string>) => {
    const cpfSeen = new Set<string>()
    const parsed: ParsedPatient[] = rows.map((row, idx) => {
      const get = (field: string) => {
        const csvCol = currentMapping[field]
        return csvCol ? (row[csvCol] ?? '').trim() : ''
      }

      const nome = get('nome_completo')
      let cpf = get('cpf').replace(/[^\d]/g, '')
      if (cpf.length === 10) cpf = '0' + cpf
      const formattedCpf = cpf.length === 11
        ? `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`
        : get('cpf') || undefined

      const p: ParsedPatient = {
        nome_completo: nome,
        cpf: formattedCpf,
        data_nascimento: normalizeDate(get('data_nascimento')),
        sexo: normalizeSexo(get('sexo')),
        telefone: get('telefone') || undefined,
        email: get('email') || undefined,
        cep: get('cep') || undefined,
        rua: get('rua') || undefined,
        numero: get('numero') || undefined,
        complemento: get('complemento') || undefined,
        bairro: get('bairro') || undefined,
        cidade: get('cidade') || undefined,
        estado: get('estado')?.toUpperCase().slice(0, 2) || undefined,
        convenio: get('convenio') || undefined,
        escola: get('escola') || undefined,
        responsavel: (() => {
          const resp = get('responsavel')
          const mae = get('_nome_da_mae')
          if (resp && mae && resp.toLowerCase() !== mae.toLowerCase()) return `${resp} (Mãe: ${mae})`
          return resp || mae || undefined
        })(),
        numero_convenio: get('numero_convenio') || undefined,
        observacoes: get('observacoes') || undefined,
        _rowIndex: idx + 2, // +2 for header row + 1-indexed
      }

      if (!nome) {
        p._error = 'Nome obrigatório'
      } else if (!cpf || cpf.length !== 11) {
        p._error = 'CPF obrigatório (11 dígitos)'
      } else if (!p.data_nascimento) {
        const rawDate = get('data_nascimento')
        p._error = rawDate ? `Data inválida: "${rawDate}"` : 'Data de nascimento obrigatória'
      }

      if (cpf && cpf.length === 11) {
        if (cpfSeen.has(cpf)) {
          p._duplicate = true
        } else {
          cpfSeen.add(cpf)
        }
      }

      return p
    })
    setPatients(parsed)
  }

  const updateMapping = (dbField: string, csvCol: string) => {
    const newMapping = { ...mapping, [dbField]: csvCol }
    setMapping(newMapping)
    buildPatients(csvRows, newMapping)
  }

  const clearFile = () => {
    setFileName('')
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setPatients([])
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const validPatients = patients.filter(p => !p._error && !p._duplicate)
  const errorCount = patients.filter(p => p._error).length
  const dupCount = patients.filter(p => p._duplicate).length

  const handleImport = async () => {
    if (validPatients.length === 0) return
    setImporting(true)
    setResult(null)
    try {
      const payload = validPatients.map(({ _rowIndex, _error, _duplicate, ...rest }) => rest)
      const res = await api.post('/pacientes/importar', { pacientes: payload })
      const data = res.data
      if (data.erros && data.erros.length > 0) {
        setResult({
          type: 'partial',
          message: `${data.importados} de ${payload.length} pacientes importados`,
          details: data.erros,
        })
      } else {
        setResult({
          type: 'success',
          message: `${data.importados} pacientes importados com sucesso!`,
        })
        clearFile()
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setResult({
        type: 'error',
        message: axiosErr.response?.data?.error || 'Erro ao importar pacientes',
      })
    } finally {
      setImporting(false)
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="alunos-page">
      <div className="page-header">
        <div>
          <h1>Inclusão de Alunos / Pacientes em Lote</h1>
          <p>Importe pacientes via arquivo CSV</p>
        </div>
        <Link to="/admin" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>
      </div>

      {result && (
        <div className={`import-result ${result.type}`}>
          {result.type === 'success' && <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />}
          {result.type === 'partial' && <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />}
          {result.type === 'error' && <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />}
          {result.message}
          {result.details && (
            <ul>
              {result.details.slice(0, 20).map((d, i) => <li key={i}>{d}</li>)}
              {result.details.length > 20 && <li>...e mais {result.details.length - 20} erros</li>}
            </ul>
          )}
        </div>
      )}

      {!fileName && (
        <div
          className={`csv-upload-area ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv" onChange={onFileChange} />
          <div className="csv-upload-icon"><Upload size={40} /></div>
          <h3>Arraste um arquivo CSV aqui</h3>
          <p>ou clique para selecionar</p>
          <button className="btn-select" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>
            <FileSpreadsheet size={16} /> Selecionar CSV
          </button>
          <br />
          <button className="csv-template-link" onClick={(e) => { e.stopPropagation(); generateTemplate() }}>
            <Download size={14} /> Baixar modelo CSV
          </button>
        </div>
      )}

      {fileName && (
        <>
          {/* File info */}
          <div className="csv-file-info">
            <div className="file-details">
              <FileSpreadsheet size={20} className="file-icon" />
              <span>{fileName}</span>
            </div>
            <div className="file-stats">
              <span>{patients.length} linhas</span>
              <span className="stat-ok">{validPatients.length} válidos</span>
              {errorCount > 0 && <span className="stat-err">{errorCount} com erro</span>}
              {dupCount > 0 && <span className="stat-err">{dupCount} duplicados</span>}
            </div>
            <button className="btn-clear" onClick={clearFile} title="Remover arquivo"><X size={18} /></button>
          </div>

          {/* Column mapping */}
          <div className="csv-mapping">
            <h3>Mapeamento de Colunas</h3>
            <div className="mapping-grid">
              {DB_FIELDS.map(f => (
                <div className="mapping-row" key={f.key}>
                  <span className="field-label">
                    {f.label} {f.required && <span className="required">*</span>}
                  </span>
                  <select
                    value={mapping[f.key] || ''}
                    onChange={(e) => updateMapping(f.key, e.target.value)}
                  >
                    <option value="">— Ignorar —</option>
                    {csvHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="csv-preview">
            <h3>Pré-visualização ({patients.length} linhas)</h3>
            <div className="csv-preview-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome Completo</th>
                    <th>CPF</th>
                    <th>Nascimento</th>
                    <th>Sexo</th>
                    <th>Telefone</th>
                    <th>Email</th>
                    <th>Cidade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.slice(0, 100).map((p, idx) => (
                    <tr
                      key={idx}
                      className={p._error ? 'row-error' : p._duplicate ? 'row-duplicate' : ''}
                    >
                      <td>{p._rowIndex}</td>
                      <td>{p.nome_completo || '—'}</td>
                      <td>{p.cpf || '—'}</td>
                      <td>{formatDateBR(p.data_nascimento)}</td>
                      <td>{p.sexo || '—'}</td>
                      <td>{p.telefone || '—'}</td>
                      <td>{p.email || '—'}</td>
                      <td>{p.cidade || '—'}</td>
                      <td>
                        {p._error && <span className="row-badge badge-error">{p._error}</span>}
                        {p._duplicate && <span className="row-badge badge-dup">CPF duplicado</span>}
                        {!p._error && !p._duplicate && <span style={{ color: '#68d391', fontSize: '0.75rem' }}>OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {patients.length > 100 && (
                <div style={{ padding: '0.75rem', color: '#bfab93', fontSize: '0.82rem', textAlign: 'center' }}>
                  Mostrando 100 de {patients.length} linhas
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="csv-actions">
            <span className="import-summary">
              {validPatients.length} pacientes serão importados
            </span>
            <button className="btn-cancel" onClick={clearFile}>Cancelar</button>
            <button
              className="btn-import"
              onClick={handleImport}
              disabled={importing || validPatients.length === 0}
            >
              <Upload size={16} />
              {importing ? 'Importando...' : `Importar ${validPatients.length} Pacientes`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
