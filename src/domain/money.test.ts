import { money, moneyParts, MINUS } from './money';

describe('money', () => {
  it('formats en-CA CAD with 2 decimals', () => {
    expect(money(4821640)).toBe('$48,216.40');
    expect(money(0)).toBe('$0.00');
  });
  it('uses a true minus sign', () => {
    expect(money(-144525)).toBe(`${MINUS}$1,445.25`);
  });
  it('supports signed deltas and 0 decimals', () => {
    expect(money(74872, { signed: true })).toBe('+$748.72');
    expect(money(-3380, { signed: true })).toBe(`${MINUS}$33.80`);
    expect(money(32000, { decimals: 0 })).toBe('$320');
    expect(money(-40, { decimals: 0 })).toBe('$0');
  });
  it('splits hero numbers', () => {
    expect(moneyParts(4821640)).toEqual({ whole: '$48,216', cents: '.40' });
  });
});
