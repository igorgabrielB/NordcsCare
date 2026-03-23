import { Moon, Sun } from 'lucide-react';

interface ThemeSwitchProps {
  light: boolean;
  setLight: (v: boolean) => void;
}

export default function ThemeSwitch({ light, setLight }: ThemeSwitchProps) {
  return (
    <button
      onClick={() => setLight(!light)}
      title={light ? 'Modo escuro' : 'Modo claro'}
      style={{
        background: 'none',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        padding: 4,
        marginLeft: 12,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {light ? <Moon size={20} style={{color:'#7345d6'}} /> : <Sun size={20} style={{color:'#f7b500'}} />}
    </button>
  );
}
