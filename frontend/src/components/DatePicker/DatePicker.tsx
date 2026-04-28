import { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import './DatePicker.css';

interface DatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (value: string) => void;
  placeholder?: string;
}

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DOW = ['D','S','T','Q','Q','S','S'];

function parseYMD(v: string): { y: number; m: number; d: number } | null {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function formatDisplay(v: string): string {
  const p = parseYMD(v);
  if (!p) return '';
  return `${String(p.d).padStart(2,'0')}/${String(p.m).padStart(2,'0')}/${p.y}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function firstDowOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export default function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa' }: DatePickerProps) {
  const today = new Date();
  const [open, setOpen] = useState(false);

  const initViewFromValue = () => {
    const p = parseYMD(value);
    return p ? { y: p.y, m: p.m } : { y: today.getFullYear(), m: today.getMonth() + 1 };
  };

  const [view, setView] = useState(initViewFromValue);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sync view when value changes
  useEffect(() => {
    const p = parseYMD(value);
    if (p) setView({ y: p.y, m: p.m });
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const prevMonth = () =>
    setView(v => v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 });
  const nextMonth = () =>
    setView(v => v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 });

  const selectDay = (day: number) => {
    const iso = `${view.y}-${String(view.m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    onChange(iso);
    setOpen(false);
  };

  const selected = parseYMD(value);
  const todayNum = today.getDate();
  const todayM   = today.getMonth() + 1;
  const todayY   = today.getFullYear();

  const totalDays = daysInMonth(view.y, view.m);
  const firstDow  = firstDowOfMonth(view.y, view.m);
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="dp-wrapper" ref={wrapRef}>
      <button
        type="button"
        className={`dp-trigger${open ? ' dp-open' : ''}${value ? ' dp-filled' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <CalendarDays size={13} className="dp-cal-icon" />
        <span>{value ? formatDisplay(value) : placeholder}</span>
      </button>

      {open && (
        <div className="dp-popover">
          {/* Header */}
          <div className="dp-header">
            <button type="button" className="dp-nav-btn" onClick={prevMonth}>
              <ChevronLeft size={16} />
            </button>
            <span className="dp-month-label">
              {MONTHS[view.m - 1]} {view.y}
            </span>
            <button type="button" className="dp-nav-btn" onClick={nextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day-of-week labels */}
          <div className="dp-dow-row">
            {DOW.map((d, i) => (
              <span key={i} className="dp-dow">{d}</span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="dp-grid">
            {cells.map((day, i) => {
              if (!day) return <span key={i} className="dp-cell dp-empty" />;
              const isToday    = day === todayNum && view.m === todayM && view.y === todayY;
              const isSelected = selected && day === selected.d && view.m === selected.m && view.y === selected.y;
              return (
                <button
                  key={i}
                  type="button"
                  className={`dp-cell${isToday ? ' dp-today' : ''}${isSelected ? ' dp-selected' : ''}`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer: today shortcut */}
          <div className="dp-footer">
            <button
              type="button"
              className="dp-today-btn"
              onClick={() => {
                const iso = `${todayY}-${String(todayM).padStart(2,'0')}-${String(todayNum).padStart(2,'0')}`;
                onChange(iso);
                setOpen(false);
              }}
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
