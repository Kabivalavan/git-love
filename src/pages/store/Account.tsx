 import { useState, useEffect } from 'react';
 import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
 import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';
 import { Card, CardContent } from '@/components/ui/card';
 import { useAuth } from '@/hooks/useAuth';
 import { cn } from '@/lib/utils';
 import { ShoppingBag, MapPin, User, LogOut } from 'lucide-react';
 
 const accountLinks = [
   { path: '/account', label: 'My Orders', icon: ShoppingBag, exact: true },
   { path: '/account/addresses', label: 'Saved Addresses', icon: MapPin },
   { path: '/account/profile', label: 'Profile Settings', icon: User },
 ];
 
 export default function AccountPage() {
   const { user, signOut, isLoading } = useAuth();
   const location = useLocation();
   const navigate = useNavigate();
 
   useEffect(() => {
     if (!isLoading && !user) {
       navigate('/auth');
     }
   }, [user, isLoading, navigate]);
 
   if (isLoading) {
     return (
       <StorefrontLayout>
         <div className="container mx-auto px-4 py-8">
           <div className="animate-pulse space-y-4">
             <div className="h-8 bg-muted rounded w-1/4"></div>
             <div className="h-64 bg-muted rounded"></div>
           </div>
         </div>
       </StorefrontLayout>
     );
   }
 
   if (!user) return null;
 
   const isActive = (path: string, exact?: boolean) => {
     if (exact) return location.pathname === path;
     return location.pathname.startsWith(path);
   };
 
   return (
     <StorefrontLayout>
       <div className="container mx-auto px-4 py-8">
         <h1 className="text-2xl font-bold mb-6">My Account</h1>
         
         <div className="grid lg:grid-cols-4 gap-6">
           <Card className="lg:col-span-1 h-fit">
             <CardContent className="p-4">
               <nav className="space-y-1">
                 {accountLinks.map((link) => (
                   <Link
                     key={link.path}
                     to={link.path}
                     className={cn(
                       "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                       isActive(link.path, link.exact)
                         ? "bg-primary text-primary-foreground"
                         : "text-muted-foreground hover:bg-muted hover:text-foreground"
                     )}
                   >
                     <link.icon className="h-4 w-4" />
                     {link.label}
                   </Link>
                 ))}
                 <button
                   onClick={signOut}
                   className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full"
                 >
                   <LogOut className="h-4 w-4" />
                   Sign Out
                 </button>
               </nav>
             </CardContent>
           </Card>
 
           <div className="lg:col-span-3">
             <Outlet />
           </div>
         </div>
       </div>
     </StorefrontLayout>
   );
 }