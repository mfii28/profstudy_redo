import { describe, expect, it } from 'vitest';
import { validateCartItem, validateCheckout } from './validation';

describe('validation', () => {
  it('accepts a course cart item with quantity 1', () => {
    const result = validateCartItem({
      id: 'course-1',
      title: 'Advanced Taxation',
      price: 120,
      quantity: 1,
      itemType: 'course',
    });

    expect(result.quantity).toBe(1);
    expect(result.itemType).toBe('course');
  });

  it('rejects a course cart item with quantity greater than 1', () => {
    expect(() =>
      validateCartItem({
        id: 'course-1',
        title: 'Advanced Taxation',
        price: 120,
        quantity: 2,
        itemType: 'course',
      })
    ).toThrow('Course quantity must be exactly 1.');
  });

  it('accepts a checkout payload with a product item', () => {
    const result = validateCheckout({
      userId: 'user-1',
      email: 'student@example.com',
      amount: 180,
      address: {
        line1: '12 Ring Road',
        city: 'Accra',
        region: 'Greater Accra',
        phone: '+233201234567',
      },
      items: [
        {
          id: 'product-1',
          title: 'Past Questions Pack',
          price: 180,
          quantity: 2,
          itemType: 'product',
        },
      ],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].itemType).toBe('product');
  });
});