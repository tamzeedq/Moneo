import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { useMoneoData } from '@/data/hooks';
import { repo, TABLES } from '@/data/repository';
import { SEED_VERSION } from '@/data/seed';
import type { MoneoData } from '@/domain/types';
import { money, sum } from '@/domain/money';
import { shortDate, today } from '@/domain/dates';
import {
  buildRows, detectColumns, detectDateOrder, rowsToTransactions, transactionsCsv, type ColumnMapping, type DateOrder,
} from '@/domain/csvImport';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { ModalForm } from '@/components/ui/ModalForm';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Swatch } from '@/components/ui/Avatar';
import { btn, chip } from '@/components/ui/styles';
import { downloadFile } from '@/lib/download';
import { toast } from '@/stores/toast';
import { newId } from '@/lib/id';

const NONE = '__none';
const SAMPLE = `Date,Description,Amount
2025-10-04,LOBLAWS #1234 TORONTO ON,-52.18
2025-10-04,TIM HORTONS #2231,-6.45
2025-10-03,PRESTO FARE/8812,-3.30
2025-10-03,LOBLAWS #1234 TORONTO ON,-86.42
2025-10-02,NETFLIX.COM,-18.99
2025-10-01,E-TRANSFER FROM ALEX,40.00
`;

interface Loaded {
  name: string;
  headers: string[];
  records: Record<string, string>[];
}

export function ImportExportPage() {
  const data = useMoneoData();
  return (
    <>
      <PageHeader title="Import / Export" actions={<ThemeToggle />} />
      {data && (
        <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-[14px] max-lg:grid-cols-1">
          <ImportCard data={data} />
          <div className="flex flex-col gap-[14px]">
            <ExportCard data={data} />
            <RestoreCard />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Import ──────────────────────────────────────────────────────────────────

function ImportCard({ data }: { data: MoneoData }) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [order, setOrder] = useState<DateOrder>('ymd');
  const [accountId, setAccountId] = useState('spending');
  const [overrides, setOverrides] = useState<Record<number, { include?: boolean; categoryId?: string }>>({});
  const [adjust, setAdjust] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = (name: string, text: string) => {
    const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
    const headers = parsed.meta.fields?.filter(Boolean) ?? [];
    if (!parsed.data.length || headers.length < 2) {
      setError('That file doesn’t look like a CSV with a header row.');
      return;
    }
    const m = detectColumns(headers);
    setError(null);
    setLoaded({ name, headers, records: parsed.data });
    setMapping(m);
    setOrder(detectDateOrder(parsed.data.map((r) => (m.date ? r[m.date] ?? '' : ''))));
    setOverrides({});
  };

  const readFile = (f: File | undefined) => {
    if (!f) return;
    f.text().then((t) => load(f.name, t));
  };

  const rows = useMemo(() => {
    if (!loaded || !mapping) return [];
    return buildRows(loaded.records, mapping, { accountId, existing: data.transactions, categories: data.categories, dateOrder: order }).map((r) => {
      const o = overrides[r.line] ?? {};
      return { ...r, include: r.error ? false : o.include ?? r.include, categoryId: o.categoryId !== undefined ? (o.categoryId === NONE ? undefined : o.categoryId) : r.categoryId };
    });
  }, [loaded, mapping, accountId, order, overrides, data.transactions, data.categories]);

  const included = rows.filter((r) => r.include);
  const dupes = rows.filter((r) => r.duplicate).length;
  const errors = rows.filter((r) => r.error).length;
  const account = data.accounts.find((a) => a.id === accountId)!;
  const cats = [...data.categories].sort((a, b) => a.order - b.order);

  const doImport = async () => {
    const txs = rowsToTransactions(included, accountId, newId);
    await repo.addTransactions(txs, { adjustBalances: adjust, date: today() });
    toast(`Imported ${txs.length} transaction${txs.length === 1 ? '' : 's'} into ${account.name}`);
    setLoaded(null);
    navigate(`/accounts?id=${accountId}`);
  };

  if (!loaded || !mapping) {
    return (
      <Card className="flex flex-col gap-4">
        <CardHeader title="Import a bank CSV" meta="Any bank that exports CSV" />
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            readFile(e.dataTransfer.files[0]);
          }}
          className={`flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed px-6 py-12 text-center ${dragging ? 'border-acc bg-panel2' : 'border-faint hover:border-mute'}`}
        >
          <span className="text-[15px] font-medium">Drop a CSV here, or choose a file</span>
          <span className="max-w-[420px] text-[12px] text-mute">
            Columns are detected automatically: date, description, and either one amount column or separate withdrawals and deposits.
            Nothing leaves this device.
          </span>
        </button>
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
        {error && <div className="text-[12px] text-acc">{error}</div>}
        <div className="flex items-center gap-3 text-[12px] text-mute">
          <button type="button" className="text-acc" onClick={() => load('sample.csv', SAMPLE)}>
            Try a sample file
          </button>
          <span>·</span>
          <button type="button" className="hover:text-ink" onClick={() => downloadFile('moneo-sample.csv', SAMPLE, 'text/csv')}>
            Download the sample
          </button>
        </div>
      </Card>
    );
  }

  const colOptions = (optional: boolean) => [...(optional ? [{ value: NONE, label: <span className="text-mute">None</span> }] : []), ...loaded.headers.map((h) => ({ value: h, label: h }))];
  const setCol = (k: keyof ColumnMapping) => (v: string) => setMapping({ ...mapping, [k]: v === NONE ? null : v });
  const split = !mapping.amount;

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader
        title={loaded.name}
        meta={
          <button type="button" className="hover:text-ink" onClick={() => setLoaded(null)}>
            Choose another file
          </button>
        }
      />
      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <Field label="Date">
          <Select label="Date column" value={mapping.date ?? NONE} onChange={setCol('date')} options={colOptions(false)} />
        </Field>
        <Field label="Description">
          <Select label="Description column" value={mapping.merchant ?? NONE} onChange={setCol('merchant')} options={colOptions(false)} />
        </Field>
        {split ? (
          <>
            <Field label="Withdrawals">
              <Select label="Withdrawals column" value={mapping.debit ?? NONE} onChange={setCol('debit')} options={colOptions(true)} />
            </Field>
            <Field label="Deposits">
              <Select label="Deposits column" value={mapping.credit ?? NONE} onChange={setCol('credit')} options={colOptions(true)} />
            </Field>
          </>
        ) : (
          <Field label="Amount">
            <Select label="Amount column" value={mapping.amount ?? NONE} onChange={setCol('amount')} options={colOptions(false)} />
          </Field>
        )}
        <Field label="Date format">
          <Select
            label="Date format"
            value={order}
            onChange={(v) => setOrder(v as DateOrder)}
            options={[
              { value: 'ymd', label: 'YYYY-MM-DD' },
              { value: 'mdy', label: 'MM/DD/YYYY' },
              { value: 'dmy', label: 'DD/MM/YYYY' },
            ]}
          />
        </Field>
        <Field label="Into account">
          <Select
            label="Into account"
            value={accountId}
            onChange={setAccountId}
            options={[...data.accounts].sort((a, b) => a.order - b.order).map((a) => ({
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
        <div className="col-span-2 flex items-end gap-1.5 max-md:col-span-2">
          <button type="button" className={chip(!split)} onClick={() => setMapping({ ...mapping, amount: mapping.amount ?? loaded.headers.find((h) => /amount/i.test(h)) ?? loaded.headers[0], debit: null, credit: null })}>
            One amount column
          </button>
          <button type="button" className={chip(split)} onClick={() => setMapping({ ...mapping, amount: null, debit: mapping.debit ?? loaded.headers[0], credit: mapping.credit ?? loaded.headers[0] })}>
            Withdrawals + deposits
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <span className="font-medium">{included.length} to import</span>
        <span className="text-mute">{rows.length} rows</span>
        {dupes > 0 && <span className="text-mute">{dupes} already in Moneo</span>}
        {errors > 0 && <span className="text-acc">{errors} unreadable</span>}
        <span className="ml-auto text-mute">Net {money(sum(included.map((r) => r.amount ?? 0)), { signed: true })}</span>
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded-[12px] border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-panel2 text-[11px] text-mute">
            <tr>
              <th className="w-9 py-2 pl-3 text-left font-normal">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={rows.some((r) => !r.error) && rows.filter((r) => !r.error).every((r) => r.include)}
                  onChange={(e) => setOverrides(Object.fromEntries(rows.filter((r) => !r.error).map((r) => [r.line, { ...overrides[r.line], include: e.target.checked }])))}
                  className="accent-[var(--acc)]"
                />
              </th>
              <th className="py-2 text-left font-normal">Date</th>
              <th className="py-2 text-left font-normal">Merchant</th>
              <th className="w-[170px] py-2 text-left font-normal">Category</th>
              <th className="py-2 pr-3 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.line} className={`border-t border-line ${r.include ? '' : 'text-mute'}`}>
                <td className="py-1.5 pl-3">
                  <input
                    type="checkbox"
                    aria-label={`Import line ${r.line}`}
                    disabled={!!r.error}
                    checked={r.include}
                    onChange={(e) => setOverrides({ ...overrides, [r.line]: { ...overrides[r.line], include: e.target.checked } })}
                    className="accent-[var(--acc)]"
                  />
                </td>
                <td className="py-1.5 whitespace-nowrap">{r.date ? shortDate(r.date) : '—'}</td>
                <td className="max-w-0 py-1.5 pr-3">
                  <div className="truncate">{r.merchant || '—'}</div>
                  {(r.error || r.duplicate) && (
                    <div className="text-[11px]" style={{ color: r.error ? 'var(--acc)' : 'var(--mute)' }}>
                      {r.error ? `Line ${r.line}: ${r.error}` : 'Already in Moneo'}
                    </div>
                  )}
                </td>
                <td className="py-1 pr-3">
                  {r.amount !== null && r.amount < 0 && !r.error ? (
                    <select
                      aria-label={`Category for ${r.merchant}`}
                      className="w-full rounded-[8px] border border-line bg-bg px-2 py-1 text-[12px] text-ink"
                      value={r.categoryId ?? NONE}
                      onChange={(e) => setOverrides({ ...overrides, [r.line]: { ...overrides[r.line], categoryId: e.target.value } })}
                    >
                      <option value={NONE}>Uncategorised</option>
                      {cats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[12px] text-mute">{r.amount !== null && r.amount > 0 ? 'Income' : ''}</span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right font-medium whitespace-nowrap" style={{ color: r.amount !== null && r.amount > 0 ? 'var(--pos)' : undefined }}>
                  {r.amount === null ? '—' : money(r.amount, { signed: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2.5 text-[12px]">
          <Switch checked={adjust} onChange={setAdjust} label="Update account balance" />
          Also update the {account.name} balance
          {adjust && included.length > 0 && (
            <span className="text-mute">→ {money(account.balance + sum(included.map((r) => r.amount ?? 0)))}</span>
          )}
        </label>
        <button type="button" className={btn.accent} disabled={!included.length} onClick={doImport}>
          Import {included.length} transaction{included.length === 1 ? '' : 's'}
        </button>
      </div>
    </Card>
  );
}

// ─── Export & restore ────────────────────────────────────────────────────────

function ExportCard({ data }: { data: MoneoData }) {
  const stamp = today();
  const backup = () =>
    downloadFile(`moneo-backup-${stamp}.json`, JSON.stringify({ app: 'moneo', format: 1, seedVersion: SEED_VERSION, exportedAt: new Date().toISOString(), data }, null, 1), 'application/json');
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Export" />
      <ExportRow label="Full backup" sub="Everything, as JSON. Restore it below." onClick={backup} action=".json" />
      <ExportRow
        label="Transactions"
        sub={`${data.transactions.length} rows, for a spreadsheet`}
        onClick={() => downloadFile(`moneo-transactions-${stamp}.csv`, transactionsCsv(data.transactions, data.categories, data.accounts), 'text/csv')}
        action=".csv"
      />
    </Card>
  );
}

function ExportRow({ label, sub, onClick, action }: { label: string; sub: string; onClick: () => void; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px]">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-[11px] text-mute">{sub}</div>
      </div>
      <button type="button" className={`${btn.secondary} px-3! py-1.5! text-[12px]!`} onClick={onClick}>
        Download {action}
      </button>
    </div>
  );
}

type Backup = { app: string; exportedAt?: string; data: MoneoData };

function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && b.app === 'moneo' && !!b.data && TABLES.every((t) => Array.isArray(b.data[t]));
}

function RestoreCard() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const read = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      if (!isBackup(parsed)) throw new Error();
      setError(null);
      setPending(parsed);
    } catch {
      setError('That isn’t a Moneo backup file.');
    }
    if (input.current) input.current.value = '';
  };
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Restore" />
      <p className="m-0 text-[12px] text-mute">Replace everything in Moneo with a backup file. Download a backup first if you want to keep what’s here.</p>
      <button type="button" className={`${btn.secondary} self-start`} onClick={() => input.current?.click()}>
        Choose backup…
      </button>
      <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
      {error && <div className="text-[12px] text-acc">{error}</div>}
      <ModalForm
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Replace all data?"
        description={`This replaces every account, paycheque, transaction and chart with the backup${pending?.exportedAt ? ` from ${new Date(pending.exportedAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}. It can’t be undone.`}
        submitLabel="Replace data"
        canSubmit
        onSubmit={async () => {
          await repo.replaceAll(pending!.data);
          setPending(null);
          toast('Backup restored');
          navigate('/');
        }}
      >
        {pending && (
          <div className="rounded-[10px] bg-panel2 p-3 text-[12px] text-mute">
            {pending.data.accounts.length} accounts · {pending.data.paycheques.length} paycheques · {pending.data.transactions.length} transactions · {pending.data.charts.length} charts
          </div>
        )}
      </ModalForm>
    </Card>
  );
}
