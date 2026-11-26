import { describe, expect, it } from 'vitest';
import { demoProductDescription, displayProductName, displayProductText, isDemoProduct, legacyProductDescription } from './product-metadata';

describe('fictional product metadata', () => {
  it('uses the exact marked product name and keeps unknown products separate', () => {
    const first = '[JEDEL FICTIONAL] Notebook Air 13';
    const second = '[DEMO] Monitor 22 FHD';
    expect(displayProductName(first)).toBe('Notebook Air 13');
    expect(isDemoProduct(first)).toBe(true);
    expect(demoProductDescription(first)).toBe('A compact 13-inch-class laptop concept for mobile office work and light presentations.');
    expect(demoProductDescription(second)).toBe('A 22-inch-class Full HD display concept for a compact workstation.');
    expect(demoProductDescription(first)).not.toBe(demoProductDescription(second));
    expect(demoProductDescription('Notebook Air 13')).toBeUndefined();
    expect(demoProductDescription('[DEMO] Unknown custom product')).toBeUndefined();
    expect(demoProductDescription('[DEMO] constructor')).toBeUndefined();
    expect(displayProductText('Compare [JEDEL FICTIONAL] Notebook and [DEMO] Monitor')).toBe('Compare Notebook and Monitor');
  });
  it('uses legacy metadata only for the matching id, name and category', () => {
    expect(legacyProductDescription(1, 'Laptop Dell', 'Electronics')).toContain('portable office work');
    expect(legacyProductDescription(2, 'Laptop Dell', 'Electronics')).toBeUndefined();
    expect(legacyProductDescription(1, 'Different laptop', 'Electronics')).toBeUndefined();
    expect(legacyProductDescription(1, 'Laptop Dell', 'Other')).toBeUndefined();
  });
});
