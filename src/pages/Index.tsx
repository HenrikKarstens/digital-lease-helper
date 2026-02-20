import { useHandover } from '@/context/HandoverContext';
import { useStepConfig } from '@/hooks/useStepConfig';
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
          <StepComponent />
        </PageTransition>
      </div>
    </div>
  );
};

export default Index;
