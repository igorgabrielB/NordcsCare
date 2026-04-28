import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api.ts'
import './PainelSenha.css'

interface Chamada {
  id: number
  senha: string | null
  nome_completo: string
  estacao: string
  estacao_label: string
  chamada_em: string
}

const ESTACAO_META: Record<string, { color: string; label: string }> = {
  acuidade:        { color: '#3b82f6', label: 'Acuidade Visual' },
  exames:          { color: '#14b8a6', label: 'Exames' },
  laudos:          { color: '#7345d6', label: 'Laudos' },
  oculos:          { color: '#ef4444', label: 'Óculos' },
  altas:           { color: '#48bb78', label: 'Alta' },
  encaminhamentos: { color: '#f59e0b', label: 'Encaminhamento' },
}

function nomeDisplay(nome: string) {
  const parts = nome.trim().split(' ')
  if (parts.length <= 2) return nome
  return `${parts[0]} ${parts[parts.length - 1]}`
}

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])
  return now
}

export default function PainelSenha() {
  const [chamadas, setChamadas] = useState<Chamada[]>([])
  const [animKey, setAnimKey] = useState(0)
  const prevTopId = useRef<number | null>(null)
  const now = useClock()

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/painel')
      const data: Chamada[] = res.data
      setChamadas(data)
      if (data.length > 0 && data[0].id !== prevTopId.current) {
        prevTopId.current = data[0].id
        setAnimKey(k => k + 1)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 3000)
    return () => clearInterval(iv)
  }, [fetchData])

  const atual = chamadas[0] ?? null
  const historico = chamadas.slice(1)
  const atualMeta = atual ? (ESTACAO_META[atual.estacao] ?? { color: '#7345d6', label: atual.estacao_label }) : null

  const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const data = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="painel-root">

      {/* ── Header ── */}
      <header className="painel-header">
        <div className="painel-header-brand">
          <div className="painel-brand-dot" />
          <span className="painel-brand-name">NordcsCare</span>
          <span className="painel-brand-sep">·</span>
          <span className="painel-brand-sub">Painel de Chamada</span>
        </div>
        <div className="painel-header-center">
          {data}
        </div>
        <div className="painel-header-clock">
          {hora}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="painel-body">

        {/* Current call */}
        <div className="painel-main">
          {atual && atualMeta ? (
            <div className="painel-current" key={animKey}>
              <p className="painel-calling-label">chamando</p>
              <div
                className="painel-senha-box"
                style={{
                  '--sc': atualMeta.color,
                  borderColor: atualMeta.color,
                } as React.CSSProperties}
              >
                <span className="painel-senha-number" style={{ color: atualMeta.color }}>
                  {atual.senha ?? '---'}
                </span>
              </div>
              <p className="painel-nome">{nomeDisplay(atual.nome_completo)}</p>
              <div
                className="painel-estacao-badge"
                style={{ background: atualMeta.color }}
              >
                {atualMeta.label}
              </div>
            </div>
          ) : (
            <div className="painel-empty">
              <div className="painel-empty-icon">◎</div>
              <p>Aguardando chamadas</p>
            </div>
          )}
        </div>

        {/* History */}
        <div className="painel-sidebar">
          <p className="painel-sidebar-title">Chamadas anteriores</p>
          <div className="painel-history-list">
            {historico.length === 0 && (
              <div className="painel-history-empty">Nenhuma chamada ainda</div>
            )}
            {historico.map((c, i) => {
              const meta = ESTACAO_META[c.estacao] ?? { color: '#7345d6', label: c.estacao_label }
              return (
                <div
                  className="painel-history-item"
                  key={c.id}
                  style={{ '--sc': meta.color, opacity: 1 - i * 0.1 } as React.CSSProperties}
                >
                  <span className="painel-hist-senha" style={{ color: meta.color }}>
                    {c.senha ?? '---'}
                  </span>
                  <span className="painel-hist-nome">{nomeDisplay(c.nome_completo)}</span>
                  <span className="painel-hist-badge" style={{ background: `${meta.color}22`, color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* ── Footer bar ── */}
      <footer className="painel-footer">
        <span>Por favor, dirija-se à estação indicada quando sua senha for chamada</span>
      </footer>

    </div>
  )
}
