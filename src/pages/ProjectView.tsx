import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useHandover, HandoverData } from '@/context/HandoverContext';
import { useStepConfig } from '@/hooks/useStepConfig';
import { saveGuestProject } from '@/hooks/useGuestStorage';
import { ProgressBar } from '@/components/ProgressBar';
import { PageTransition } from '@/components/PageTransition';
import { Step1Hero } from '@/components/steps/Step1Hero';
import { Step1aTransactionType } from '@/components/steps/Step1aTransactionType';
import { Step2Role } from '@/components/steps/Step2Role';
import { Step1cDirection } from '@/components/steps/Step1cDirection';
import { Step3SmartEntry } from '@/components/steps/Step3SmartEntry';
import { Step4Validation } from '@/components/steps/Step4Validation';
import { Step5FloorPlan } from '@/components/steps/Step5FloorPlan';
import { Step6Participants } from '@/components/steps/Step6Participants';
import { Step7Evidence } from '@/components/steps/Step7Evidence';
import { Step8MeterScan } from '@/components/steps/Step8MeterScan';
import { Step10DefectAnalysis } from '@/components/steps/Step10DefectAnalysis';
import { Step12Deposit } from '@/components/steps/Step12Deposit';
import { Step13Certificate } from '@/components/steps/Step13Certificate';
import { Step14Utility } from '@/components/steps/Step14Utility';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const COMPONENT_MAP: Record<string, React.FC> = {
  Step1Hero,
  Step1aTransactionType,
  Step2Role,
  Step1cDirection,
  Step3SmartEntry,
  Step4Validation,
  Step5FloorPlan,
  Step6Participants,
  Step7Evidence,
  Step8MeterScan,
  Step10DefectAnalysis,
  Step12Deposit,
  Step13Certificate,
  Step14Utility,
};

const ProjectView = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, currentStep, setCurrentStep, updateData, loadProject } = useHandover();
  const { steps, getStep } = useStepConfig();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const isGuest = id === 'guest' || !user;

  // Load project on mount
  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }

    const load = async () => {
      if (!id || !user) return;
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !project) {
        toast({ title: 'Projekt nicht gefunden', variant: 'destructive' });
        navigate('/dashboard');
        return;
      }

      loadProject(project.handover_data as Partial<HandoverData>, project.current_step);
      setLoading(false);
    };
    load();
  }, [id, user]);

  // Auto-save
  useEffect(() => {
    if (loading) return;

    if (isGuest) {
      const timeout = setTimeout(() => {
        saveGuestProject(data, currentStep);
      }, 500);
      return () => clearTimeout(timeout);
    }

    if (!id) return;
    const timeout = setTimeout(() => {
      supabase
        .from('projects')
        .update({
          current_step: currentStep,
          handover_data: data as any,
          address: data.propertyAddress || null,
          title: data.propertyAddress
            ? `Übergabe: ${data.propertyAddress.substring(0, 40)}`
            : 'Neue Übergabe',
        })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Auto-save error:', error);
        });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [currentStep, data, loading, id, isGuest]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Projekt wird geladen...</div>
      </div>
    );
  }

  const currentStepDef = getStep(currentStep);
  const StepComponent = COMPONENT_MAP[currentStepDef.component] || Step1Hero;

  return (
    <div className="min-h-screen bg-background">
      <ProgressBar />
      {currentStep > 0 && (
        <div className="px-4 pt-2 max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            className="gap-1 text-muted-foreground rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
        </div>
      )}
      <div className="max-w-lg mx-auto">
        <PageTransition keyProp={currentStep}>
          <StepComponent />
        </PageTransition>
      </div>
    </div>
  );
};

export default ProjectView;
