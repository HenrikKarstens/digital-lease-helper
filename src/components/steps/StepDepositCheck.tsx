import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gavel, Landmark, Calendar, Scale, CheckCircle2 } from 'lucide-react';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { DepositTypeStep } from './depositWizard/DepositTypeStep';
import { DepositDetailsStep } from './depositWizard/DepositDetailsStep';
import { DepositOverviewStep } from './depositWizard/DepositOverviewStep';
import { DepositConclusionStep } from './depositWizard/DepositConclusionStep';

const SUB_STEPS = [
  { id: 'type', label: 'Kautionsart', icon: <Landmark className="w-4 h-4" /> },
  { id: 'details', label: 'Details & Zinsen', icon: <Calendar className="w-4 h-4" /> },
  { id: 'overview', label: 'Finanz-Überblick', icon: <Scale className="w-4 h-4" /> },
  { id: 'conclusion', label: 'Abschluss', icon: <CheckCircle2 className="w-4 h-4" /> },
];

export const StepDepositCheck = () => {
  const { data, goToStepById } = useHandover();
  const { isSale, isMoveIn } = useTransactionLabels();
  const [subStep, setSubStep] = useState(0);
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});

  const handleFinish = () => {
    if (isMoveIn) {
      goToStepById('data-complete');
    } else {
      goToStepById('utility');
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4 w-full max-w-md">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-3">
          <Gavel className="w-3.5 h-3.5" />
          Kautions-Schiedsrichter
        </div>
        <h2 className="text-2xl font-bold">{isSale ? 'Kaufpreis-Verrechnung' : 'Finanzielle Abwicklung'}</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Rechtssichere Saldierung inkl. Zinsansprüchen (§ 551 Abs. 3 BGB)
        </p>
      </motion.div>

      {/* Sub-progress (Smart-Einstieg style) */}
      <div className="w-full max-w-md mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Schritt {subStep + 1} von {SUB_STEPS.length}
          </p>
          <div className="flex gap-1.5">
            {SUB_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < subStep
                    ? 'bg-primary w-4'
                    : i === subStep
                    ? 'bg-primary w-6'
                    : 'bg-muted w-4'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {SUB_STEPS.map((step, i) => (
            <button
              key={step.id}
              onClick={() => i < subStep && setSubStep(i)}
              disabled={i > subStep}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                i === subStep
                  ? 'bg-primary/10 border border-primary/30'
                  : i < subStep
                  ? 'bg-accent/10 border border-accent/20 cursor-pointer hover:bg-accent/15'
                  : 'bg-muted/30 border border-transparent opacity-50'
              }`}
            >
              <span className={`${i === subStep ? 'text-primary' : i < subStep ? 'text-accent' : 'text-muted-foreground'}`}>
                {i < subStep ? <CheckCircle2 className="w-4 h-4" /> : step.icon}
              </span>
              <span className="text-[9px] font-medium text-center leading-tight px-1 truncate w-full">
                {step.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {subStep === 0 && (
            <DepositTypeStep key="type" onNext={() => setSubStep(1)} />
          )}
          {subStep === 1 && (
            <DepositDetailsStep key="details" onNext={() => setSubStep(2)} />
          )}
          {subStep === 2 && (
            <DepositOverviewStep
              key="overview"
              onNext={(overrides) => {
                setCostOverrides(overrides);
                setSubStep(3);
              }}
            />
          )}
          {subStep === 3 && (
            <DepositConclusionStep
              key="conclusion"
              costOverrides={costOverrides}
              onFinish={handleFinish}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StepDepositCheck;
