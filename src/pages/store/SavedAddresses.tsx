 import { useState, useEffect } from 'react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
 import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
 import { useToast } from '@/hooks/use-toast';
 import { Plus, MapPin, Pencil, Trash2, Star } from 'lucide-react';
 import type { Address } from '@/types/database';
 
 export default function SavedAddressesPage() {
   const [addresses, setAddresses] = useState<Address[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [editingAddress, setEditingAddress] = useState<Address | null>(null);
   const [isSaving, setIsSaving] = useState(false);
   const [formData, setFormData] = useState({ full_name: '', mobile_number: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', landmark: '', label: 'Home' });
   const { user } = useAuth();
   const { toast } = useToast();
 
   useEffect(() => { if (user) fetchAddresses(); }, [user]);
 
   const fetchAddresses = async () => {
     if (!user) return;
     setIsLoading(true);
     const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false });
     setAddresses((data || []) as unknown as Address[]);
     setIsLoading(false);
   };
 
   const handleOpenDialog = (address?: Address) => {
     if (address) {
       setEditingAddress(address);
       setFormData({ full_name: address.full_name, mobile_number: address.mobile_number, address_line1: address.address_line1, address_line2: address.address_line2 || '', city: address.city, state: address.state, pincode: address.pincode, landmark: address.landmark || '', label: address.label });
     } else {
       setEditingAddress(null);
       setFormData({ full_name: '', mobile_number: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', landmark: '', label: 'Home' });
     }
     setIsDialogOpen(true);
   };
 
   const handleSave = async () => {
     if (!user || !formData.full_name || !formData.address_line1 || !formData.city || !formData.pincode) {
       toast({ title: 'Error', description: 'Please fill required fields', variant: 'destructive' });
       return;
     }
     setIsSaving(true);
     if (editingAddress) {
       await supabase.from('addresses').update(formData).eq('id', editingAddress.id);
     } else {
       await supabase.from('addresses').insert({ ...formData, user_id: user.id, is_default: addresses.length === 0 });
     }
     toast({ title: 'Success', description: editingAddress ? 'Address updated' : 'Address added' });
     setIsDialogOpen(false);
     setIsSaving(false);
     fetchAddresses();
   };
 
   const handleDelete = async (id: string) => {
     await supabase.from('addresses').delete().eq('id', id);
     toast({ title: 'Deleted' });
     fetchAddresses();
   };
 
   const handleSetDefault = async (id: string) => {
     if (!user) return;
     await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
     await supabase.from('addresses').update({ is_default: true }).eq('id', id);
     fetchAddresses();
   };
 
   if (isLoading) return <div className="space-y-4">{[1,2].map(i => <div key={i} className="animate-pulse h-32 bg-muted rounded-lg"></div>)}</div>;
 
   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between">
         <h2 className="text-xl font-semibold">Saved Addresses</h2>
         <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
           <DialogTrigger asChild><Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />Add Address</Button></DialogTrigger>
           <DialogContent className="max-w-lg">
             <DialogHeader><DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle></DialogHeader>
             <div className="space-y-4 mt-4">
               <div className="grid grid-cols-2 gap-4">
                 <div><Label>Full Name *</Label><Input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} /></div>
                 <div><Label>Mobile *</Label><Input value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} /></div>
               </div>
               <div><Label>Address Line 1 *</Label><Input value={formData.address_line1} onChange={e => setFormData({...formData, address_line1: e.target.value})} /></div>
               <div><Label>Address Line 2</Label><Input value={formData.address_line2} onChange={e => setFormData({...formData, address_line2: e.target.value})} /></div>
               <div className="grid grid-cols-3 gap-4">
                 <div><Label>City *</Label><Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                 <div><Label>State *</Label><Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} /></div>
                 <div><Label>Pincode *</Label><Input value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} /></div>
               </div>
               <Button className="w-full" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Address'}</Button>
             </div>
           </DialogContent>
         </Dialog>
       </div>
       {addresses.length === 0 ? (
         <Card><CardContent className="py-12 text-center"><MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-semibold mb-2">No addresses saved</h3></CardContent></Card>
       ) : (
         <div className="grid gap-4">
           {addresses.map(addr => (
             <Card key={addr.id}><CardContent className="p-4">
               <div className="flex items-start justify-between">
                 <div className="space-y-1">
                   <div className="flex items-center gap-2">
                     <span className="font-semibold">{addr.full_name}</span>
                     <Badge variant="outline">{addr.label}</Badge>
                     {addr.is_default && <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />Default</Badge>}
                   </div>
                   <p className="text-sm text-muted-foreground">{addr.address_line1}, {addr.city}, {addr.state} - {addr.pincode}</p>
                   <p className="text-sm text-muted-foreground">Phone: {addr.mobile_number}</p>
                 </div>
                 <div className="flex items-center gap-2">
                   {!addr.is_default && <Button variant="ghost" size="sm" onClick={() => handleSetDefault(addr.id)}>Set Default</Button>}
                   <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(addr)}><Pencil className="h-4 w-4" /></Button>
                   <AlertDialog>
                     <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                     <AlertDialogContent>
                       <AlertDialogHeader><AlertDialogTitle>Delete Address?</AlertDialogTitle></AlertDialogHeader>
                       <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(addr.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                     </AlertDialogContent>
                   </AlertDialog>
                 </div>
               </div>
             </CardContent></Card>
           ))}
         </div>
       )}
     </div>
   );
 }