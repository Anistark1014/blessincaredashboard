import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext'; // Assuming UserRole is defined here
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Heart, Flower } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient'; // <-- Import Supabase client

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allowSignup, setAllowSignup] = useState(true); // default true

  const [loginData, setLoginData] = useState({ identifier: '', password: '' });

  // Gets Settings for auth
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
        setAllowSignup(false); // default fallback
      }
    };

    fetchSettings();
  }, []);


  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    name: '',
    region: '', // Keep region in state
    phone: '',  // Keep phone in state
    role: 'reseller' as UserRole, // Default role for self-registration
  });

  const { login, register, isAuthenticated, loading } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-lavender"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    // Navigate based on user role if needed, e.g., /admin for admin, /reseller for reseller
    // For now, it navigates to /admin, which implies admin dashboard or a route that handles role-based redirection.
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let email = loginData.identifier;

      // If input doesn't look like an email, try to find user by name
      if (!email.includes('@')) {
        const { data, error } = await supabase
          .from('users')
          .select('email')
          .eq('name', loginData.identifier)
          .single();

        if (error || !data) throw new Error('User not found by name');
        email = data.email;
      }

      await login(email, loginData.password);
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
        className: 'border-mint bg-mint/10',
      });
    } catch (error: any) { // Type 'any' for error to access .message safely
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

    // Client-side check for existing email/name
    // This is optional but can provide quicker feedback before hitting Supabase Auth
    const { data: existing, error: existingCheckError } = await supabase
      .from('users')
      .select('id')
      // Check if email or name already exists in your public.users table
      .or(`email.eq.${registerData.email},name.eq.${registerData.name}`);

    if (existingCheckError) {
      console.error("Error checking existing user:", existingCheckError);
      toast({
        title: 'Registration failed',
        description: 'An error occurred during preliminary checks.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    if (existing && existing.length > 0) {
      toast({
        title: 'Already registered',
        description: 'An account with this email or name already exists.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      // ✅ CRITICAL CHANGE: Call the `register` function from AuthContext
      //    This `register` function (in AuthContext.tsx) must be updated
      //    to accept `phone` and `region` and pass them in `options.data`
      //    to `supabase.auth.signUp()`.
      await register(
        registerData.email,
        registerData.password,
        registerData.name,
        registerData.role
      );

      // --- REMOVED: Manual insert into public.users table ---
      // This step is now handled automatically by the database trigger (Phase 1).
      // await supabase.from('users').insert({
      //   email: registerData.email,
      //   name: registerData.name,
      //   role: registerData.role as string,
      //   region: null,
      // });
      // --------------------------------------------------------

      toast({
        title: 'Account created!',
        description: 'Welcome to the platform. You can now log in.',
        className: 'border-mint bg-mint/10',
      });

      // Optionally, clear registration form data after successful registration
      setRegisterData({
        email: '',
        password: '',
        name: '',
        region: '',
        phone: '',
        role: 'reseller' as UserRole,
      });

      // After successful registration, you might want to automatically log them in
      // or redirect them to the login tab/page.
      // await login(registerData.email, registerData.password); // Uncomment if auto-login is desired
    } catch (error: any) { // Type 'any' for error to access .message safely
      console.error("Registration failed:", error);
      toast({
        title: 'Registration failed',
        description: error.message || 'Please try again.',
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
              Join our caring community of healthcare professionals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-lavender/10">
                <TabsTrigger value="login" className="data-[state=active]:bg-lavender">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-blush" disabled={!allowSignup}>Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-identifier">Email or Name</Label>
                    <Input
                      id="login-identifier"
                      type="text"
                      placeholder="Enter your email or name"
                      value={loginData.identifier}
                      onChange={(e) => setLoginData(prev => ({ ...prev, identifier: e.target.value }))}
                      className="border-lavender/30 focus:border-lavender"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={loginData.password}
                        onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        className="border-lavender/30 focus:border-lavender pr-10"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full btn-healthcare" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
                <div className="text-center text-sm text-muted-foreground">
                  Demo: ajinkyareseller@gmail.com / admin@test.com
                </div>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Full Name</Label>
                    <Input
                      id="register-name"
                      placeholder="Enter your full name"
                      value={registerData.name}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
                      className="border-blush/30 focus:border-blush"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="Enter your email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                      className="border-blush/30 focus:border-blush"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                        className="border-blush/30 focus:border-blush pr-10"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  {/* NEW: Input fields for Phone and Region */}
                  <div className="space-y-2">
                    <Label htmlFor="register-phone">Phone Number</Label>
                    <Input
                      id="register-phone"
                      type="tel" // 'tel' type for better mobile support
                      placeholder="Enter your phone number (e.g., +91-XXXXXXXXXX)"
                      value={registerData.phone}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, phone: e.target.value }))}
                      className="border-blush/30 focus:border-blush"
                      required // Make required as per your Deno function's validation
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-region">Region</Label>
                    <Input
                      id="register-region"
                      type="text"
                      placeholder="Enter your region (e.g., Asia, Europe)"
                      value={registerData.region}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, region: e.target.value }))}
                      className="border-blush/30 focus:border-blush"
                      required // Make required as per your Deno function's validation
                    />
                  </div>
                  {/* END NEW INPUT FIELDS */}
                  <div className="space-y-2">
                    <Label htmlFor="register-role">Role</Label>
                    <Select
                      value={registerData.role}
                      onValueChange={(value: UserRole) => setRegisterData(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger className="border-blush/30 focus:border-blush">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Only allow 'reseller' for self-registration if 'admin' is for internal use */}
                        <SelectItem value="reseller">Healthcare Reseller</SelectItem>
                        {/* <SelectItem value="admin">Admin/Owner</SelectItem> - Consider removing for public signup */}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full btn-healthcare" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
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