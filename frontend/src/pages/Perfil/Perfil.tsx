import { useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { useNavigate } from 'react-router-dom'
import { Camera, Trash2, Save, Lock, ArrowLeft, User } from 'lucide-react'
import api from '../../services/api.ts'
import './Perfil.css'

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace('/api', '')

const roleLabels: Record<string, string> = {
  master: 'Master',
  admin: 'Administrador',
  medico: 'Médico',
  administrativo: 'Administrativo',
}

const roleColors: Record<string, string> = {
  master:         'linear-gradient(135deg, #f59e0b, #d97706)',
  admin:          'linear-gradient(135deg, #7345d6, #5b2fc9)',
  medico:         'linear-gradient(135deg, #14b8a6, #0d9488)',
  administrativo: 'linear-gradient(135deg, #3b82f6, #2563eb)',
}

export default function Perfil() {
  const { user, updatePerfil } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nomeSocial, setNomeSocial] = useState(user?.nome_social ?? '')
  const [savingNome, setSavingNome] = useState(false)
  const [nomeMsg, setNomeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [fotoMsg, setFotoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [savingSenha, setSavingSenha] = useState(false)
  const [senhaMsg, setSenhaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  if (!user) return null

  const nomeDisplay = user.nome_social || user.nome
  const iniciais = nomeDisplay.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
  const fotoUrl = user.foto_perfil ? `${API_BASE}${user.foto_perfil}` : null

  // ---- Nome social ----
  const handleSaveNome = async () => {
    setSavingNome(true)
    setNomeMsg(null)
    try {
      const res = await api.put('/perfil', { nome_social: nomeSocial })
      updatePerfil({ nome_social: res.data.nome_social })
      setNomeMsg({ type: 'success', text: 'Nome atualizado!' })
    } catch {
      setNomeMsg({ type: 'error', text: 'Erro ao salvar nome' })
    } finally {
      setSavingNome(false)
    }
  }

  // ---- Foto ----
  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFoto(true)
    setFotoMsg(null)
    try {
      const form = new FormData()
      form.append('foto', file)
      const res = await api.post('/perfil/foto', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      updatePerfil({ foto_perfil: res.data.foto_perfil })
      setFotoMsg({ type: 'success', text: 'Foto atualizada!' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao enviar foto'
      setFotoMsg({ type: 'error', text: msg })
    } finally {
      setUploadingFoto(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDeleteFoto = async () => {
    setUploadingFoto(true)
    setFotoMsg(null)
    try {
      await api.delete('/perfil/foto')
      updatePerfil({ foto_perfil: null })
      setFotoMsg({ type: 'success', text: 'Foto removida' })
    } catch {
      setFotoMsg({ type: 'error', text: 'Erro ao remover foto' })
    } finally {
      setUploadingFoto(false)
    }
  }

  // ---- Senha ----
  const handleSaveSenha = async () => {
    setSavingSenha(true)
    setSenhaMsg(null)
    try {
      await api.put('/perfil/senha', { senha_atual: senhaAtual, nova_senha: novaSenha, confirmar })
      setSenhaMsg({ type: 'success', text: 'Senha alterada com sucesso!' })
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmar('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao alterar senha'
      setSenhaMsg({ type: 'error', text: msg })
    } finally {
      setSavingSenha(false)
    }
  }

  return (
    <div className="perfil-page">
      <div className="perfil-header">
        <button className="perfil-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <h1 className="perfil-title">Meu Perfil</h1>
      </div>

      <div className="perfil-grid">

        {/* Avatar + Info */}
        <div className="perfil-card perfil-avatar-card">
          <div className="perfil-avatar-wrap">
            {fotoUrl ? (
              <img src={fotoUrl} alt="Avatar" className="perfil-avatar-img" />
            ) : (
              <div className="perfil-avatar-initials" style={{ background: roleColors[user.role] ?? roleColors.admin }}>
                {iniciais}
              </div>
            )}
            <button className="perfil-avatar-overlay" onClick={() => fileRef.current?.click()} disabled={uploadingFoto} title="Alterar foto">
              <Camera size={18} />
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFotoChange} />
          </div>

          <div className="perfil-avatar-info">
            <span className="perfil-nome">{nomeDisplay}</span>
            {user.nome_social && <span className="perfil-nome-real">({user.nome})</span>}
            <span className="perfil-login">{user.login}</span>
          </div>

          {fotoUrl && (
            <button className="perfil-remove-foto-btn" onClick={handleDeleteFoto} disabled={uploadingFoto}>
              <Trash2 size={14} /> Remover foto
            </button>
          )}

          {fotoMsg && <p className={`perfil-msg ${fotoMsg.type}`}>{fotoMsg.text}</p>}
        </div>

        {/* Nome Social */}
        <div className="perfil-card">
          <div className="perfil-card-header">
            <User size={18} />
            <h2>Nome Social</h2>
          </div>
          <p className="perfil-card-desc">Como você prefere ser chamado no sistema. Deixe em branco para usar o nome completo.</p>
          <div className="perfil-field">
            <label>Nome social</label>
            <input
              type="text"
              className="perfil-input"
              placeholder={user.nome}
              value={nomeSocial}
              onChange={e => setNomeSocial(e.target.value)}
              maxLength={120}
            />
          </div>
          {nomeMsg && <p className={`perfil-msg ${nomeMsg.type}`}>{nomeMsg.text}</p>}
          <button className="perfil-save-btn" onClick={handleSaveNome} disabled={savingNome}>
            <Save size={15} /> {savingNome ? 'Salvando...' : 'Salvar nome'}
          </button>
        </div>

        {/* Alterar Senha */}
        <div className="perfil-card">
          <div className="perfil-card-header">
            <Lock size={18} />
            <h2>Alterar Senha</h2>
          </div>
          <div className="perfil-field">
            <label>Senha atual</label>
            <input type="password" className="perfil-input" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="perfil-field">
            <label>Nova senha</label>
            <input type="password" className="perfil-input" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="perfil-field">
            <label>Confirmar nova senha</label>
            <input type="password" className="perfil-input" value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password" />
          </div>
          {senhaMsg && <p className={`perfil-msg ${senhaMsg.type}`}>{senhaMsg.text}</p>}
          <button
            className="perfil-save-btn"
            onClick={handleSaveSenha}
            disabled={savingSenha || !senhaAtual || !novaSenha || !confirmar}
          >
            <Lock size={15} /> {savingSenha ? 'Salvando...' : 'Alterar senha'}
          </button>
        </div>

      </div>
    </div>
  )
}
