import { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, X } from 'lucide-react';
import './TimeWheelPicker.css';

interface TimeWheelPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const ITEM_H  = 44;
const PADDING = ITEM_H * 2;

function nearestMinute(raw: string): string {
  const n = parseInt(raw ?? '0', 10);
  return MINUTES.reduce((prev, cur) =>
    Math.abs(parseInt(cur) - n) < Math.abs(parseInt(prev) - n) ? cur : prev
  );
}

/* ── Single scroll-wheel column ───────────────────────────── */
function WheelColumn({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const ref   = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy  = useRef(false);

  /* Scroll to initial value once on mount */
  useEffect(() => {
    const idx = items.indexOf(value);
    if (ref.current && idx >= 0) {
      busy.current = true;
      ref.current.scrollTop = idx * ITEM_H;
      setTimeout(() => { busy.current = false; }, 200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback(() => {
    if (busy.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      onChange(items[clamped]);
    }, 80);
  }, [items, onChange]);

  const scrollTo = (item: string) => {
    const idx = items.indexOf(item);
    if (ref.current && idx >= 0) {
      ref.current.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
    }
    onChange(item);
  };

  return (
    <div className="twp-col">
      <div className="twp-scroll" ref={ref} onScroll={handleScroll}>
        <div style={{ height: PADDING }} />
        {items.map(item => (
          <div
            key={item}
            className={`twp-item ${item === value ? 'twp-active' : ''}`}
            onClick={() => scrollTo(item)}
          >
            {item}
          </div>
        ))}
        <div style={{ height: PADDING }} />
      </div>
      <div className="twp-mask" />
    </div>
  );
}

/* ── Public component ────────────────────────────────────── */
export default function TimeWheelPicker({
  value,
  onChange,
  placeholder = '--:--',
}: TimeWheelPickerProps) {
  const [open, setOpen]     = useState(false);
  const [hour, setHour]     = useState(() => value ? value.split(':')[0] : '08');
  const [minute, setMinute] = useState(() =>
    value ? nearestMinute(value.split(':')[1] ?? '00') : '00'
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Sync when value changes from outside */
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setHour(h ?? '08');
      setMinute(nearestMinute(m ?? '00'));
    }
  }, [value]);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleConfirm = () => {
    onChange(`${hour}:${minute}`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  return (
    <div className="twp-wrapper" ref={wrapRef}>
      <button
        type="button"
        className={`twp-trigger${open ? ' twp-open' : ''}${value ? ' twp-filled' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <Clock size={13} className="twp-clock-icon" />
        <span>{value ? value.slice(0, 5) : placeholder}</span>
      </button>

      {open && (
        <div className="twp-popover">
          <div className="twp-popover-header">
            <span>Horário</span>
            {value && (
              <button type="button" className="twp-clear-btn" onClick={handleClear}>
                <X size={12} /> Limpar
              </button>
            )}
          </div>

          <div className="twp-wheels">
            <WheelColumn items={HOURS}   value={hour}   onChange={setHour}   />
            <div className="twp-colon">:</div>
            <WheelColumn items={MINUTES} value={minute} onChange={setMinute} />
          </div>

          <button type="button" className="twp-confirm" onClick={handleConfirm}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}
