import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext.tsx'
import api from '../services/api.ts'

interface EscolaHoje {
  escola: string
  data_atendimento: string
  total_alunos: number
}

interface SchoolContextType {
  selectedSchool: string | null
  setSelectedSchool: (escola: string | null) => void
  escolasHoje: EscolaHoje[]
  loadingEscolas: boolean
}

const SchoolContext = createContext<SchoolContextType | null>(null)

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [selectedSchool, setSelectedSchoolState] = useState<string | null>(() => {
    return localStorage.getItem('selectedSchool') || null
  })
  const [escolasHoje, setEscolasHoje] = useState<EscolaHoje[]>([])
  const [loadingEscolas, setLoadingEscolas] = useState(false)

  const setSelectedSchool = (escola: string | null) => {
    setSelectedSchoolState(escola)
    if (escola) {
      localStorage.setItem('selectedSchool', escola)
    } else {
      localStorage.removeItem('selectedSchool')
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    setLoadingEscolas(true)
    api.get(`/escola-agenda/hoje`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : []
        setEscolasHoje(data)
      })
      .catch(() => setEscolasHoje([]))
      .finally(() => setLoadingEscolas(false))
  }, [isAuthenticated])

  return (
    <SchoolContext.Provider value={{ selectedSchool, setSelectedSchool, escolasHoje, loadingEscolas }}>
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  const ctx = useContext(SchoolContext)
  if (!ctx) throw new Error('useSchool must be used inside SchoolProvider')
  return ctx
}
