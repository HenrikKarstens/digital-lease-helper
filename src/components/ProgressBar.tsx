import { useHandover } from '@/context/HandoverContext';
import { useStepConfig } from '@/hooks/useStepConfig';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home } from 'lucide-react';

export const ProgressBar = () => {
  const { currentStep } = useHandover();
  const { steps } = useStepConfig();
  const navigate = useNavigate();

  return (
    <div className="w-full px-4 py-3 bg-card/90 backdrop-blur-md border-b border-border/50 sticky top-0 z-50">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Home className="w-3 h-3" />
            Projekte
          </button>
          <span className="text-xs font-medium text-muted-foreground">
            Phase {Math.min(currentStep, steps.length - 1)}/{steps.length - 1} · {steps[currentStep]?.label || 'Start'}
          </span>
        </div>
        <div className="flex gap-0.5">
          {steps.map((_, i) => {
            const isCompleted = i < currentStep;
            const isCurrent = i === currentStep;

            return (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-500',
                  isCompleted && 'bg-success',
                  isCurrent && 'bg-primary',
                  !isCompleted && !isCurrent && 'bg-muted'
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
