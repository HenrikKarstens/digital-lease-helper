import { useHandover } from '@/context/HandoverContext';
import { cn } from '@/lib/utils';
import { Check, Lock } from 'lucide-react';

const STEPS = [
  'Start', 'Rolle', 'Einstieg', 'Daten', 'Grundriss', 'Teilnehmer', 'Beweis',
  'Zähler', 'Signatur', 'NK-Check', 'Mängel', 'Kaution', 'Zertifikat', 'Utility'
];

export const ProgressBar = () => {
  const { currentStep } = useHandover();

  // Step 0 = hero/start (no progress bar shown)
  if (currentStep === 0) return null;

  return (
    <div className="w-full px-4 py-3 bg-card/90 backdrop-blur-md border-b border-border/50 sticky top-0 z-50">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            Schritt {currentStep} von 14
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {STEPS[currentStep - 1]}
          </span>
        </div>
        <div className="flex gap-1">
          {STEPS.map((_, i) => {
            const stepNum = i + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            const isLocked = false;

            return (
              <div
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-all duration-500',
                  isCompleted && 'bg-success',
                  isCurrent && 'bg-primary',
                  !isCompleted && !isCurrent && !isLocked && 'bg-muted',
                  isLocked && 'bg-muted/50'
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
