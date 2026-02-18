 import { useState, useEffect } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
 import { useToast } from '@/hooks/use-toast';
 import { User, Mail, Phone, Save } from 'lucide-react';
 import type { Profile } from '@/types/database';
 
 export default function ProfileSettingsPage() {
   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   const [formData, setFormData] = useState({ full_name: '', email: '', mobile_number: '' });
   const { user } = useAuth();
   const { toast } = useToast();
 
   useEffect(() => { if (user) fetchProfile(); }, [user]);
 
   const fetchProfile = async () => {
     if (!user) return;
     setIsLoading(true);
     const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
     if (data) {
       const profile = data as unknown as Profile;
       setFormData({ full_name: profile.full_name || '', email: profile.email || user.email || '', mobile_number: profile.mobile_number || '' });
     } else {
       setFormData({ full_name: '', email: user.email || '', mobile_number: '' });
     }
     setIsLoading(false);
   };
 
   const handleSave = async () => {
     if (!user) return;
     setIsSaving(true);
     const { error } = await supabase.from('profiles').upsert({ user_id: user.id, full_name: formData.full_name, email: formData.email, mobile_number: formData.mobile_number });
     if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
     else toast({ title: 'Success', description: 'Profile updated' });
     setIsSaving(false);
   };
 
   if (isLoading) return <div className="animate-pulse h-64 bg-muted rounded"></div>;
 
   return (
     <div className="space-y-6">
       <h2 className="text-xl font-semibold">Profile Settings</h2>
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Personal Information</CardTitle>
           <CardDescription>Update your personal details</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="space-y-2">
             <Label>Full Name</Label>
             <Input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="Your name" />
           </div>
           <div className="space-y-2">
             <Label>Email</Label>
             <div className="relative">
               <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="pl-10" />
             </div>
           </div>
           <div className="space-y-2">
             <Label>Mobile Number</Label>
             <div className="relative">
               <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} className="pl-10" />
             </div>
           </div>
           <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4 mr-2" />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
         </CardContent>
       </Card>
     </div>
   );
 }