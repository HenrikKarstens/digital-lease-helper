import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Home, Clock, CheckCircle2, Pause, ArrowRight, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  'Teilnehmer', 'Beweis', 'Zähler', 'Signatur', 'NK-Check', 'Mängel',
  'Kaution', 'Zertifikat', 'Utility'
];

const statusConfig = {
  active: { label: 'Aktiv', icon: Clock, color: 'bg-primary/10 text-primary' },
  paused: { label: 'Pausiert', icon: Pause, color: 'bg-muted text-muted-foreground' },
  completed: { label: 'Abgeschlossen', icon: CheckCircle2, color: 'bg-success/10 text-success' },
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchProjects();
  }, []);

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
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user!.id, title: 'Neue Übergabe', handover_data: {} })
      .select()
      .single();

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else if (data) {
      navigate(`/project/${data.id}`);
    }
  };

  const openProject = (project: Project) => {
    navigate(`/project/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold">Meine Projekte</h2>
          <p className="text-sm text-muted-foreground">
            {projects.length === 0 ? 'Starten Sie Ihre erste Übergabe.' : `${projects.length} Projekt${projects.length !== 1 ? 'e' : ''}`}
          </p>
        </motion.div>

        {/* New Project Button */}
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

        {/* Project List */}
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
              const progress = Math.round((project.current_step / 15) * 100);

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
