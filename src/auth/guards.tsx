import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authFlags, useAuth } from './AuthContext';
import type { Database, User } from '@/data/types';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={authFlags.signedOut ? undefined : { from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

export function AccessDenied({ message }: { message?: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-md p-8 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
        <ShieldAlert className="size-6" />
      </div>
      <h1 className="text-lg font-semibold">Access restricted</h1>
      <p className="mt-1 text-sm text-muted-foreground">{message ?? 'Your role does not have permission to view this page. Contact HR or a Super Admin if you need access.'}</p>
      <Link to="/dashboard" className={buttonVariants({ variant: 'outline', className: 'mt-5' })}>
        Back to dashboard
      </Link>
    </Card>
  );
}

export function RequireAccess({ check, children, message }: { check: (u: User, db: Database) => boolean; children: ReactNode; message?: string }) {
  const { user, db } = useAuth();
  if (!user || !check(user, db)) return <AccessDenied message={message} />;
  return <>{children}</>;
}
