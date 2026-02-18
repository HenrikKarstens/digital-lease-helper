import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useTheme, ViewMode } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Palette, Sun, Moon, Eye, Minimize2, Save, CloudUpload, LogIn } from 'lucide-react';
import { getGuestProjectData, clearGuestProject } from '@/hooks/useGuestStorage';


const viewModes: { mode: ViewMode; label: string; description: string; icon: typeof Sun }[] = [
  { mode: 'standard', label: 'Standard', description: 'Premium-Design mit voller Darstellung', icon: Sun },
  { mode: 'compact', label: 'Kompakt', description: 'Reduzierte Abstände für Profis', icon: Minimize2 },
  { mode: 'contrast', label: 'Kontrast', description: 'Maximale Lesbarkeit bei Sonnenlicht', icon: Eye },
  { mode: 'dark', label: 'Dunkel', description: 'Für schlecht beleuchtete Räume', icon: Moon },
];

const Settings = () => {
  const { user } = useAuth();
  const { viewMode, setViewMode } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (data) {
        setDisplayName(data.display_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
      }
    };
    if (user) fetchProfile();
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, email, phone })
      .eq('user_id', user!.id);

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Gespeichert', description: 'Profil wurde aktualisiert.' });
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-semibold">Einstellungen</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Cloud Upgrade – shown only for guests, always at top */}
        {!user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-start gap-3">
                <CloudUpload className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary">Jetzt Konto erstellen</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Speichern Sie Ihre Daten sicher in der Cloud und greifen Sie von jedem Gerät darauf zu. Ihr lokaler Fortschritt wird dabei automatisch übertragen.
                  </p>
                  <Button
                    className="mt-3 gap-2 w-full"
                    size="sm"
                    onClick={() => navigate('/auth')}
                  >
                    <LogIn className="w-4 h-4" />
                    Konto erstellen & Daten übertragen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Profile – only for authenticated users */}
        {user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" /> Profil
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ihr Name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">E-Mail</label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-Mail" type="email" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Handynummer</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49..." type="tel" />
                </div>
                <Button onClick={saveProfile} disabled={saving} className="w-full gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Speichern...' : 'Profil speichern'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* View Modes */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="w-4 h-4" /> Ansicht
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {viewModes.map(({ mode, label, description, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    viewMode === mode
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/50 border border-transparent hover:bg-muted'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${viewMode === mode ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${viewMode === mode ? 'text-primary' : ''}`}>{label}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                  {viewMode === mode && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;

