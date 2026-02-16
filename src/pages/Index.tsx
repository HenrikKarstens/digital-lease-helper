import { useHandover } from '@/context/HandoverContext';
import { ProgressBar } from '@/components/ProgressBar';
import { PageTransition } from '@/components/PageTransition';
import { Step1Hero } from '@/components/steps/Step1Hero';
import { Step2Role } from '@/components/steps/Step2Role';
import { Step3SmartEntry } from '@/components/steps/Step3SmartEntry';
import { Step4Validation } from '@/components/steps/Step4Validation';
import { Step5FloorPlan } from '@/components/steps/Step5FloorPlan';
import { Step6Participants } from '@/components/steps/Step6Participants';
import { Step7Evidence } from '@/components/steps/Step7Evidence';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const stepComponents: Record<number, React.FC> = {
  0: Step1Hero,
  1: Step2Role,
  2: Step2Role,
  3: Step3SmartEntry,
  4: Step4Validation,
  5: Step5FloorPlan,
  6: Step6Participants,
  7: Step7Evidence,
};

const Index = () => {
  const { currentStep, setCurrentStep } = useHandover();

  // Map step 1 to role selection (step 2 in plan)
  const getStepComponent = () => {
    switch (currentStep) {
      case 0: return <Step1Hero />;
      case 1: return <Step2Role />;
      case 2: return <Step3SmartEntry />;
      case 3: return <Step3SmartEntry />;
      case 4: return <Step4Validation />;
      case 5: return <Step5FloorPlan />;
      case 6: return <Step6Participants />;
      case 7: return <Step7Evidence />;
      default: return <Step1Hero />;
    }
  };

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
          {getStepComponent()}
        </PageTransition>
      </div>
    </div>
  );
};

export default Index;
