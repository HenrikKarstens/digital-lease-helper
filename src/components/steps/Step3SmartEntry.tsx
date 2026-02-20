import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useDocumentSteps } from './documentWizard/useDocumentSteps';
import { SingleDocCapture } from './documentWizard/SingleDocCapture';

export const Step3SmartEntry = () => {
  const { goToStepById } = useHandover();
  const docSteps = useDocumentSteps();
  const [currentDocIdx, setCurrentDocIdx] = useState(0);
  const [skippedAll, setSkippedAll] = useState(false);

  const currentDoc = docSteps[currentDocIdx];

  const handleDocDone = () => {
    const next = currentDocIdx + 1;
    if (next >= docSteps.length) {
      goToStepById('validation');
    } else {
      setCurrentDocIdx(next);
    }
  };

  const handleSkip = () => {
    handleDocDone();
  };

  if (!currentDoc) {
    goToStepById('validation');
    return null;
  }

  const progressPercent = Math.round((currentDocIdx / docSteps.length) * 100);

  return (
    <div className="min-h-[80vh] flex flex-col px-0 py-6">
      {/* Sub-progress header */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Dokument {currentDocIdx + 1} von {docSteps.length}
            </p>
            <h2 className="text-xl font-bold">Smart-Einstieg</h2>
          </div>
          <div className="flex gap-1.5">
            {docSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < currentDocIdx
                    ? 'bg-primary w-4'
                    : i === currentDocIdx
                    ? 'bg-primary w-6'
                    : 'bg-muted w-4'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Doc step indicators – hide when only one doc */}
        {docSteps.length > 1 && (
          <div className="flex gap-2 mt-3">
            {docSteps.map((doc, i) => (
              <motion.div
                key={doc.id}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                  i === currentDocIdx
                    ? 'bg-primary/10 border border-primary/30'
                    : i < currentDocIdx
                    ? 'bg-success/10 border border-success/20'
                    : 'bg-muted/30 border border-transparent'
                }`}
              >
                <span className="text-base">{doc.icon}</span>
                <span className="text-[9px] font-medium text-center leading-tight px-1 truncate w-full text-center">
                  {i < currentDocIdx ? '✓' : doc.optional ? `${doc.title.substring(0, 8)}…` : doc.title.substring(0, 8)}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Main capture area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentDocIdx}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
          className="flex-1"
        >
          <SingleDocCapture
            docStep={currentDoc}
            docIndex={currentDocIdx}
            totalDocs={docSteps.length}
            onDone={handleDocDone}
            onSkip={handleSkip}
          />
        </motion.div>
      </AnimatePresence>

      {/* Skip all button */}
      <div className="px-4 pt-4">
        <button
          onClick={() => goToStepById('validation')}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Alle Schritte überspringen → Manuelle Eingabe
        </button>
      </div>
    </div>
  );
};
