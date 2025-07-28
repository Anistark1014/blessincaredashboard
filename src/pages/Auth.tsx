import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Heart, Flower } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allowSignup, setAllowSignup] = useState(true);

  const [loginData, setLoginData] = useState({ identifier: '', password: '' });

  // State for registration form
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    name: '',
    region: '', // Optional
    phone: '',   // Optional
    role: 'reseller' as UserRole,
  });

  const { login, register, isAuthenticated, loading } = useAuth();
  const { toast } = useToast();

  // Fetch signup settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('allow_signup')
        .single();

      if (!error && data) {
        setAllowSignup(Boolean(data.allow_signup));
      } else {
        console.error('Failed to load signup setting', error);
        setAllowSignup(false); // Fallback to disabled
      }
    };
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-lavender"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let email = loginData.identifier;

      // Note: Logging in by name can be fragile if names are not unique.
      if (!email.includes('@')) {
        const { data, error } = await supabase
          .from('users')
          .select('email')
          .eq('name', loginData.identifier)
          .single();

        if (error || !data) throw new Error('User not found. Please use your email.');
        email = data.email;
      }

      await login(email, loginData.password);
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
        className: 'border-mint bg-mint/10',
      });
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.message || 'Please check your credentials and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // ✅ Pass all data, including optional fields, to the register function.
      // Your AuthContext will handle passing this to Supabase.
      await register(
        registerData.email,
        registerData.password,
        registerData.name,
        registerData.role
      );

      toast({
        title: 'Account created!',
        description: 'Welcome! You can now log in.',
        className: 'border-mint bg-mint/10',
      });

      // Clear the form after successful registration
      setRegisterData({
        email: '',
        password: '',
        name: '',
        region: '',
        phone: '',
        role: 'reseller' as UserRole,
      });
      // Consider switching the user to the "Sign In" tab here
    } catch (error: any) {
      console.error("Registration failed:", error);
      toast({
        title: 'Registration failed',
        description: error.message || 'An account with this email may already exist.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-lavender/5 to-blush/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in-up">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-lavender to-blush rounded-full flex items-center justify-center shadow-[var(--shadow-soft)]">
              <Heart className="w-6 h-6 text-lavender-foreground" />
            </div>
            <Flower className="w-8 h-8 text-blush-dark float-gentle" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Blessin Care</h1>
          <p className="text-muted-foreground">Empowering health through care and connection</p>
        </div>

        <Card className="healthcare-card border-lavender/20">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-foreground">Get Started</CardTitle>
            <CardDescription className="text-center">
              Join our community of resellers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-lavender/10">
                <TabsTrigger value="login" className="data-[state=active]:bg-lavender">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-blush" disabled={!allowSignup}>Sign Up</TabsTrigger>
              </TabsList>

              {/* LOGIN FORM */}
              <TabsContent value="login" className="space-y-4 pt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* ... login form fields from your code ... */}
                  <div className="space-y-2">
                    <Label htmlFor="login-identifier">Email or Name</Label>
                    <Input id="login-identifier" type="text" placeholder="your@email.com" value={loginData.identifier} onChange={(e) => setLoginData(prev => ({ ...prev, identifier: e.target.value }))} className="border-lavender/30 focus:border-lavender" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))} className="border-lavender/30 focus:border-lavender pr-10" required />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full btn-healthcare" disabled={isLoading}>{isLoading ? 'Signing in...' : 'Sign In'}</Button>
                </form>
              </TabsContent>

              {/* REGISTRATION FORM */}
              <TabsContent value="register" className="space-y-4 pt-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Full Name</Label>
                    <Input id="register-name" placeholder="Enter your full name" value={registerData.name} onChange={(e) => setRegisterData(prev => ({ ...prev, name: e.target.value }))} className="border-blush/30 focus:border-blush" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input id="register-email" type="email" placeholder="Enter your email" value={registerData.email} onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))} className="border-blush/30 focus:border-blush" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="Create a strong password" value={registerData.password} onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))} className="border-blush/30 focus:border-blush pr-10" required />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {/* Phone is now optional, 'required' attribute removed */}
                    <Label htmlFor="register-phone">Phone Number (Optional)</Label>
                    <Input id="register-phone" type="tel" placeholder="e.g., +91 XXXXX XXXXX" value={registerData.phone} onChange={(e) => setRegisterData(prev => ({ ...prev, phone: e.target.value }))} className="border-blush/30 focus:border-blush" />
                  </div>
                  <div className="space-y-2">
                    {/* Region is now optional, 'required' attribute removed */}
                    <Label htmlFor="register-region">Region (Optional)</Label>
                    <Input id="register-region" type="text" placeholder="e.g., Asia, Europe" value={registerData.region} onChange={(e) => setRegisterData(prev => ({ ...prev, region: e.target.value }))} className="border-blush/30 focus:border-blush" />
                  </div>
                  <Button type="submit" className="w-full btn-healthcare" disabled={isLoading}>{isLoading ? 'Creating account...' : 'Create Account'}</Button>
                </form>
              </TabsContent>

              {!allowSignup && (
                <p className="text-center text-sm text-red-500 mt-2">
                  Sign-up is currently disabled. Please contact your admin.
                </p>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;