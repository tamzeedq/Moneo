import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useMoneoData } from '@/data/hooks';
import type { MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { shortDate } from '@/domain/dates';
import { useDialogs, useUI } from '@/stores/ui';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

const GROUP_ORDER = ['Actions', 'Pages', 'Accounts', 'Charts', 'Paycheques', 'Transactions'];

function buildItems(data: MoneoData | undefined, go: (to: string) => void, openTx: () => void, toggleTheme: () => void): Item[] {
  const items: Item[] = [
    { id: 'a-paycheque', group: 'Actions', label: 'Add paycheque', run: () => go('/paycheques/new/details') },
    { id: 'a-tx', group: 'Actions', label: 'Add transaction', run: openTx },
    { id: 'a-import', group: 'Actions', label: 'Import CSV', run: () => go('/import') },
    { id: 'a-chart', group: 'Actions', label: 'New chart', run: () => go('/charts/new') },
    { id: 'a-theme', group: 'Actions', label: 'Toggle dark mode', run: toggleTheme },
    ...[
      ['Overview', '/'],
      ['Paycheques', '/paycheques'],
      ['Budget', '/budget'],
      ['Accounts', '/accounts'],
      ['Chart Studio', '/charts'],
      ['Import / Export', '/import'],
      ['Settings', '/settings'],
    ].map(([label, to]) => ({ id: 'p-' + to, group: 'Pages', label, run: () => go(to) })),
  ];
  if (!data) return items;
  for (const a of data.accounts) items.push({ id: 'acc-' + a.id, group: 'Accounts', label: a.name, hint: money(a.balance), run: () => go(`/accounts?id=${a.id}`) });
  for (const c of data.charts) items.push({ id: 'ch-' + c.id, group: 'Charts', label: c.title, hint: c.status, run: () => go(`/charts/${c.id}`) });
  for (const p of [...data.paycheques].sort((a, b) => b.payDate.localeCompare(a.payDate)).slice(0, 12))
    items.push({ id: 'pc-' + p.id, group: 'Paycheques', label: `${shortDate(p.payDate)} paycheque · ${p.source}`, hint: money(p.net), run: () => go(`/paycheques?id=${p.id}`) });
  return items;
}

function matches(label: string, q: string) {
  const l = label.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => l.includes(t));
}

/** ⌘K / Ctrl K: jump to pages, records and actions. */
export function CommandPalette() {
  const { palette: open, open: openDialog, close } = useDialogs();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (useDialogs.getState().palette) close('palette');
        else openDialog('palette');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDialog, close]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? openDialog('palette') : close('palette'))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        {/* Content unmounts when closed, so the query and selection start fresh each time. */}
        <PaletteContent />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaletteContent() {
  const data = useMoneoData();
  const navigate = useNavigate();
  const { open: openDialog, close } = useDialogs();
  const toggleTheme = useUI((s) => s.toggleTheme);
  const [q, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const setQ = (v: string) => {
    setQuery(v);
    setActive(0);
  };

  const all = useMemo(
    () =>
      buildItems(
        data,
        (to) => {
          close('palette');
          navigate(to);
        },
        () => openDialog('transaction'),
        () => {
          toggleTheme();
          close('palette');
        },
      ),
    [data, navigate, close, openDialog, toggleTheme],
  );

  const results = useMemo(() => {
    let r = q ? all.filter((i) => matches(`${i.label} ${i.group}`, q)) : all.filter((i) => i.group === 'Actions' || i.group === 'Pages');
    if (q.trim().length >= 2 && data) {
      const tx = data.transactions
        .filter((t) => matches(t.merchant, q))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map<Item>((t) => ({
          id: 'tx-' + t.id,
          group: 'Transactions',
          label: `${t.merchant} · ${shortDate(t.date)}`,
          hint: money(t.amount, { signed: true }),
          run: () => {
            close('palette');
            navigate(`/accounts?id=${t.accountId}`);
          },
        }));
      r = [...r, ...tx];
    }
    return r.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)).slice(0, 40);
  }, [all, q, data, close, navigate]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[active]?.run();
    }
  };

  return (
        <Dialog.Content
          className="fixed top-[14vh] left-1/2 z-50 flex w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-[18px] border border-line bg-panel text-ink shadow-xl"
          onKeyDown={onKeyDown}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">Search pages, accounts, charts, paycheques and transactions</Dialog.Description>
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `pi-${active}` : undefined}
            placeholder="Search or jump to…"
            className="border-b border-line bg-transparent px-[18px] py-4 text-[15px] outline-none placeholder:text-faint"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div ref={listRef} id="palette-list" role="listbox" className="max-h-[360px] overflow-y-auto p-1.5">
            {results.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-mute">No results for “{q}”</div>}
            {results.map((item, i) => (
              <div key={item.id}>
                {(i === 0 || results[i - 1].group !== item.group) && <div className="px-3 pt-2.5 pb-1 text-[11px] text-faint">{item.group}</div>}
                <div
                  id={`pi-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={item.run}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px] ${i === active ? 'bg-panel2' : ''}`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.hint && <span className="flex-none text-[12px] text-mute">{item.hint}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 border-t border-line px-[18px] py-2 text-[11px] text-faint">
            <span>↑↓ to move</span>
            <span>↵ to open</span>
            <span>esc to close</span>
          </div>
        </Dialog.Content>
  );
}
