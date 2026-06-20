'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { ImageWithFallback } from '@/components/image-with-fallback';
import { cn } from '@/lib/utils';
import { resolveMediaUrl } from '@/lib/media-url';

interface CartPanelContentProps {
  mode?: 'sheet' | 'page';
  onNavigate?: () => void;
}

export function CartPanelContent({ mode = 'sheet', onNavigate }: CartPanelContentProps) {
  const { cartItems, updateQuantity, removeFromCart, totalPrice, loading } = useCart();
  const router = useRouter();
  const isSheet = mode === 'sheet';

  const handleQuantityChange = (itemId: string, value: string) => {
    const newQuantity = parseInt(value, 10) || 1;
    if (newQuantity >= 1) {
      updateQuantity(itemId, newQuantity);
    }
  };

  const handleQuantityDecrement = (itemId: string, currentQuantity: number) => {
    if (currentQuantity > 1) {
      updateQuantity(itemId, currentQuantity - 1);
    }
  };

  const handleQuantityIncrement = (itemId: string, currentQuantity: number) => {
    updateQuantity(itemId, currentQuantity + 1);
  };

  const navigateTo = (path: string) => {
    onNavigate?.();
    router.push(path);
  };

  if (loading) {
    return (
      <Card className={cn('border-0 shadow-none', isSheet && 'h-full rounded-none')}>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-muted-foreground">Loading your cart...</p>
        </CardContent>
      </Card>
    );
  }

  if (cartItems.length === 0) {
    return (
      <Card className={cn('border-0 shadow-none', isSheet && 'h-full rounded-none')}>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <ShoppingCart size={48} className="text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Your cart is empty</h2>
          <p className="text-muted-foreground">Looks like you haven&apos;t added anything to your cart yet.</p>
          <Button onClick={() => navigateTo('/courses')}>Continue Shopping</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('grid gap-8', isSheet ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4')}>
      <div className={cn('space-y-4', !isSheet && 'lg:col-span-3')}>
        {cartItems.map((item) => {
          const resolvedImageUrl = resolveMediaUrl(item.imageUrl, '/placeholder.svg');

          return (
            <Card key={item.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <div className={cn('flex gap-4 p-4', isSheet ? 'flex-col' : 'flex-col sm:flex-row sm:gap-6')}>
                <div className={cn('relative flex-shrink-0', isSheet ? 'h-40 w-full' : 'h-40 w-full sm:h-32 sm:w-32')}>
                  <ImageWithFallback
                    src={resolvedImageUrl}
                    alt={item.title}
                    fill
                    className="rounded-md object-cover"
                    sizes="(max-width: 640px) 100vw, 128px"
                  />
                </div>

                <div className={cn('flex flex-1 gap-4', isSheet ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between')}>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-headline text-base font-bold sm:text-lg">{item.title}</h3>
                    <p className="text-sm capitalize text-muted-foreground">{item.itemType}</p>
                    {item.itemType === 'course' && (
                      <p className="text-xs text-muted-foreground">
                        {item.coursePurchaseOption === 'course_with_book' && item.attachedBookTitle
                          ? `Bundle: course + "${item.attachedBookTitle}"`
                          : 'Course only'}
                      </p>
                    )}
                    <p className="mt-1 text-lg font-bold text-primary">GH₵{(item.price || 0).toFixed(2)}</p>
                  </div>

                  {item.itemType === 'product' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityDecrement(item.id, item.quantity)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus size={16} />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="h-8 w-16 text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityIncrement(item.id, item.quantity)}
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  ) : (
                    <div className="shrink-0 text-sm text-muted-foreground">Qty: 1</div>
                  )}

                  <div className={cn('flex gap-4', isSheet ? 'items-center justify-between' : 'items-center justify-between sm:flex-col sm:items-end sm:justify-start')}>
                    <div>
                      <p className="text-sm text-muted-foreground">Subtotal</p>
                      <p className="text-lg font-bold">GH₵{((item.price || 0) * item.quantity).toFixed(2)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 size={20} />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <aside className={cn(!isSheet && 'lg:col-span-1')}>
        <div className={cn(isSheet ? '' : 'sticky top-24')}>
          <Card className={cn('shadow-lg', isSheet && 'border-primary/10 bg-muted/20')}>
            <CardHeader>
              <CardTitle className="font-headline">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items ({cartItems.length})</span>
                  <span className="font-medium">GH₵{totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="font-medium">GH₵0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">GH₵0.00</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">GH₵{totalPrice.toFixed(2)}</span>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button size="lg" className="w-full gap-2" onClick={() => navigateTo('/checkout')}>
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => navigateTo('/courses')}>
                Continue Shopping
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Secure payment via Paystack
              </p>
            </CardFooter>
          </Card>
        </div>
      </aside>
    </div>
  );
}