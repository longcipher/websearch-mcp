export interface CartItem {
  name: string;
  priceCents: number;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
}

export interface Order {
  items: CartItem[];
  totalCents: number;
}

export interface CheckoutResult {
  order: Order;
  cart: Cart;
}

export function checkoutCart(items: readonly CartItem[]): CheckoutResult {
  const orderItems = items.map((item) => ({ ...item }));
  const totalCents = orderItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

  return {
    order: {
      items: orderItems,
      totalCents,
    },
    cart: {
      items: [],
    },
  };
}
