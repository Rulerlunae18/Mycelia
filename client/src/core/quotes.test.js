import { describe, expect, it } from 'vitest';
import { QUOTES, pickQuote } from './quotes';

describe('цитати екрана входу', () => {
  it('вибір залежить від генератора і завжди в межах списку', () => {
    expect(pickQuote(() => 0)).toBe(QUOTES[0]);
    expect(pickQuote(() => 0.999999)).toBe(QUOTES.at(-1));
  });
  it('цитати короткі й непорожні', () => {
    for (const q of QUOTES) { expect(q.length).toBeGreaterThan(10); expect(q.length).toBeLessThan(70); }
  });
});
