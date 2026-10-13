import * as M from '@radix-ui/react-dropdown-menu';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({ className, align = 'end', ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn('z-50 min-w-[11rem] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-pop data-[state=open]:animate-slide-up', className)} {...props} />
    </M.Portal>
  );
}

export function DropdownMenuItem({ className, icon, destructive, children, ...props }: ComponentProps<typeof M.Item> & { icon?: ReactNode; destructive?: boolean }) {
  return (
    <M.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        destructive && 'text-destructive focus:bg-destructive/10 [&_svg]:text-destructive',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </M.Item>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return <M.Label className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
