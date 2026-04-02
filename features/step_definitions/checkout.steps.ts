import assert from 'node:assert/strict';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import {
  type CartItem,
  type CheckoutResult,
  checkoutCart,
} from '../../packages/common/src/checkout.js';

let items: CartItem[] = [];
let result: CheckoutResult | undefined;

Before(() => {
  items = [];
  result = undefined;
});

Given(
  'the cart contains {string} priced at {int} cents with quantity {int}',
  (name: string, priceCents: number, quantity: number) => {
    items.push({ name, priceCents, quantity });
  },
);

When('the customer checks out', () => {
  result = checkoutCart(items);
});

Then('an order should be created with total {int} cents', (totalCents: number) => {
  assert.ok(result);
  assert.equal(result.order.totalCents, totalCents);
});

Then('the cart should be empty', () => {
  assert.ok(result);
  assert.equal(result.cart.items.length, 0);
});
