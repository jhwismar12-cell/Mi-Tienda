import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  wrapperClassName?: string;
}

/**
 * Reusable password/secret input with a built-in eye toggle button to show or hide characters.
 */
export const PasswordInput: React.FC<PasswordInputProps> = ({
  wrapperClassName = '',
  className = '',
  disabled,
  ...inputProps
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...inputProps}
        disabled={disabled}
        type={isVisible ? 'text' : 'password'}
        className={`${className} !pr-10`}
      />
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setIsVisible((v) => !v)}
        aria-label={isVisible ? 'Ocultar clave' : 'Mostrar clave'}
        aria-pressed={isVisible}
        title={isVisible ? 'Ocultar clave' : 'Ver clave'}
        className="absolute right-1.5 inset-y-1 px-2 flex items-center justify-center rounded-lg text-[var(--ui-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]/70 disabled:opacity-40 transition-colors cursor-pointer"
      >
        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};
