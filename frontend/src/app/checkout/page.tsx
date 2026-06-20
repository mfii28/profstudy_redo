'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/lib/cart-context';
import { useUser, useFirestore } from '@/firebase';
import { initiateCartCheckout } from '@/app/actions/checkout';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, MapPin } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { type User as AppUser, type UserAddress } from '@/lib/db';
import {
  applyPercentDiscountToSubtotal,
  clampDiscountPercent,
  parseAffiliateRewards,
} from '@/lib/affiliate-discount';

const ADMIN_ROLES = ['admin', 'superadmin', 'subadmin'] as const;
const CHECKOUT_SHIPPING_FEE = Number(process.env.NEXT_PUBLIC_CHECKOUT_SHIPPING_FEE ?? '15');
const CHECKOUT_TAX_RATE = Number(process.env.NEXT_PUBLIC_CHECKOUT_TAX_RATE ?? '0.05');

export default function CheckoutPage() {
  const router = useRouter();
  const { cartItems, totalPrice, loading: isCartLoading } = useCart();
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [email, setEmail] = useState('');

    // Stable per-session ID for idempotency — regenerated each time the page mounts
    const [checkoutSessionId] = useState(() => `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

  const [address, setAddress] = useState<UserAddress>({
    line1: '',
    city: '',
    region: 'greater-accra',
    zip: '',
    phone: ''
  });

  const [affiliateDiscountPercent, setAffiliateDiscountPercent] = useState(0);

  const hasPhysicalProducts = cartItems.some(i => i.itemType === 'product');
  const shippingCost = hasPhysicalProducts ? CHECKOUT_SHIPPING_FEE : 0;
  const discountedSubtotal = applyPercentDiscountToSubtotal(totalPrice, affiliateDiscountPercent);
  const taxCost = discountedSubtotal * CHECKOUT_TAX_RATE;
  const finalTotal = discountedSubtotal + shippingCost + taxCost;

  useEffect(() => {
    const fetchUserData = async () => {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data() as AppUser;
          if ((ADMIN_ROLES as readonly string[]).includes(userData.role)) {
            router.replace('/admin');
            return;
          }
          setEmail(user.email || userData.email || '');
          if (userData.address) {
            setAddress(userData.address);
          }
          const rewards = parseAffiliateRewards(userData.affiliateDiscountRewards);
          setAffiliateDiscountPercent(clampDiscountPercent(rewards?.discountPercentAvailable ?? 0));
        }
      } else if (user) {
        setEmail(user.email || '');
      }
    };
    if (!isUserLoading) {
      fetchUserData();
    }
  }, [user, isUserLoading, firestore]);

  const handlePayment = async () => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Not signed in', description: 'Please sign in to complete your purchase.' });
        return;
    }
    if (!email) {
      toast({ variant: 'destructive', title: 'Email required', description: 'Please provide a valid email for the receipt.' });
      return;
    }

    setIsProcessing(true);
    try {
      const idToken = await user.getIdToken();
        const result = await initiateCartCheckout(idToken, email, finalTotal, cartItems, hasPhysicalProducts ? address : null, checkoutSessionId);

      if (result.error) {
        toast({ variant: 'destructive', title: 'Checkout Error', description: result.error });
        return;
      }

      if (result.authorization_url) {
        window.location.assign(result.authorization_url);
        return;
      }

      toast({ variant: 'destructive', title: 'Checkout Error', description: 'Could not start payment. Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="page-container py-8 md:py-12">
          <h1 className="mb-8 font-headline text-3xl font-bold text-primary md:text-4xl">
            Checkout
          </h1>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
                <Card className="border-none shadow-md">
                    <CardHeader>
                        <CardTitle className="font-headline text-xl">1. Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input 
                                  id="email" 
                                  type="email" 
                                  placeholder="you@example.com" 
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  disabled={isProcessing || isUserLoading}
                                />
                                <p className="text-xs text-muted-foreground">We'll send your purchase receipt and course access details here.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {hasPhysicalProducts && (
                    <Card className="border-none shadow-md animate-in slide-in-from-top-4">
                        <CardHeader>
                            <CardTitle className="font-headline text-xl flex items-center gap-2">
                                <MapPin size={20} className="text-primary" />
                                2. Shipping Address
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Address Line 1</Label>
                                    <Input value={address.line1} onChange={e => setAddress({...address, line1: e.target.value})} placeholder="House/Street info" disabled={isProcessing}/>
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input value={address.phone} onChange={e => setAddress({...address, phone: e.target.value})} placeholder="+233..." disabled={isProcessing} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>City</Label>
                                    <Input value={address.city} onChange={e => setAddress({...address, city: e.target.value})} placeholder="Accra" disabled={isProcessing}/>
                                </div>
                                <div className="space-y-2">
                                    <Label>Region</Label>
                                    <Input value={address.region} onChange={e => setAddress({...address, region: e.target.value})} placeholder="Greater Accra" disabled={isProcessing}/>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                 <Card className="border-none shadow-md">
                    <CardHeader>
                        <CardTitle className="font-headline text-xl">
                            {hasPhysicalProducts ? '3.' : '2.'} Payment Method
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4 p-4 border rounded-xl bg-primary/5 border-primary/20">
                          <ShieldCheck className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-bold">Secure Paystack Checkout</p>
                            <p className="text-sm text-muted-foreground">Pay with Card, Mobile Money, or Bank Transfer.</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Clicking the button below will redirect you to Paystack's secure payment portal.</p>
                    </CardContent>
                </Card>
            </div>

            <aside className="lg:col-span-1">
              <div className="sticky top-24">
                <Card className="shadow-lg border-primary/10">
                  <CardHeader>
                    <CardTitle className="font-headline">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isCartLoading ? <Loader2 className='mx-auto animate-spin' /> : cartItems.map(item => (
                         <div key={item.id} className="flex justify-between text-sm">
                            <div className="pr-4">
                              <span className="text-muted-foreground truncate">{item.title} (x{item.quantity})</span>
                              {item.itemType === 'course' && item.coursePurchaseOption === 'course_with_book' && item.attachedBookTitle && (
                                <p className="text-xs text-muted-foreground">Includes: {item.attachedBookTitle}</p>
                              )}
                            </div>
                            <span className="font-medium">GH₵{((item.price || 0) * item.quantity).toFixed(2)}</span>
                        </div>
                     ))}
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>GH₵{totalPrice.toFixed(2)}</span>
                    </div>
                    {affiliateDiscountPercent > 0 && (
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                        <span className="text-muted-foreground">Referral discount ({affiliateDiscountPercent}%)</span>
                        <span>- GH₵{(totalPrice - discountedSubtotal).toFixed(2)}</span>
                      </div>
                    )}
                    {shippingCost > 0 && (
                      <div className="flex justify-between text-success font-medium">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>GH₵{shippingCost.toFixed(2)}</span>
                      </div>
                    )}
                     <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxes ({(CHECKOUT_TAX_RATE * 100).toFixed(1)}%)</span>
                      <span>GH₵{taxCost.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg text-primary">
                      <span>Total</span>
                      <span>GH₵{finalTotal.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
                <Button 
                  size="lg" 
                  className="mt-6 w-full font-bold h-14 text-lg shadow-xl"
                  onClick={handlePayment}
                  disabled={isProcessing || isCartLoading || cartItems.length === 0}
                >
                  {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : `Pay GH₵${finalTotal.toFixed(2)}`}
                </Button>
              </div>
            </aside>
          </div>
    </div>
  );
}
