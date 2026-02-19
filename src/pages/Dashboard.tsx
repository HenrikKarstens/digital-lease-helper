import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useHandover } from '@/context/HandoverContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Home, Clock, CheckCircle2, Pause, ArrowRight, LogOut, LogIn, CloudUpload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loadGuestProject, saveGuestProject } from '@/hooks/useGuestStorage';

interface Project {
  id: string;
  title: string;
  address: string | null;
  current_step: number;
  status: string;
  updated_at: string;
  created_at: string;
}

const STEP_LABELS = [
  'Start', 'Art', 'Rolle', 'Richtung', 'Einstieg', 'Validierung', 'Grundriss',
  'Teilnehmer', 'Beweis', 'Zähler', 'Mängel', 'Kaution', 'Protokoll', 'Abschluss'
];

const statusConfig = {
  active: { label: 'Aktiv', icon: Clock, color: 'bg-primary/10 text-primary' },
  paused: { label: 'Pausiert', icon: Pause, color: 'bg-muted text-muted-foreground' },
  completed: { label: 'Abgeschlossen', icon: CheckCircle2, color: 'bg-success/10 text-success' },
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { data, currentStep, loadProject, resetData } = useHandover();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestProject, setGuestProject] = useState<{ data: any; step: number } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProjects();
    } else {
      // Guest mode: load from localStorage
      const saved = loadGuestProject();
      setGuestProject(saved);
      setLoading(false);
    }
  }, [user]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  };

  const createProject = async () => {
    if (!user) {
      // Guest: reset state and navigate to guest project
      resetData();
      navigate('/project/guest');
      return;
    }
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, title: 'Neue Übergabe', handover_data: {} })
      .select()
      .single();

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else if (data) {
      navigate(`/project/${data.id}`);
    }
  };

  const resumeGuestProject = () => {
    if (guestProject) {
      loadProject(guestProject.data, guestProject.step);
    }
    navigate('/project/guest');
  };

  const openProject = (project: Project) => {
    navigate(`/project/${project.id}`);
  };

  // Guest dashboard
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border/50">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-xl font-bold">
              <span className="text-primary">Estate</span>
              <span className="text-success">Turn</span>
            </h1>
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')} className="gap-1 text-xs">
              <LogIn className="w-4 h-4" />
              Anmelden
            </Button>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-lg font-semibold">Gast-Modus</h2>
            <p className="text-sm text-muted-foreground">Daten werden lokal im Browser gespeichert.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Button
              onClick={createProject}
              className="w-full h-14 rounded-2xl text-base font-semibold gap-2"
              size="lg"
            >
              <Plus className="w-5 h-5" />
              Neue Übergabe starten
            </Button>
          </motion.div>

          {guestProject && guestProject.step > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
                onClick={resumeGuestProject}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">
                        {guestProject.data?.propertyAddress ? `Übergabe: ${guestProject.data.propertyAddress}` : 'Laufende Übergabe'}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Lokal gespeichert – Gast-Projekt</p>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Aktiv
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full transition-all"
                        style={{ width: `${Math.round((guestProject.step / 13) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {STEP_LABELS[guestProject.step] || 'Start'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Cloud upgrade hint */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border/30 bg-muted/30">
              <CardContent className="p-4 flex items-start gap-3">
                <CloudUpload className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Daten in der Cloud sichern</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Erstellen Sie ein kostenloses Konto, um Projekte auf allen Geräten zu nutzen.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto mt-1 text-primary text-xs"
                    onClick={() => navigate('/auth')}
                  >
                    Jetzt Konto erstellen →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // Authenticated dashboard
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">
            <span className="text-primary">Estate</span>
            <span className="text-success">Turn</span>
          </h1>
          <Button variant="ghost" size="icon" onClick={signOut} title="Abmelden">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold">Meine Projekte</h2>
          <p className="text-sm text-muted-foreground">
            {projects.length === 0 ? 'Starten Sie Ihre erste Übergabe.' : `${projects.length} Projekt${projects.length !== 1 ? 'e' : ''}`}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Button
            onClick={createProject}
            className="w-full h-14 rounded-2xl text-base font-semibold gap-2"
            size="lg"
          >
            <Plus className="w-5 h-5" />
            Neue Übergabe starten
          </Button>
        </motion.div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project, i) => {
              const config = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.active;
              const StatusIcon = config.icon;
              const progress = Math.round((project.current_step / 13) * 100);

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
                    onClick={() => openProject(project)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{project.title}</h3>
                          {project.address && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Home className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground truncate">{project.address}</span>
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className={`text-xs shrink-0 ${config.color}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-success rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {STEP_LABELS[project.current_step] || 'Start'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
