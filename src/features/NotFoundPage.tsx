import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';

export function NotFoundPage() {
  return <EmptyState className="mt-16" icon={<Compass />} title="Page not found" description="The page you are looking for doesn’t exist or has moved." action={<Link to="/dashboard" className={buttonVariants()}>Go to dashboard</Link>} />;
}
