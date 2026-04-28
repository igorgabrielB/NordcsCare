import { useState, useRef, useEffect } from 'react'
import { CalendarDays } from 'lucide-react'
import './IOSDatePicker.css'

const ITEM_H = 44

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i)

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate()
}

interface WheelColProps {
  items: string[]
  index: number
  onChange: (i: number) => void
}

function WheelCol({ items, index, onChange }: WheelColProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const internalIdx = useRef(-1)
  const mounted = useRef(false)

  useEffect(() => {
    if (!ref.current) return
    ref.current.scrollTop = index * ITEM_H
    internalIdx.current = index
    mounted.current = true
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!mounted.current || !ref.current) return
    if (internalIdx.current === index) return
    internalIdx.current = index
    ref.current.scrollTo({ top: index * ITEM_H, behavior: 'smooth' })
  }, [index])

  const handleScroll = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!ref.current) return
      const raw = ref.current.scrollTop / ITEM_H
      const snapped = Math.max(0, Math.min(Math.round(raw), items.length - 1))
      if (Math.abs(ref.current.scrollTop - snapped * ITEM_H) > 1) {
        ref.current.scrollTo({ top: snapped * ITEM_H, behavior: 'smooth' })
      }
      if (snapped !== internalIdx.current) {
        internalIdx.current = snapped
        onChange(snapped)
      }
    }, 80)
  }

  return (
    <div className="ios-col">
      <div className="ios-fade ios-fade-top" />
      <div className="ios-fade ios-fade-bot" />
      <div className="ios-sel-bar" />
      <div className="ios-col-scroll" ref={ref} onScroll={handleScroll}>
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((item, i) => (
          <div key={i} className="ios-col-item">{item}</div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  )
}

interface Props {
  value: string           // YYYY-MM-DD or ''
  onChange: (v: string) => void
  error?: boolean
}

export default function IOSDatePicker({ value, onChange, error }: Props) {
  const [open, setOpen] = useState(false)
  const [dayIdx, setDayIdx] = useState(0)
  const [monthIdx, setMonthIdx] = useState(0)
  const [yearIdx, setYearIdx] = useState(0)
  const [textInput, setTextInput] = useState('')
  const [textError, setTextError] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const getInitialIndices = () => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number)
      const yi = YEARS.indexOf(y)
      return { d: d - 1, m: m - 1, y: yi >= 0 ? yi : 30 }
    }
    const def = new Date()
    def.setFullYear(def.getFullYear() - 30)
    const yi = YEARS.indexOf(def.getFullYear())
    return { d: def.getDate() - 1, m: def.getMonth(), y: yi >= 0 ? yi : 30 }
  }

  const openPicker = () => {
    const init = getInitialIndices()
    setDayIdx(init.d)
    setMonthIdx(init.m)
    setYearIdx(init.y)
    setTextInput(value ? formatDisplay(value) : '')
    setTextError(false)
    setOpen(true)
  }

  const formatDisplay = (v: string) => {
    const [y, m, d] = v.split('-').map(Number)
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  }

  const selectedYear = YEARS[yearIdx] ?? currentYear
  const selectedMonth = monthIdx + 1
  const totalDays = daysInMonth(selectedMonth, selectedYear)
  const DAYS = Array.from({ length: totalDays }, (_, i) => String(i + 1).padStart(2, '0'))

  // Clamp day when month/year changes
  useEffect(() => {
    if (dayIdx >= totalDays) setDayIdx(totalDays - 1)
  }, [totalDays]) // eslint-disable-line

  // Sync wheels → text input
  useEffect(() => {
    if (!open) return
    const d = String(dayIdx + 1).padStart(2, '0')
    const m = String(monthIdx + 1).padStart(2, '0')
    const y = String(selectedYear)
    setTextInput(`${d}/${m}/${y}`)
    setTextError(false)
  }, [dayIdx, monthIdx, yearIdx]) // eslint-disable-line

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    let fmt = ''
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) fmt += '/'
      fmt += digits[i]
    }
    setTextInput(fmt)
    setTextError(false)

    if (fmt.length === 10) {
      const [dd, mm, yyyy] = fmt.split('/').map(Number)
      const maxD = daysInMonth(mm, yyyy)
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= maxD && yyyy >= 1900 && yyyy <= currentYear) {
        const yi = YEARS.indexOf(yyyy)
        if (yi >= 0) {
          setDayIdx(dd - 1)
          setMonthIdx(mm - 1)
          setYearIdx(yi)
        }
      } else {
        setTextError(true)
      }
    }
  }

  const handleConfirm = () => {
    if (textError || (textInput.length > 0 && textInput.length < 10)) {
      setTextError(true)
      return
    }
    const d = String(dayIdx + 1).padStart(2, '0')
    const m = String(monthIdx + 1).padStart(2, '0')
    const y = String(selectedYear)
    onChange(`${y}-${m}-${d}`)
    setOpen(false)
  }

  const displayValue = value ? formatDisplay(value) : null

  return (
    <div className="ios-dp-wrapper" ref={wrapperRef}>
      <div
        className={`ios-date-trigger${error ? ' error' : ''}${displayValue ? '' : ' empty'}`}
        onClick={openPicker}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && openPicker()}
      >
        <CalendarDays size={16} className="ios-date-icon" />
        <span>{displayValue ?? 'Selecionar data de nascimento'}</span>
      </div>

      {open && (
        <div className="ios-picker-popup">
          <div className="ios-picker-header">
            <button type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <span>Data de Nascimento</span>
            <button type="button" className="confirm" onClick={handleConfirm}>Confirmar</button>
          </div>

          <div className="ios-text-row">
            <input
              type="text"
              inputMode="numeric"
              className={`ios-text-input${textError ? ' error' : ''}`}
              value={textInput}
              onChange={handleTextChange}
              placeholder="DD/MM/AAAA"
              maxLength={10}
              autoFocus
            />
            {textError && <span className="ios-text-error">Data inválida</span>}
          </div>

          <div className="ios-col-labels">
            <span>Dia</span>
            <span>Mês</span>
            <span>Ano</span>
          </div>

          <div className="ios-picker-wheels">
            <WheelCol items={DAYS} index={dayIdx} onChange={setDayIdx} />
            <WheelCol items={MONTHS_PT} index={monthIdx} onChange={setMonthIdx} />
            <WheelCol items={YEARS.map(String)} index={yearIdx} onChange={setYearIdx} />
          </div>
        </div>
      )}
    </div>
  )
}


