import { useNavigate } from 'react-router-dom';
import { STEP_LABELS, WIZARD_STEPS, type WizardStep } from '@/domain/wizard';

/** 4-step stepper in a `seg` pill. Current = navOn + acc number; done = ✓ on pos; future = track. */
export function StepPill({ current, blockedAt }: { current: WizardStep; blockedAt?: WizardStep }) {
  const navigate = useNavigate();
  const cur = WIZARD_STEPS.indexOf(current);
  const limit = blockedAt ? WIZARD_STEPS.indexOf(blockedAt) : WIZARD_STEPS.length - 1;
  return (
    <nav aria-label="Steps" className="flex gap-0.5 rounded-[12px] bg-seg p-[3px] text-[12px]">
      {WIZARD_STEPS.map((s, i) => {
        const state = i === cur ? 'current' : i < cur ? 'done' : 'todo';
        return (
          <button
            key={s}
            type="button"
            disabled={i > limit}
            aria-current={state === 'current' ? 'step' : undefined}
            onClick={() => navigate(`/paycheques/new/${s}`)}
            className={`flex items-center gap-[7px] rounded-[9px] py-[5px] pr-3 pl-[5px] disabled:cursor-not-allowed ${
              state === 'current' ? 'bg-nav-on text-ink shadow-tok' : state === 'done' ? 'text-ink' : 'text-mute'
            }`}
          >
            <span
              className={`grid size-[18px] place-items-center rounded-full text-[10px] font-semibold ${
                state === 'current' ? 'bg-acc text-white' : state === 'done' ? 'bg-pos text-white' : 'bg-track text-mute'
              }`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            {STEP_LABELS[s]}
          </button>
        );
      })}
    </nav>
  );
}
