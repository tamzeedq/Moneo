import { assignFunding, buildStarter, STARTER_ACCOUNTS, starterAccounts } from './starter';
import { setClock, today } from '@/domain/dates';

const pick = (...kinds: string[]) => STARTER_ACCOUNTS.filter((s) => kinds.includes(s.kind)).map((starter) => ({ starter, balance: 10000 }));

describe('starter workspace', () => {
  it('has default categories and a blank template, no accounts', () => {
    const d = buildStarter();
    expect(d.accounts).toEqual([]);
    expect(d.categories.map((c) => c.name)).toContain('Groceries');
    expect(d.categories.every((c) => /^[0-9a-f-]{36}$/.test(c.id))).toBe(true);
    expect(d.templates).toHaveLength(1);
  });

  it('creates accounts in split order; credit cards are negative and not split targets', () => {
    const accounts = starterAccounts(pick('chequing', 'tfsa', 'credit'));
    expect(accounts.map((a) => [a.name, a.splitOrder, a.balance])).toEqual([
      ['Chequing', 0, 10000],
      ['TFSA', 1, 10000],
      ['Credit card', undefined, -10000],
    ]);
  });

  it('continues order after existing accounts', () => {
    const first = starterAccounts(pick('chequing'));
    const more = starterAccounts(pick('emergency'), first);
    expect(more[0]).toMatchObject({ order: 1, splitOrder: 1 });
  });

  it('funds bills from Chequing and day-to-day from Spending, falling back sensibly', () => {
    const cats = buildStarter().categories;
    const both = starterAccounts(pick('chequing', 'spending'));
    const funded = new Map(assignFunding(cats, both).map((c) => [c.name, c.fundedFrom]));
    expect(funded.get('Housing')).toBe(both[0].id);
    expect(funded.get('Groceries')).toBe(both[1].id);
    const onlyChequing = starterAccounts(pick('chequing'));
    expect(new Set(assignFunding(cats, onlyChequing).map((c) => c.fundedFrom))).toEqual(new Set([onlyChequing[0].id]));
  });
});

describe('clock', () => {
  afterEach(() => setClock(null));
  it('can be pinned and released', () => {
    setClock('2025-10-04');
    expect(today()).toBe('2025-10-04');
    setClock(null);
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today()).not.toBe('2025-10-04');
  });
});
