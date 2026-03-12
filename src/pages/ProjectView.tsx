import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useHandover, HandoverData } from '@/context/HandoverContext';
import { useStepConfig } from '@/hooks/useStepConfig';
import { saveGuestProject } from '@/hooks/useGuestStorage';
import { ProgressBar } from '@/components/ProgressBar';
import { PageTransition } from '@/components/PageTransition';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Light steps – loaded eagerly
import { Step1Hero } from '@/components/steps/Step1Hero';

import { Step2Role } from '@/components/steps/Step2Role';
import { Step1cDirection } from '@/components/steps/Step1cDirection';

// Heavy steps – lazy loaded
const Step4Validation = lazy(() => import('@/components/steps/Step4Validation').then(m => ({ default: m.Step4Validation })));

const Step6Participants = lazy(() => import('@/components/steps/Step6Participants').then(m => ({ default: m.Step6Participants })));
const Step7Evidence = lazy(() => import('@/components/steps/Step7Evidence').then(m => ({ default: m.Step7Evidence })));
const Step8MeterScan = lazy(() => import('@/components/steps/Step8MeterScan').then(m => ({ default: m.Step8MeterScan })));
const Step9Keys = lazy(() => import('@/components/steps/Step9Keys').then(m => ({ default: m.Step9Keys })));
const Step10DataComplete = lazy(() => import('@/components/steps/Step10DataComplete').then(m => ({ default: m.Step10DataComplete })));
const Step10DefectAnalysis = lazy(() => import('@/components/steps/Step10DefectAnalysis').then(m => ({ default: m.Step10DefectAnalysis })));
const StepDepositCheck = lazy(() => import('@/components/steps/StepDepositCheck'));
const StepConditionCheck = lazy(() => import('@/components/steps/StepConditionCheck'));


const Step12Unlock = lazy(() => import('@/components/steps/Step12Unlock').then(m => ({ default: m.Step12Unlock })));
const Step14Utility = lazy(() => import('@/components/steps/Step14Utility').then(m => ({ default: m.Step14Utility })));
const StepForwardingAddress = lazy(() => import('@/components/steps/StepForwardingAddress').then(m => ({ default: m.StepForwardingAddress })));

const COMPONENT_MAP: Record<string, React.ComponentType> = {
  Step1Hero,
  Step2Role,
  Step1cDirection,
  Step4Validation,
  Step6Participants,
  Step7Evidence,
  Step8MeterScan,
  Step9Keys,
  Step10DataComplete,
  Step10DefectAnalysis,
  StepDepositCheck,
  StepForwardingAddress,
  Step14Utility,
  Step12Unlock,
};

const StepLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

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
          <Suspense fallback={<StepLoader />}>
            <StepComponent />
          </Suspense>
        </PageTransition>
      </div>
    </div>
  );
};

export default ProjectView;
