import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyPathButtonProps {
  path: string;
  label?: string;
  ariaLabel?: string;
}

/**
 * Compact button that copies a workspace-relative file path to the clipboard and shows brief
 * Vietnamese confirmation feedback.
 *
 * @param props - Target path, optional visible label, and optional accessible label.
 * @returns Rendered copy-to-clipboard button.
 */
export function CopyPathButton({
  path,
  label = 'Sao chép đường dẫn',
  ariaLabel,
}: CopyPathButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy(): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(path);
      }
    } catch {
      // Clipboard API may be blocked in restricted contexts; still avoid crashing the UI.
    }
    setCopied(true);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={ariaLabel ?? `${label}: ${path}`}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
        copied
          ? 'border-safe-500/50 bg-safe-950/60 text-safe-200'
          : 'border-slate-700 bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-safe-400" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3 text-slate-400" aria-hidden="true" />
      )}
      <span>{copied ? 'Đã chép' : label}</span>
    </button>
  );
}
