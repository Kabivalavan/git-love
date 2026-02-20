import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { ShoppingBag, ArrowLeft, Phone, Lock, User as UserIcon, Mail } from 'lucide-react';

const loginSchema = z.object({
  mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function CustomerAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const mobileToEmail = (mobile: string) => `${mobile.replace(/[^0-9]/g, '')}@mobile.user`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = loginSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const authEmail = mobileToEmail(formData.mobileNumber);
        const { error } = await signIn(authEmail, formData.password);
        if (error) {
          toast({ title: 'Login failed', description: 'Invalid mobile number or password', variant: 'destructive' });
        } else {
          toast({ title: 'Welcome back!' });
          navigate('/');
        }
      } else {
        const result = signupSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const authEmail = mobileToEmail(formData.mobileNumber);
        const { error } = await signUp(authEmail, formData.password, formData.mobileNumber, formData.fullName, formData.email);

        if (error) {
          if (error.message?.includes('already registered') || error.message?.includes('already been registered')) {
            toast({ title: 'Account exists', description: 'This mobile number is already registered. Please login instead.', variant: 'destructive' });
          } else if (error.message?.includes('User already registered')) {
            toast({ title: 'Account exists', description: 'This mobile number is already registered. Please login instead.', variant: 'destructive' });
          } else {
            toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
          }
        } else {
          toast({ title: 'Account created!', description: 'You can now login with your mobile number.' });
          setIsLogin(true);
          setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-900 via-primary/20 to-slate-900">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Floating icons */}
        <ShoppingBag className="absolute top-[10%] left-[8%] h-10 w-10 text-primary/20 rotate-12 animate-bounce" style={{ animationDuration: '3s' }} />
        <ShoppingBag className="absolute top-[65%] right-[10%] h-14 w-14 text-primary/15 -rotate-12 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <ShoppingBag className="absolute bottom-[15%] left-[15%] h-8 w-8 text-primary/20 rotate-45 animate-bounce" style={{ animationDuration: '5s', animationDelay: '2s' }} />
        <ShoppingBag className="absolute top-[30%] right-[25%] h-6 w-6 text-primary/10 -rotate-6 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 py-8">
        <Card className="border-white/10 shadow-2xl backdrop-blur-md bg-black/50">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                <ShoppingBag className="h-7 w-7 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <CardDescription className="text-white/60 text-sm">
              {isLogin ? 'Sign in with your mobile number' : 'Start shopping in minutes'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleSubmit} className="space-y-3">
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-medium text-white/80">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input id="fullName" name="fullName" placeholder="Enter your full name" value={formData.fullName} onChange={handleChange} className="pl-9 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-primary" />
                  </div>
                  {errors.fullName && <p className="text-xs text-red-400">{errors.fullName}</p>}
                </div>
              )}
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-white/80">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input id="email" name="email" type="email" placeholder="Enter your email address" value={formData.email} onChange={handleChange} className="pl-9 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-primary" />
                  </div>
                  {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="mobileNumber" className="text-xs font-medium text-white/80">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input id="mobileNumber" name="mobileNumber" placeholder="Enter 10-digit mobile number" value={formData.mobileNumber} onChange={handleChange} type="tel" maxLength={10} className="pl-9 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-primary" />
                </div>
                {errors.mobileNumber && <p className="text-xs text-red-400">{errors.mobileNumber}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-white/80">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input id="password" name="password" type="password" placeholder="Enter your password" value={formData.password} onChange={handleChange} className="pl-9 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-primary" />
                </div>
                {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
              </div>
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium text-white/80">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Confirm your password" value={formData.confirmPassword} onChange={handleChange} className="pl-9 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-primary" />
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword}</p>}
                </div>
              )}
              <Button type="submit" className="w-full h-10 font-medium bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button type="button" onClick={() => { setIsLogin(!isLogin); setErrors({}); }} className="text-sm text-primary hover:underline font-medium">
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
            <div className="mt-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-white/50 hover:text-white text-xs">
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back to Store
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}