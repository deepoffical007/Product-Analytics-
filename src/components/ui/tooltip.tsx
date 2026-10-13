import * as T from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-[60] max-w-xs rounded-md bg-slate-900 px-2.5 py-1.5 text-xs leading-relaxed text-slate-50 shadow-pop data-[state=delayed-open]:animate-fade-in dark:bg-slate-100 dark:text-slate-900">
          {content}
          <T.Arrow className="fill-slate-900 dark:fill-slate-100" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/** Small info icon with explanatory tooltip for complex metrics. */
export function InfoTip({ children, label = 'More information' }: { children: ReactNode; label?: string }) {
  return (
    <Tooltip content={children}>
      <button type="button" className="inline-flex rounded text-muted-foreground/70 transition hover:text-foreground" aria-label={label}>
        <Info className="size-3.5" />
      </button>
    </Tooltip>
  );
}
