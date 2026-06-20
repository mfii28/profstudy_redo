
'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProducts, saveProduct, deleteProduct } from '@/lib/product-data';
import { type Product } from '@/lib/db';
import { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, Trash2, Loader2, PlusCircle, Edit, ImageIcon, Upload, CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { useUser } from "@/firebase";
import { logAdminAction } from "@/lib/audit-data";
import { getPresignedUploadUrl, deleteAsset } from "@/app/actions/storage";
import { uploadToR2 } from "@/lib/upload-client";
import { resolveMediaUrl } from '@/lib/media-url';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);

export default function AdminShopProductsPage() {
    const { user: adminUser } = useUser();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setIsLoading(true);
        const fetchedProducts = await getProducts();
        setProducts(fetchedProducts);
        setIsLoading(false);
    };

    const handleOpenDialog = (product?: Product) => {
      setCurrentProduct(product ? { ...product } : { 
        title: '', 
        price: 0, 
        category: '', 
        description: '', 
        imageUrl: '', 
        imageHint: 'textbook study' 
      });
      setIsEditing(true);
    }
    
    const handleCloseDialog = () => {
        setIsEditing(false);
        setCurrentProduct(null);
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !adminUser) return;

        setIsUploading(true);
        try {
            const { url, key, error, contentType } = await getPresignedUploadUrl(
                adminUser.uid, 
                'product', 
                file.name, 
                file.type
            );

            if (error || !key || !url) throw new Error(error || 'Failed to sign upload');

            const idToken = await adminUser.getIdToken(true);
            await uploadToR2(url, file, contentType || file.type || 'application/octet-stream', {
              key,
              idToken,
            });

            setCurrentProduct(prev => prev ? { ...prev, imageUrl: key } : null);
            toast({ title: "Product Image Uploaded", description: `Image is now secured in cloud storage.` });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: err.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveProduct = async () => {
      if (!currentProduct || !currentProduct.title || currentProduct.price === undefined || !adminUser) {
          toast({ variant: 'destructive', title: 'Missing required fields' });
          return;
      }
      
      const productToSave: Product = {
        id: currentProduct.id || `product-${Date.now()}`,
        title: currentProduct.title!,
        price: Number(currentProduct.price)!,
        category: currentProduct.category || 'General',
        description: currentProduct.description || '',
        imageUrl: currentProduct.imageUrl || '',
        imageHint: currentProduct.imageHint || 'product thumbnail'
      };

      await saveProduct(productToSave);
      
      await logAdminAction({
          actorId: adminUser.uid,
          actorName: adminUser.displayName || adminUser.email || 'Administrator',
          action: currentProduct.id ? 'PRODUCT_UPDATE' : 'PRODUCT_CREATE',
          targetId: productToSave.id,
          targetType: 'product',
          severity: 'info',
          details: `${currentProduct.id ? 'Updated' : 'Created'} shop product: "${productToSave.title}".`
      });

      toast({ title: "Product Saved", description: "Marketplace inventory updated." });
      handleCloseDialog();
      fetchProducts();
    };

    const handleDeleteClick = (product: Product) => {
        setProductToDelete(product);
    };
    
    const confirmDelete = async () => {
        if (productToDelete && adminUser) {
            // Cleanup stored file if image uses a managed storage key
            if (productToDelete.imageUrl && !productToDelete.imageUrl.startsWith('http')) {
                await deleteAsset(productToDelete.imageUrl, adminUser.uid);
            }

            await deleteProduct(productToDelete.id);
            
            await logAdminAction({
                actorId: adminUser.uid,
                actorName: adminUser.displayName || adminUser.email || 'Administrator',
                action: 'PRODUCT_DELETE',
                targetId: productToDelete.id,
                targetType: 'product',
                severity: 'critical',
                details: `Permanently removed product: "${productToDelete.title}".`
            });

            toast({ title: "Product Deleted", variant: "destructive" });
            setProductToDelete(null);
            fetchProducts();
        }
    };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
                <ImageIcon className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Products & Inventory</h1>
                <p className="text-muted-foreground text-sm">
                    Manage textbooks and digital study materials secured in cloud storage.
                </p>
            </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Create Product
        </Button>
      </div>

       <Card className="border-none shadow-lg">
        <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Catalog Registry</CardTitle>
            <CardDescription>
                Live inventory of items available in the PTS Shop.
            </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                 <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                 </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-6">Product</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map(product => (
                            <TableRow key={product.id} className="group transition-colors">
                                <TableCell className="pl-6 font-medium">
                                    <div className="flex items-center gap-4">
                                        <div className="relative h-12 w-16 overflow-hidden rounded-md border bg-muted">
                                            {product.imageUrl && (
                                                <Image 
                                                    src={resolveMediaUrl(product.imageUrl)} 
                                                    alt={product.title} 
                                                    fill 
                                                    unoptimized
                                                    className="object-cover"
                                                />
                                            )}
                                        </div>
                                        <div className="max-w-xs truncate font-bold">{product.title}</div>
                                    </div>
                                </TableCell>
                                <TableCell><Badge variant="outline" className="bg-muted/50">{product.category}</Badge></TableCell>
                                <TableCell className="font-mono font-bold text-primary">{formatCurrency(product.price)}</TableCell>
                                <TableCell className="text-right pr-6 space-x-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(product)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(product)} className="text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
      
        <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete "{productToDelete?.title}". The associated image will also be removed from managed storage.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Product</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isEditing} onOpenChange={handleCloseDialog}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{currentProduct?.id ? 'Edit Product' : 'Create New Product'}</DialogTitle>
                    <DialogDescription>Fill in the details below to update your shop inventory.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Product Name</Label>
                                <Input id="title" value={currentProduct?.title || ''} onChange={(e) => setCurrentProduct(prev => ({...prev!, title: e.target.value}))} placeholder="e.g. ICAG Level 1 Textbook" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Input id="category" value={currentProduct?.category || ''} onChange={(e) => setCurrentProduct(prev => ({...prev!, category: e.target.value}))} placeholder="Textbooks" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="price">Price (GH₵)</Label>
                                    <Input id="price" type="number" value={currentProduct?.price || 0} onChange={(e) => setCurrentProduct(prev => ({...prev!, price: parseFloat(e.target.value) || 0}))} />
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Product Image (Cloud Vault)</Label>
                            <div className="relative aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-center overflow-hidden bg-muted/20 group">
                                {isUploading ? (
                                    <div className="space-y-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                        <p className="text-[10px] font-bold uppercase">Uploading...</p>
                                    </div>
                                ) : currentProduct?.imageUrl ? (
                                    <>
                                        <Image 
                                            src={resolveMediaUrl(currentProduct.imageUrl)} 
                                            alt="Preview" 
                                            fill 
                                            unoptimized
                                            className="object-cover" 
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Label htmlFor="product-image" className="cursor-pointer text-white font-bold flex items-center gap-2">
                                                <Upload className="h-4 w-4" /> Change Image
                                            </Label>
                                        </div>
                                    </>
                                ) : (
                                    <Label htmlFor="product-image" className="cursor-pointer p-4 space-y-2">
                                        <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                                        <p className="text-xs text-muted-foreground">Upload Image</p>
                                    </Label>
                                )}
                                <input 
                                    id="product-image" 
                                    type="file" 
                                    className="sr-only" 
                                    accept="image/*"
                                    onChange={handleImageUpload} 
                                    disabled={isUploading}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Marketing Description</Label>
                        <Textarea 
                            id="description" 
                            value={currentProduct?.description || ''} 
                            onChange={(e) => setCurrentProduct(prev => ({...prev!, description: e.target.value}))} 
                            placeholder="Describe the product features..."
                            rows={4} 
                        />
                    </div>
                </div>
                <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 rounded-b-lg border-t mt-4">
                    <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleSaveProduct} disabled={isUploading}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {currentProduct?.id ? 'Apply Changes' : 'Add to Catalog'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
