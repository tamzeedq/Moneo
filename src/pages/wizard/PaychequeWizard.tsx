import { useEffect, useRef } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMoneoData } from '@/data/hooks';
import { dayShortDate, today } from '@/domain/dates';
import { createDraft, firstInvalidStep, splitAccounts, WIZARD_STEPS, type WizardStep } from '@/domain/wizard';
import { Card } from '@/components/ui/Card';
import { btn } from '@/components/ui/styles';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { useWizard } from '@/stores/wizard';
import { StepPill } from './StepPill';
import { DetailsStep } from './DetailsStep';
import { SplitStep } from './SplitStep';
import { BudgetStep } from './BudgetStep';
import { ReviewStep } from './ReviewStep';

const TITLES: Record<WizardStep, string> = {
  details: 'Add paycheque',
  split: 'Split to accounts',
  budget: 'Budget this paycheque',
  review: 'Review',
};

const isStep = (s: string | undefined): s is WizardStep => WIZARD_STEPS.includes(s as WizardStep);

export function PaychequeWizard() {
  const { step } = useParams();
  const data = useMoneoData();
  const { draft, start } = useWizard();

  // Create a draft once per visit. Saving or cancelling clears it on the way out, and must not re-create it.
  const created = useRef(false);
  useEffect(() => {
    if (!data || created.current) return;
    created.current = true;
    if (!draft) start(createDraft(data, today()));
  }, [data, draft, start]);

  if (!isStep(step)) return <Navigate to="/paycheques/new/details" replace />;
  if (data && splitAccounts(data.accounts).length === 0) {
    return (
      <>
        <PageHeader crumb="Paycheques / New" title="Add paycheque" actions={<ThemeToggle />} />
        <Card className="flex items-center justify-between gap-4 text-[13px] text-mute">
          A paycheque is split across your accounts, so add those first.
          <Link to="/" className={btn.primary}>
            Set up accounts
          </Link>
        </Card>
      </>
    );
  }
  if (!data || !draft) return null;

  // Never land on a step past one that blocks (e.g. a reload on /review with an over-split draft).
  const blocked = firstInvalidStep(draft);
  if (blocked && WIZARD_STEPS.indexOf(step) > WIZARD_STEPS.indexOf(blocked)) {
    return <Navigate to={`/paycheques/new/${blocked}`} replace />;
  }

  const props = { data, draft };
  return (
    <>
      <PageHeader
        crumb={step === 'details' ? 'Paycheques / New' : `Paycheques / New · ${dayShortDate(draft.payDate)}`}
        title={TITLES[step]}
        actions={
          <>
            <StepPill current={step} blockedAt={blocked} />
            <ThemeToggle />
          </>
        }
      />
      {step === 'details' && <DetailsStep {...props} />}
      {step === 'split' && <SplitStep {...props} />}
      {step === 'budget' && <BudgetStep {...props} />}
      {step === 'review' && <ReviewStep {...props} />}
    </>
  );
}
