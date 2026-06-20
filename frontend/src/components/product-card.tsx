'use client';

import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { type Product } from '@/lib/db';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useCart } from '@/lib/cart-context';
import { ImageWithFallback } from '@/components/image-with-fallback';
import { resolveMediaUrl } from '@/lib/media-url';

export function ProductCard({ product, hideCart = false }: { product: Product; hideCart?: boolean }) {
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    addToCart(product);
  };

  const resolvedImageUrl = resolveMediaUrl(product.imageUrl);
  
  return (
    <motion.div whileHover={{ y: -8, transition: { duration: 0.2 } }}>
        <Card className="h-full overflow-hidden rounded-lg shadow-sm transition-shadow hover:shadow-lg">
          <CardHeader className="relative p-0">
            <Badge className="absolute left-3 top-3 z-10 bg-accent text-accent-foreground">Featured</Badge>
            <ImageWithFallback
              src={resolvedImageUrl}
              alt={product.description}
              width={600}
              height={400}
              className="aspect-video w-full object-cover"
            />
          </CardHeader>
          <CardContent className="p-4">
            <Badge variant="outline" className="mb-2">
              {product.category}
            </Badge>
            <CardTitle className="mb-1 text-lg font-headline font-bold">
              {product.title}
            </CardTitle>
            <CardDescription>
              {product.description}
            </CardDescription>
          </CardContent>
          <CardFooter className="flex items-center justify-between p-4 pt-0">
            <div className="text-xl font-bold text-primary">
              GH₵{product.price}
            </div>
            {!hideCart && (
              <Button onClick={handleAddToCart}>
                <ShoppingCart className="mr-2" /> Add to Cart
              </Button>
            )}
          </CardFooter>
        </Card>
    </motion.div>
  );
}