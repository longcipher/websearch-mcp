import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as common from './index.js';

describe('checkoutCart', () => {
  it('creates an order total and clears the cart', () => {
    const checkoutCart = Reflect.get(common, 'checkoutCart');

    expect(typeof checkoutCart).toBe('function');

    if (typeof checkoutCart !== 'function') {
      return;
    }

    const result = checkoutCart([
      { name: 'Tea', priceCents: 450, quantity: 2 },
      { name: 'Cake', priceCents: 350, quantity: 1 },
    ]);

    expect(result.order.totalCents).toBe(1250);
    expect(result.cart.items).toHaveLength(0);
  });

  it('preserves checkout invariants across generated carts', () => {
    const checkoutCart = Reflect.get(common, 'checkoutCart');

    expect(typeof checkoutCart).toBe('function');

    if (typeof checkoutCart !== 'function') {
      return;
    }

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string(),
            priceCents: fc.integer({ min: 0, max: 100_000 }),
            quantity: fc.integer({ min: 0, max: 100 }),
          }),
          { maxLength: 20 },
        ),
        (items) => {
          const result = checkoutCart(items);
          const expectedTotal = items.reduce(
            (sum, item) => sum + item.priceCents * item.quantity,
            0,
          );

          expect(result.order.items).toEqual(items);
          expect(result.order.totalCents).toBe(expectedTotal);
          expect(result.cart.items).toEqual([]);
        },
      ),
      { seed: 20260307, numRuns: 100 },
    );
  });
});
