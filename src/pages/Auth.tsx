import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, User, ArrowRight, Zap } from 'lucide-react';
import { getGuestProjectData, clearGuestProject } from '@/hooks/useGuestStorage';


const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const migrateGuestData = async (userId: string) => {
    const guestData = getGuestProjectData();
    if (!guestData) return;
    try {
      const address = guestData.propertyAddress || null;
      await supabase.from('projects').insert({
        user_id: userId,
        title: address ? `Übergabe: ${address.substring(0, 40)}` : 'Übergabe (importiert)',
        address,
        handover_data: guestData as any,
        current_step: 0,
      });
      clearGuestProject();
      toast({ title: 'Daten übertragen ✓', description: 'Ihr Gast-Projekt wurde in Ihrem Konto gespeichert.' });
    } catch (e) {
      console.error('Migration error:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await migrateGuestData(data.user.id);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.user) await migrateGuestData(data.user.id);
        toast({
          title: 'Registrierung erfolgreich',
          description: 'Bitte bestätigen Sie Ihre E-Mail-Adresse.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGuestStart = () => {
    navigate('/dashboard');
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold tracking-tight text-center">
          <span className="text-primary">Estate</span>
          <span className="text-success">Turn</span>
        </h1>
        <p className="text-muted-foreground text-center mt-2">
          Intelligente Wohnungsübergabe
        </p>
      </motion.div>

      {/* Guest Start – prominent CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm mb-4"
      >
        <Button
          onClick={handleGuestStart}
          size="lg"
          className="w-full h-14 rounded-2xl text-base font-semibold gap-2 bg-success hover:bg-success/90 text-success-foreground"
        >
          <Zap className="w-5 h-5" />
          Direkt starten – ohne Konto
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-2 px-2 leading-relaxed">
          Ihre Daten werden lokal im Browser gespeichert. Erstellen Sie später ein optionales Konto, um Projekte geräteübergreifend zu synchronisieren.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm"
      >
        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">oder mit Konto</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Card className="border-border/50">
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-lg">
              {isLogin ? 'Anmelden' : 'Registrieren'}
            </CardTitle>
            <CardDescription className="text-xs">
              {isLogin ? 'Projekte geräteübergreifend verfügbar' : 'Erstellen Sie Ihr Konto'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              {!isLogin && (
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Ihr Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10"
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="E-Mail-Adresse"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-xl gap-2"
                disabled={loading}
                variant="outline"
              >
                {loading ? 'Wird geladen...' : (isLogin ? 'Anmelden' : 'Registrieren')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? 'Noch kein Konto? Registrieren' : 'Bereits registriert? Anmelden'}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
