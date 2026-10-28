import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { Cents, MoneoData, Repeats } from '@/domain/types';
import { money, moneyParts, sum } from '@/domain/money';
import { parse, shortDate, today } from '@/domain/dates';
import {
  payPeriod, periodLabel, sameAmountCount, splitAccounts, templateAllocations, validateDraft, type PaychequeDraft,
} from '@/domain/wizard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Swatch } from '@/components/ui/Avatar';
import { TickBar } from '@/components/charts/TickBar';
import { btn, field } from '@/components/ui/styles';
import { useWizard } from '@/stores/wizard';
import { WizardFooter } from './WizardFooter';

const REPEATS: { value: Repeats; label: string }[] = [
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semimonthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'One-off' },
];

export function DetailsStep({ data, draft }: { data: MoneoData; draft: PaychequeDraft }) {
  const { update, reset } = useWizard();
  const navigate = useNavigate();
  const [touched, setTouched] = useState(false);
  const errors = validateDraft(draft);
  const based = data.paycheques.find((p) => p.id === draft.basedOn);
  const period = payPeriod(draft.payDate, draft.repeats);
  const accounts = splitAccounts(data.accounts);
  const sources = [...new Set(data.paycheques.map((p) => p.source))];
  const same = sameAmountCount(data.paycheques, today(), draft.net);

  const next = () => {
    setTouched(true);
    if (!errors.net && !errors.payDate) navigate('/paycheques/new/split');
  };

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-[14px] max-lg:grid-cols-1">
        <div className="flex flex-col gap-[14px]">
          <Card className="flex flex-col gap-4 px-[22px]! py-5!">
            <CardHeader title="Details" meta={based && `Prefilled from your ${shortDate(based.payDate)} paycheque`} />
            <Field label="Net deposit" htmlFor="net">
              <NetInput
                id="net"
                value={draft.net}
                onChange={(net) => update({ net })}
                hint={same.same > 0 ? `Same as last ${same.same} of ${same.of}` : based ? 'New amount' : ''}
              />
              {touched && errors.net && <span className="text-[12px] text-acc">{errors.net}</span>}
            </Field>

            <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
              <Field label="Pay date" htmlFor="payDate">
                <DateField id="payDate" value={draft.payDate} onChange={(payDate) => update({ payDate })} />
                {touched && errors.payDate && <span className="text-[12px] text-acc">{errors.payDate}</span>}
              </Field>
              <Field label="Source" htmlFor="source">
                <div className="relative">
                  <input
                    id="source"
                    list="sources"
                    className={`${field} pr-8`}
                    value={draft.source}
                    placeholder="Employer"
                    onChange={(e) => update({ source: e.target.value })}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-faint">▾</span>
                  <datalist id="sources">
                    {sources.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </Field>
              <Field label="Deposited to" htmlFor="deposit">
                <Select
                  id="deposit"
                  label="Deposited to"
                  value={draft.depositAccountId}
                  onChange={(depositAccountId) => update({ depositAccountId })}
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
              <Field label="Pay period">
                <div className="rounded-[10px] border border-line bg-bg px-3 py-2.5 text-[14px]">{periodLabel(period.start, period.end)}</div>
              </Field>
              <Field label="Repeats" className="col-span-2 max-md:col-span-1">
                <div role="radiogroup" aria-label="Repeats" className="flex flex-wrap gap-1.5 text-[13px] whitespace-nowrap">
                  {REPEATS.map((r) => {
                    const on = draft.repeats === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => update({ repeats: r.value })}
                        className={`rounded-[10px] px-3 py-[9px] ${
                          on ? 'bg-inv text-inv-ink' : `border border-line hover:border-faint ${r.value === 'once' ? 'text-mute' : ''}`
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <Field label="Note" htmlFor="note">
              <textarea
                id="note"
                rows={1}
                className={`${field} resize-none`}
                placeholder="Optional, e.g. includes overtime"
                value={draft.note}
                onChange={(e) => update({ note: e.target.value })}
              />
            </Field>
          </Card>

          <GrossToNet draft={draft} />
        </div>

        <div className="flex flex-col gap-[14px]">
          <Templates data={data} draft={draft} />
          <RecentPaycheques data={data} draft={draft} />
        </div>
      </div>

      <WizardFooter
        left={
          <Link
            to="/"
            className={btn.secondary}
            onClick={() => {
              reset();
            }}
          >
            Cancel
          </Link>
        }
        status={`Next: split ${money(draft.net)} across ${accounts.length} accounts`}
      >
        <button type="button" className={btn.primary} onClick={next} disabled={touched && (!!errors.net || !!errors.payDate)}>
          Continue →
        </button>
      </WizardFooter>
    </>
  );
}

// ─── Net deposit ─────────────────────────────────────────────────────────────

const toRaw = (c: Cents) => (c ? (c / 100).toFixed(2).replace(/\.00$/, '') : '');

/** 40px money input with faint cents. A transparent input on top captures typing; the caret sits at the end. */
function NetInput({ id, value, onChange, hint }: { id: string; value: Cents; onChange: (c: Cents) => void; hint: string }) {
  // What's being typed while focused; otherwise the input mirrors the stored value.
  const [raw, setRaw] = useState<string | null>(null);
  const focused = raw !== null;
  const { whole, cents } = moneyParts(value);
  return (
    <div className="relative flex items-baseline justify-between gap-3 rounded-[12px] border-[1.5px] border-acc bg-bg px-4 py-3">
      <span className="text-[40px] leading-none font-medium tracking-[-0.045em]" aria-hidden>
        {whole}
        <span className="text-faint">{cents}</span>
        {focused && <span className="ml-[3px] inline-block h-8 w-0.5 animate-[blink_1s_steps(1)_infinite] bg-acc align-[-4px]" />}
      </span>
      <span className="text-[12px] text-mute">{hint}</span>
      <input
        id={id}
        autoFocus
        inputMode="decimal"
        autoComplete="off"
        className="absolute inset-0 cursor-text opacity-0"
        value={raw ?? toRaw(value)}
        onFocus={() => setRaw(toRaw(value))}
        onBlur={() => setRaw(null)}
        onChange={(e) => {
          const v = e.target.value.replace(/[$,\s]/g, '');
          if (!/^\d{0,7}(\.\d{0,2})?$/.test(v)) return;
          setRaw(v);
          onChange(Math.round(Number(v || 0) * 100));
        }}
      />
    </div>
  );
}

function DateField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex items-center justify-between rounded-[10px] border border-line bg-bg px-3 py-2.5 text-[14px] focus-within:border-acc">
      <span>{value ? format(parse(value), 'EEE, MMM d, yyyy') : <span className="text-faint">Pick a date</span>}</span>
      <span className="text-[11px] text-faint">▾</span>
      <input
        id={id}
        type="date"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value}
        onClick={(e) => e.currentTarget.showPicker?.()}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Gross to net ────────────────────────────────────────────────────────────

const DEDUCTION_COLORS = ['var(--acc)', '#d8b67a', '#8fae8f', '#7f95ab', '#a88aa6', '#c99a8e'];

function AmountInput({ value, onChange, label, negative }: { value: Cents | null; onChange: (c: Cents | null) => void; label: string; negative?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className="w-28 rounded-[6px] bg-transparent px-1 text-right outline-none hover:bg-panel2 focus:bg-panel2"
      value={text ?? (value === null ? '' : money(negative ? -value : value))}
      placeholder="—"
      onFocus={(e) => {
        setText(value === null ? '' : (value / 100).toFixed(2));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = (text ?? '').replace(/[^0-9.]/g, '');
        onChange(v === '' ? null : Math.round(Number(v) * 100));
        setText(null);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

function GrossToNet({ draft }: { draft: PaychequeDraft }) {
  const { update } = useWizard();
  const gross = draft.gross;
  const deducted = sum(draft.deductions.map((d) => d.amount));
  const net = gross === null ? null : gross - deducted;
  const mismatch = net !== null && net !== draft.net;
  const setDeduction = (i: number, amount: Cents | null) =>
    update({ deductions: draft.deductions.map((d, j) => (j === i ? { ...d, amount: amount ?? 0 } : d)) });

  return (
    <Card className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-7 px-[22px]! max-md:grid-cols-1">
      <div className="flex flex-col gap-0.5">
        <CardHeader title="Gross to net" meta="Optional" className="pb-2" />
        <Row color="var(--faint)" label="Gross pay" bold>
          <AmountInput label="Gross pay" value={gross} onChange={(g) => update({ gross: g })} />
        </Row>
        {draft.deductions.map((d, i) => (
          <Row key={d.label} color={DEDUCTION_COLORS[i % DEDUCTION_COLORS.length]} label={d.label}>
            <AmountInput label={d.label} value={d.amount} negative onChange={(c) => setDeduction(i, c)} />
          </Row>
        ))}
        <Row color="var(--inv)" label="Net deposit" bold>
          <span className="px-1">{net === null ? '—' : money(net)}</span>
        </Row>
        {mismatch && (
          <div className="pt-1 text-[11px] text-acc">Doesn’t match the net deposit of {money(draft.net)}</div>
        )}
      </div>
      {gross ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between text-[12px] text-mute">
            <span>Take-home</span>
            <span className="font-medium text-ink">{Math.round(((net ?? 0) / gross) * 100)}% of gross</span>
          </div>
          <TickBar
            total={gross}
            segments={[
              { amount: Math.max(net ?? 0, 0), color: 'var(--inv)' },
              ...draft.deductions.map((d, i) => ({ amount: d.amount, color: DEDUCTION_COLORS[i % DEDUCTION_COLORS.length] })),
            ]}
          />
          <div className="flex justify-between text-[11px] text-faint">
            <span>$0</span>
            <span>{money(gross, { decimals: 0 })}</span>
          </div>
        </div>
      ) : (
        <div className="text-[12px] text-mute">Add your gross pay to see take-home as a share of gross.</div>
      )}
    </Card>
  );
}

function Row({ color, label, bold, children }: { color: string; label: string; bold?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between border-t border-line py-1.5 text-[13px] ${bold ? 'font-medium' : ''}`}>
      <span className="flex items-center gap-2">
        <Swatch color={color} />
        {label}
      </span>
      {children}
    </div>
  );
}

// ─── Right column ────────────────────────────────────────────────────────────

function Templates({ data, draft }: { data: MoneoData; draft: PaychequeDraft }) {
  const { update } = useWizard();
  const accounts = splitAccounts(data.accounts);
  const templates = [...data.templates].sort((a, b) => a.order - b.order);
  return (
    <Card className="flex flex-col gap-2.5">
      <CardHeader title="Start the split from" meta="Templates" />
      <div role="radiogroup" aria-label="Split template" className="flex flex-col gap-2.5">
        {templates.map((t) => {
          const on = t.id === draft.templateId;
          const total = sum(Object.values(t.amounts));
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => update({ templateId: t.id, allocations: templateAllocations(t, data.accounts) })}
              className={`flex items-start gap-2.5 rounded-[12px] border px-3 py-[11px] text-left ${on ? 'border-acc bg-panel2' : 'border-line hover:border-faint'}`}
            >
              <span className={`mt-0.5 grid size-3.5 flex-none place-items-center rounded-full border-[1.5px] ${on ? 'border-acc' : 'border-faint'}`}>
                <span className={`size-1.5 rounded-full ${on ? 'bg-acc' : ''}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{t.name}</span>
                <span className="mt-0.5 block text-[11px] text-mute">{t.description}</span>
                <span className="mt-2 flex h-1 gap-0.5 overflow-hidden rounded-[2px]">
                  {total > 0 ? (
                    accounts.map((a) => <span key={a.id} style={{ flex: t.amounts[a.id] ?? 0, background: a.color }} />)
                  ) : (
                    <span className="flex-1 bg-track" />
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function RecentPaycheques({ data, draft }: { data: MoneoData; draft: PaychequeDraft }) {
  const past = [...data.paycheques]
    .filter((p) => p.payDate < draft.payDate)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))
    .slice(-6);
  const bars = [...past.map((p) => ({ date: p.payDate, net: p.net, current: false })), { date: draft.payDate, net: draft.net, current: true }];
  const max = Math.max(...bars.map((b) => b.net), 1);
  const avg = sum(bars.map((b) => b.net)) / bars.length;
  const noted = [...past].reverse().find((p) => p.note);
  return (
    <Card className="flex flex-col gap-2.5">
      <CardHeader title="Recent paycheques" meta={`avg ${money(avg, { decimals: 0 })}`} />
      <div className="flex h-24 items-end gap-2" aria-hidden>
        {bars.map((b) => (
          <div
            key={b.date}
            className="flex-1 rounded-[5px]"
            title={`${shortDate(b.date)} · ${money(b.net)}`}
            style={{ height: `${(b.net / max) * 100}%`, background: b.current ? 'var(--acc)' : 'var(--track)' }}
          />
        ))}
      </div>
      <div className="flex gap-2 text-[10px] text-faint">
        {bars.map((b) => (
          <span key={b.date} className="flex-1 text-center" style={{ color: b.current ? 'var(--acc)' : undefined }}>
            {shortDate(b.date)}
          </span>
        ))}
      </div>
      {noted && (
        <div className="border-t border-line pt-2 text-[12px] text-mute">
          {shortDate(noted.payDate)} {noted.note!.charAt(0).toLowerCase() + noted.note!.slice(1)}
        </div>
      )}
    </Card>
  );
}
