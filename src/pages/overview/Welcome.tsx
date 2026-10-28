import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MoneoData } from '@/domain/types';
import { today } from '@/domain/dates';
import { parseAmount } from '@/domain/csvImport';
import { repo } from '@/data/repository';
import { assignFunding, STARTER_ACCOUNTS, starterAccounts } from '@/data/starter';
import { switchWorkspace } from '@/data/workspace';
import { Card } from '@/components/ui/Card';
import { Swatch } from '@/components/ui/Avatar';
import { btn, field } from '@/components/ui/styles';
import { toast } from '@/stores/toast';

/** First run in an empty workspace: pick starter accounts, or explore the demo. */
export function Welcome({ data }: { data: MoneoData }) {
  const [rows, setRows] = useState(() => STARTER_ACCOUNTS.map((starter) => ({ starter, on: starter.suggested, balance: '' })));
  const [saving, setSaving] = useState(false);
  const chosen = rows.filter((r) => r.on);

  const create = async () => {
    setSaving(true);
    const accounts = starterAccounts(
      chosen.map((r) => ({ starter: r.starter, balance: parseAmount(r.balance) ?? 0 })),
      data.accounts,
    );
    await repo.addAccounts(accounts, today());
    await repo.saveCategories(assignFunding(data.categories, accounts));
    toast(`${accounts.length} account${accounts.length === 1 ? '' : 's'} added`);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-[14px] max-lg:grid-cols-1">
      <Card className="flex flex-col gap-4 px-[22px]! py-5!">
        <div>
          <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">Welcome to Moneo</h2>
          <p className="m-0 mt-1 text-[13px] text-mute">
            Moneo plans money per paycheque: each one is split across your accounts, then the spending part is budgeted. Start with the
            accounts your paycheque goes to. Balances are optional and you can change everything later.
          </p>
        </div>
        <div className="flex flex-col">
          {rows.map((r, i) => (
            <label key={r.starter.kind} className="flex items-center gap-3 border-t border-line py-2.5 text-[13px]">
              <input
                type="checkbox"
                className="accent-[var(--acc)]"
                checked={r.on}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
              />
              <Swatch color={r.starter.color} size={10} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.starter.name}</span>
                <span className="block text-[11px] text-mute">{r.starter.purpose}</span>
              </span>
              <input
                inputMode="decimal"
                aria-label={`${r.starter.name} ${r.starter.kind === 'credit' ? 'amount owing' : 'balance'}`}
                placeholder={r.starter.kind === 'credit' ? 'Owing' : 'Balance'}
                disabled={!r.on}
                className={`${field} w-32! py-1.5! text-right text-[13px]! disabled:opacity-40`}
                value={r.balance}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, balance: e.target.value } : x)))}
              />
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-mute">Credit cards are tracked, not part of the split.</span>
          <button type="button" className={btn.accent} disabled={!chosen.length || saving} onClick={create}>
            Create {chosen.length} account{chosen.length === 1 ? '' : 's'}
          </button>
        </div>
      </Card>
      <div className="flex flex-col gap-[14px]">
        <Card className="flex flex-col gap-3">
          <div className="text-[14px] font-medium">Just looking?</div>
          <p className="m-0 text-[12px] text-mute">Explore Moneo with a year of sample data. Your own workspace stays as it is.</p>
          <button type="button" className={`${btn.primary} self-start`} onClick={() => switchWorkspace('demo')}>
            Explore with sample data
          </button>
        </Card>
        <Card className="flex flex-col gap-2 text-[12px] text-mute">
          <div className="text-[14px] font-medium text-ink">Coming from a spreadsheet or another app?</div>
          Add your accounts first, then import transactions from a bank CSV, or restore a Moneo backup.
          <Link to="/import" className="text-acc">
            Import / Export →
          </Link>
        </Card>
      </div>
    </div>
  );
}
