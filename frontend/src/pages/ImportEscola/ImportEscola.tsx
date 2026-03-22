import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.ts'
import { Upload, FileSpreadsheet, ArrowLeft, X, CheckCircle2, AlertTriangle, School, Users } from 'lucide-react'
import '../Alunos/Alunos.css'
import './ImportEscola.css'

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

// --- CSV parsing utils (same as Alunos) ---

function parseCsvText(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
        else if (ch === '"') inQuotes = false
        else current += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',' || ch === ';') { result.push(current.trim()); current = '' }
        else current += ch
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
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
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
      if (aliasList.includes(norm) && !mapping[dbField]) { mapping[dbField] = csvH; break }
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

function buildParsedPatients(rows: CsvRow[], currentMapping: Record<string, string>): ParsedPatient[] {
  const cpfSeen = new Set<string>()
  return rows.map((row, idx) => {
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
      _rowIndex: idx + 2,
    }
    if (!nome) p._error = 'Nome obrigatório'
    else if (!cpf || cpf.length !== 11) p._error = 'CPF obrigatório (11 dígitos)'
    else if (!p.data_nascimento) {
      const rawDate = get('data_nascimento')
      p._error = rawDate ? `Data inválida: "${rawDate}"` : 'Data de nascimento obrigatória'
    }
    if (cpf && cpf.length === 11) {
      if (cpfSeen.has(cpf)) p._duplicate = true
      else cpfSeen.add(cpf)
    }
    return p
  })
}

// --- Component ---

export default function ImportEscola() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [allPatients, setAllPatients] = useState<ParsedPatient[]>([])
  const [schools, setSchools] = useState<{ name: string; count: number }[]>([])
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [searchSchool, setSearchSchool] = useState('')

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Selecione um arquivo .csv')
      return
    }
    setResult(null)
    setSelectedSchool(null)
    setSearchSchool('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCsvText(text)
      if (headers.length === 0 || rows.length === 0) {
        alert('Arquivo CSV vazio ou sem dados')
        return
      }
      const mapping = autoMap(headers)

      if (!mapping['escola']) {
        alert('Coluna "Escola" não encontrada no CSV. Verifique se o arquivo possui uma coluna com nome de escola.')
        return
      }

      const patients = buildParsedPatients(rows, mapping)
      setAllPatients(patients)
      setFileName(file.name)

      // Extract distinct schools
      const schoolMap = new Map<string, number>()
      for (const p of patients) {
        const escola = (p.escola ?? '').trim()
        if (escola) {
          schoolMap.set(escola, (schoolMap.get(escola) ?? 0) + 1)
        }
      }
      const sorted = Array.from(schoolMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setSchools(sorted)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const clearFile = () => {
    setFileName('')
    setAllPatients([])
    setSchools([])
    setSelectedSchool(null)
    setSearchSchool('')
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const filteredPatients = selectedSchool
    ? allPatients.filter(p => (p.escola ?? '').trim() === selectedSchool)
    : []
  const validPatients = filteredPatients.filter(p => !p._error && !p._duplicate)
  const errorCount = filteredPatients.filter(p => p._error).length
  const dupCount = filteredPatients.filter(p => p._duplicate).length

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
          message: `${data.importados} de ${payload.length} pacientes importados da escola "${selectedSchool}"`,
          details: data.erros,
        })
      } else {
        setResult({
          type: 'success',
          message: `${data.importados} pacientes da escola "${selectedSchool}" importados com sucesso!`,
        })
        // Remove imported school from list
        setSchools(prev => prev.filter(s => s.name !== selectedSchool))
        setAllPatients(prev => prev.filter(p => (p.escola ?? '').trim() !== selectedSchool))
        setSelectedSchool(null)
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

  const filteredSchools = searchSchool
    ? schools.filter(s => s.name.toLowerCase().includes(searchSchool.toLowerCase()))
    : schools

  return (
    <div className="alunos-page">
      <div className="page-header">
        <div>
          <h1>Importação por Escola</h1>
          <p>Carregue um CSV e importe pacientes separados por escola</p>
        </div>
        <Link to="/admin" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={16} /> Voltar
        </Link>
      </div>

      {result && (
        <div className={`import-result ${result.type}`}>
          {result.type === 'success' && <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />}
          {result.type !== 'success' && <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />}
          {result.message}
          {result.details && (
            <ul>
              {result.details.slice(0, 20).map((d, i) => <li key={i}>{d}</li>)}
              {result.details.length > 20 && <li>...e mais {result.details.length - 20} erros</li>}
            </ul>
          )}
        </div>
      )}

      {/* Upload area */}
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
          <h3>Arraste o CSV completo aqui</h3>
          <p>O arquivo deve ter uma coluna "Escola" para separar os alunos</p>
          <button className="btn-select" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>
            <FileSpreadsheet size={16} /> Selecionar CSV
          </button>
        </div>
      )}

      {/* File loaded + school selection */}
      {fileName && !selectedSchool && (
        <>
          <div className="csv-file-info">
            <div className="file-details">
              <FileSpreadsheet size={20} className="file-icon" />
              <span>{fileName}</span>
            </div>
            <div className="file-stats">
              <span>{allPatients.length} alunos total</span>
              <span className="stat-ok">{schools.length} escolas</span>
            </div>
            <button className="btn-clear" onClick={clearFile} title="Remover arquivo"><X size={18} /></button>
          </div>

          <div className="school-selector">
            <h3><School size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />Selecione a Escola para Importar</h3>
            {schools.length > 6 && (
              <input
                className="school-search"
                type="text"
                placeholder="Buscar escola..."
                value={searchSchool}
                onChange={(e) => setSearchSchool(e.target.value)}
                autoFocus
              />
            )}
            <div className="school-grid">
              {filteredSchools.map(s => (
                <button
                  key={s.name}
                  className="school-card"
                  onClick={() => { setSelectedSchool(s.name); setResult(null) }}
                >
                  <School size={22} className="school-card-icon" />
                  <span className="school-card-name">{s.name}</span>
                  <span className="school-card-count">
                    <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {s.count} alunos
                  </span>
                </button>
              ))}
              {filteredSchools.length === 0 && (
                <div style={{ color: '#bfab93', fontSize: '0.85rem', padding: '1rem' }}>
                  {searchSchool ? 'Nenhuma escola encontrada' : 'Nenhuma escola no CSV'}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* School selected — preview + import */}
      {fileName && selectedSchool && (
        <>
          <div className="csv-file-info">
            <div className="file-details">
              <School size={20} className="file-icon" />
              <span>{selectedSchool}</span>
            </div>
            <div className="file-stats">
              <span>{filteredPatients.length} alunos</span>
              <span className="stat-ok">{validPatients.length} válidos</span>
              {errorCount > 0 && <span className="stat-err">{errorCount} com erro</span>}
              {dupCount > 0 && <span className="stat-err">{dupCount} duplicados</span>}
            </div>
            <button
              className="btn-clear"
              onClick={() => setSelectedSchool(null)}
              title="Voltar para seleção de escolas"
            >
              <ArrowLeft size={18} />
            </button>
          </div>

          <div className="csv-preview">
            <h3>Alunos da escola "{selectedSchool}" ({filteredPatients.length})</h3>
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
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.slice(0, 100).map((p, idx) => (
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
                      <td>
                        {p._error && <span className="row-badge badge-error">{p._error}</span>}
                        {p._duplicate && <span className="row-badge badge-dup">CPF duplicado</span>}
                        {!p._error && !p._duplicate && <span style={{ color: '#68d391', fontSize: '0.75rem' }}>OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPatients.length > 100 && (
                <div style={{ padding: '0.75rem', color: '#bfab93', fontSize: '0.82rem', textAlign: 'center' }}>
                  Mostrando 100 de {filteredPatients.length} alunos
                </div>
              )}
            </div>
          </div>

          <div className="csv-actions">
            <span className="import-summary">
              {validPatients.length} alunos de "{selectedSchool}" serão importados
            </span>
            <button className="btn-cancel" onClick={() => setSelectedSchool(null)}>Voltar</button>
            <button
              className="btn-import"
              onClick={handleImport}
              disabled={importing || validPatients.length === 0}
            >
              <Upload size={16} />
              {importing ? 'Importando...' : `Importar ${validPatients.length} Alunos`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
