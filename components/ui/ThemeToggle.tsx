import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { getTheme, isDark, toggleTheme, watchSystemTheme } from '../../utils/theme';
import { button, cn } from './styles';

/**
 * Interruptor claro/oscuro para la barra superior.
 * Lee el estado real del DOM al montar, así coincide con lo que ya aplicó
 * el script inline de index.html (sin parpadeo ni desincronización).
 */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    setDark(isDark());
    const unwatch = watchSystemTheme();
    return unwatch;
  }, []);

  const handleClick = () => {
    toggleTheme();
    setDark(isDark());
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-pressed={dark}
      className={cn(button.base, button.variant.ghost, button.icon.md, className)}
    >
      {dark ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
    </button>
  );
};

export default ThemeToggle;
