import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  currentPage: number;
  totalPages: number;
  steps: string[];
  currentStepIndex: number;
}

export const DocumentAnalysisProgress = ({ currentPage, totalPages, steps, currentStepIndex }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card rounded-3xl p-8 w-full max-w-md text-center"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-4"
      />
      <h3 className="font-semibold text-lg mb-1">KI-Dokumentenanalyse</h3>
      {totalPages > 1 && (
        <p className="text-sm text-muted-foreground mb-5">
          Analysiere Seite {currentPage} von {totalPages}...
        </p>
      )}
      <div className="space-y-3 text-left mt-4">
        {steps.map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: i <= currentStepIndex ? 1 : 0.3, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 text-sm"
          >
            {i < currentStepIndex ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            ) : i === currentStepIndex ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />
            )}
            <span className={i < currentStepIndex ? 'text-foreground' : 'text-muted-foreground'}>
              {step}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
