import { useHandover } from '@/context/HandoverContext';
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
import { Step9Signature } from '@/components/steps/Step9Signature';
import { Step10NKCheck } from '@/components/steps/Step10NKCheck';
import { Step11DefectsList } from '@/components/steps/Step11DefectsList';
import { Step12Deposit } from '@/components/steps/Step12Deposit';
import { Step13Certificate } from '@/components/steps/Step13Certificate';
import { Step14Utility } from '@/components/steps/Step14Utility';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { currentStep, setCurrentStep } = useHandover();

  const getStepComponent = () => {
    switch (currentStep) {
      case 0: return <Step1Hero />;
      case 1: return <Step1aTransactionType />;
      case 2: return <Step2Role />;
      case 3: return <Step1cDirection />;
      case 4: return <Step3SmartEntry />;
      case 5: return <Step4Validation />;
      case 6: return <Step5FloorPlan />;
      case 7: return <Step6Participants />;
      case 8: return <Step7Evidence />;
      case 9: return <Step8MeterScan />;
      case 10: return <Step9Signature />;
      case 11: return <Step10NKCheck />;
      case 12: return <Step11DefectsList />;
      case 13: return <Step12Deposit />;
      case 14: return <Step13Certificate />;
      case 15: return <Step14Utility />;
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
