'use client';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCart } from '@/lib/cart-context';
import { CartPanelContent } from '@/components/cart/cart-panel-content';

export function CartSheet() {
  const { isCartOpen, closeCart, cartCount } = useCart();

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => { if (!open) closeCart(); }}>
      <SheetContent side="right" className="flex h-full w-full max-w-2xl flex-col overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle>Shopping Cart</SheetTitle>
          <SheetDescription>
            {cartCount > 0 ? `${cartCount} item${cartCount === 1 ? '' : 's'} ready for checkout.` : 'Review items before you checkout.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <CartPanelContent mode="sheet" onNavigate={closeCart} />
        </div>
      </SheetContent>
    </Sheet>
  );
}