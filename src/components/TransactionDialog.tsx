import { useMemo, useState } from 'react';
import { useMoneoData } from '@/data/hooks';
import { repo } from '@/data/repository';
import { today } from '@/domain/dates';
import { money } from '@/domain/money';
import { merchantHistory, merchantKey, parseAmount, suggestCategory } from '@/domain/csvImport';
import { Field } from '@/components/ui/Field';
import { ModalForm } from '@/components/ui/ModalForm';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Swatch } from '@/components/ui/Avatar';
import { field } from '@/components/ui/styles';
import { useDialogs } from '@/stores/ui';
import { toast } from '@/stores/toast';
import { newId } from '@/lib/id';

const NONE = 'none';

/** "+ Transaction": add one transaction by hand. Opened from the Overview quick action or ⌘K. */
export function TransactionDialog() {
  const open = useDialogs((s) => s.transaction);
  // Mounted only while open, so every visit starts with a blank form.
  return open ? <TransactionForm /> : null;
}

function TransactionForm() {
  const data = useMoneoData();
  const close = useDialogs((s) => s.close);
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [amountText, setAmountText] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [adjust, setAdjust] = useState(true);

  const history = useMemo(() => merchantHistory(data?.transactions ?? []), [data?.transactions]);
  const merchants = useMemo(
    () => [...new Set((data?.transactions ?? []).filter((t) => t.amount < 0).map((t) => t.merchant))].sort(),
    [data?.transactions],
  );
  if (!data) return null;

  const accounts = [...data.accounts].sort((a, b) => a.order - b.order);
  if (!accounts.length) {
    return (
      <ModalForm
        open
        onOpenChange={(o) => !o && close('transaction')}
        title="Add an account first"
        description="Transactions belong to an account. Set up your accounts from the Overview, then come back."
        submitLabel="OK"
        canSubmit
        onSubmit={() => close('transaction')}
      >
        <span />
      </ModalForm>
    );
  }
  // Default to the day-to-day account when there is one.
  const account = accounts.find((a) => a.id === accountId) ?? accounts.find((a) => a.kind === 'spending') ?? accounts[0];
  const amount = parseAmount(amountText);
  const signed = amount === null ? null : (direction === 'out' ? -1 : 1) * Math.abs(amount);
  const valid = signed !== null && signed !== 0 && merchant.trim() !== '' && !!date && !!account;

  const onMerchant = (m: string) => {
    setMerchant(m);
    // Suggest a category and account from the last time this merchant appeared.
    const last = [...data.transactions].reverse().find((t) => merchantKey(t.merchant) === merchantKey(m));
    if (!categoryTouched) setCategoryId(suggestCategory(m, history, data.categories) ?? NONE);
    if (last) setAccountId(last.accountId);
  };

  const save = async () => {
    if (!valid) return;
    await repo.addTransactions(
      [
        {
          id: newId(),
          date,
          merchant: merchant.trim(),
          amount: signed!,
          accountId: account.id,
          categoryId: direction === 'out' && categoryId !== NONE ? categoryId : undefined,
        },
      ],
      { adjustBalances: adjust, date: today() },
    );
    toast(`Added ${merchant.trim()} · ${money(signed!, { signed: true })}`);
    close('transaction');
  };

  return (
    <ModalForm
      open
      onOpenChange={(o) => !o && close('transaction')}
      title="Add transaction"
      description="For spending the bank feed doesn’t cover yet. Import a CSV for many at once."
      submitLabel="Add transaction"
      canSubmit={valid}
      onSubmit={save}
    >
      <div className="flex gap-0.5 rounded-[10px] bg-seg p-[3px] text-[12px]" role="radiogroup" aria-label="Direction">
        {(['out', 'in'] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={direction === d}
            onClick={() => setDirection(d)}
            className={`flex-1 rounded-[8px] py-1.5 ${direction === d ? 'bg-nav-on font-medium text-ink shadow-tok' : 'text-mute'}`}
          >
            {d === 'out' ? 'Money out' : 'Money in'}
          </button>
        ))}
      </div>
      <Field label="Amount" htmlFor="tx-amount">
        <div className="flex items-baseline gap-1 rounded-[12px] border-[1.5px] border-acc bg-bg px-3 py-2">
          <span className="flex-none text-[24px] font-medium whitespace-nowrap text-faint">{direction === 'out' ? '−$' : '+$'}</span>
          <input
            id="tx-amount"
            autoFocus
            inputMode="decimal"
            placeholder="0.00"
            className="w-full bg-transparent text-[24px] font-medium tracking-[-0.03em] outline-none placeholder:text-faint"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,]/g, ''))}
          />
        </div>
      </Field>
      <Field label="Merchant" htmlFor="tx-merchant">
        <input
          id="tx-merchant"
          list="tx-merchants"
          className={field}
          placeholder="e.g. Loblaws"
          value={merchant}
          onChange={(e) => onMerchant(e.target.value)}
        />
        <datalist id="tx-merchants">
          {merchants.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {direction === 'out' && (
          <Field label="Category">
            <Select
              label="Category"
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v);
                setCategoryTouched(true);
              }}
              options={[
                { value: NONE, label: <span className="text-mute">Uncategorised</span> },
                ...[...data.categories]
                  .sort((a, b) => a.order - b.order)
                  .map((c) => ({
                    value: c.id,
                    label: (
                      <span className="flex items-center gap-2">
                        <Swatch color={c.color} round />
                        {c.name}
                      </span>
                    ),
                  })),
              ]}
            />
          </Field>
        )}
        <Field label="Account">
          <Select
            label="Account"
            value={account.id}
            onChange={setAccountId}
            options={accounts.map((a) => ({
              value: a.id,
              label: (
                <span className="flex items-center gap-2">
                  <Swatch color={a.color} />
                  {a.name}
                </span>
              ),
            }))}
          />
        </Field>
        <Field label="Date" htmlFor="tx-date" className={direction === 'in' ? '' : 'col-span-2'}>
          <input id="tx-date" type="date" className={field} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-[12px] bg-panel2 p-3 text-[12px]">
        <span>
          Also update the {account.name} balance
          {signed !== null && adjust && <span className="text-mute"> → {money(account.balance + signed)}</span>}
        </span>
        <Switch checked={adjust} onChange={setAdjust} label="Update balance" />
      </div>
    </ModalForm>
  );
}
