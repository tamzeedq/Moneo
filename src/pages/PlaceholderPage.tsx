import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Card } from '@/components/ui/Card';

export function PlaceholderPage({ title, crumb }: { title: string; crumb?: string }) {
  return (
    <>
      <PageHeader title={title} crumb={crumb} actions={<ThemeToggle />} />
      <Card className="text-[13px] text-mute">
        There’s nothing at this address.{' '}
        <Link to="/" className="text-acc">
          Back to Overview →
        </Link>
      </Card>
    </>
  );
}
