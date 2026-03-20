import { lazy, Suspense } from 'react';
import { useHandover } from '@/context/HandoverContext';
import { useStepConfig } from '@/hooks/useStepConfig';
import { ProgressBar } from '@/components/ProgressBar';
import { PageTransition } from '@/components/PageTransition';
import { Step1Hero } from '@/components/steps/Step1Hero';
import { Step2Role } from '@/components/steps/Step2Role';
import { Step1cDirection } from '@/components/steps/Step1cDirection';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Step3SmartEntry is now integrated into Step4Validation
const Step4Validation = lazy(() => import('@/components/steps/Step4Validation').then(m => ({ default: m.Step4Validation })));

const Step6Participants = lazy(() => import('@/components/steps/Step6Participants').then(m => ({ default: m.Step6Participants })));
const StepRoomDashboard = lazy(() => import('@/components/steps/StepRoomDashboard').then(m => ({ default: m.StepRoomDashboard })));
const Step8MeterScan = lazy(() => import('@/components/steps/Step8MeterScan').then(m => ({ default: m.Step8MeterScan })));
const Step9Keys = lazy(() => import('@/components/steps/Step9Keys').then(m => ({ default: m.Step9Keys })));
const Step10DefectAnalysis = lazy(() => import('@/components/steps/Step10DefectAnalysis').then(m => ({ default: m.Step10DefectAnalysis })));
const Step12Deposit = lazy(() => import('@/components/steps/Step12Deposit').then(m => ({ default: m.Step12Deposit })));
const Step13Certificate = lazy(() => import('@/components/steps/Step13Certificate').then(m => ({ default: m.Step13Certificate })));
const Step14Utility = lazy(() => import('@/components/steps/Step14Utility').then(m => ({ default: m.Step14Utility })));

const COMPONENT_MAP: Record<string, React.ComponentType> = {
  Step1Hero,
  Step2Role,
  Step1cDirection,
  Step4Validation,
  
  Step6Participants,
  StepRoomDashboard,
  Step8MeterScan,
  Step9Keys,
  Step10DefectAnalysis,
  Step12Deposit,
  Step13Certificate,
  Step14Utility,
};

const StepLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const Index = () => {
  const { currentStep, setCurrentStep } = useHandover();
  const { getStep } = useStepConfig();

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

export default Index;
