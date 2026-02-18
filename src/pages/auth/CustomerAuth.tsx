import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { ShoppingBag, ArrowLeft, Phone, Lock, User as UserIcon } from 'lucide-react';

const loginSchema = z.object({
  mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
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
        const { error } = await signUp(authEmail, formData.password, formData.mobileNumber, formData.fullName);

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* E-commerce themed background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      <div className="absolute top-0 left-0 w-72 h-72 bg-primary/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/8 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
      <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
      
      {/* Floating shopping icons - decorative */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <ShoppingBag className="absolute top-[15%] left-[10%] h-8 w-8 text-primary/10 rotate-12" />
        <ShoppingBag className="absolute top-[60%] right-[15%] h-12 w-12 text-primary/8 -rotate-12" />
        <ShoppingBag className="absolute bottom-[20%] left-[20%] h-6 w-6 text-primary/10 rotate-45" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <Card className="border-border/50 shadow-xl backdrop-blur-sm bg-card/95">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="h-7 w-7 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <CardDescription className="text-sm">
              {isLogin ? 'Sign in with your mobile number' : 'Start shopping in minutes'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleSubmit} className="space-y-3">
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-medium">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="fullName" name="fullName" placeholder="Enter your full name" value={formData.fullName} onChange={handleChange} className="pl-9 h-10" />
                  </div>
                  {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="mobileNumber" className="text-xs font-medium">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="mobileNumber" name="mobileNumber" placeholder="Enter 10-digit mobile number" value={formData.mobileNumber} onChange={handleChange} type="tel" maxLength={10} className="pl-9 h-10" />
                </div>
                {errors.mobileNumber && <p className="text-xs text-destructive">{errors.mobileNumber}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" name="password" type="password" placeholder="Enter your password" value={formData.password} onChange={handleChange} className="pl-9 h-10" />
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Confirm your password" value={formData.confirmPassword} onChange={handleChange} className="pl-9 h-10" />
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                </div>
              )}

              <Button type="submit" className="w-full h-10 font-medium" disabled={isLoading}>
                {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button type="button" onClick={() => { setIsLogin(!isLogin); setErrors({}); }} className="text-sm text-primary hover:underline font-medium">
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>

            <div className="mt-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-muted-foreground text-xs">
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