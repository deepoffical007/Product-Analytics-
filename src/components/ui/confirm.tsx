import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent } from './dialog';
import { Button } from './button';

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setOpts(null);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(o) => !o && close(false)}>
        {opts && (
          <DialogContent
            size="sm"
            title={
              <span className="flex items-center gap-2">
                {opts.destructive && <AlertTriangle className="size-4 text-destructive" aria-hidden />}
                {opts.title}
              </span>
            }
            footer={
              <>
                <Button variant="outline" onClick={() => close(false)}>
                  {opts.cancelLabel ?? 'Cancel'}
                </Button>
                <Button variant={opts.destructive ? 'destructive' : 'default'} onClick={() => close(true)} autoFocus>
                  {opts.confirmLabel ?? 'Confirm'}
                </Button>
              </>
            }
          >
            <div className="text-sm text-muted-foreground">{opts.description}</div>
          </DialogContent>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConfirm must be used inside ConfirmProvider');
  return c;
}
