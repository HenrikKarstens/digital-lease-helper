import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ArrowRight, CheckCircle2, XCircle, Scale, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useDocumentSteps } from './documentWizard/useDocumentSteps';
import { SingleDocCapture } from './documentWizard/SingleDocCapture';

interface Step3Props {
  embedded?: boolean;
  onComplete?: () => void;
}

/** Gate question config for conditional doc steps (move-out) */
const GATE_QUESTIONS: Record<string, {
  question: string;
  yesLabel: string;
  noLabel: string;
  noHint?: string;
}> = {
  'amendment': {
    question: 'Gibt es Nachträge zum Mietvertrag (z.\u00A0B. Mietanpassungen)?',
    yesLabel: 'Ja, Nachträge vorhanden',
    noLabel: 'Nein, keine Nachträge',
  },
  'handover-protocol': {
    question: 'Haben Sie ein schriftliches Vorprotokoll (vom Einzug)?',
    yesLabel: 'Ja, Protokoll vorhanden',
    noLabel: 'Nein, kein Protokoll',
  },
  'utility-bill': {
    question: 'Haben Sie vom Vermieter bereits die letzte Nebenkostenabrechnung erhalten?',
    yesLabel: 'Ja, Abrechnung vorhanden',
    noLabel: 'Nein, noch nicht erhalten',
    noHint: 'Hinweis: Der Vermieter ist berechtigt, einen angemessenen Teil der Kaution (i.\u00A0d.\u00A0R. 3 bis 6 Nebenkostenvorauszahlungen) für noch ausstehende Abrechnungen einzubehalten (§\u00A0273 BGB / BGH VIII ZR 71/05).',
  },
};

type GateAnswer = 'pending' | 'yes' | 'no';

export const Step3SmartEntry = ({ embedded, onComplete }: Step3Props = {}) => {
  const { data, goToStepById } = useHandover();
  const docSteps = useDocumentSteps();
  const [currentDocIdx, setCurrentDocIdx] = useState(0);
  const [gateAnswer, setGateAnswer] = useState<GateAnswer>('pending');
  const [showNoHint, setShowNoHint] = useState(false);

  const isMoveOut = data.handoverDirection === 'move-out';
  const currentDoc = docSteps[currentDocIdx];

  const finish = () => {
    if (embedded && onComplete) {
      onComplete();
    } else {
      goToStepById('data-check');
    }
  };

  const advanceToNext = () => {
    const next = currentDocIdx + 1;
    if (next >= docSteps.length) {
      finish();
    } else {
      setCurrentDocIdx(next);
      setGateAnswer('pending');
      setShowNoHint(false);
    }
  };

  if (!currentDoc) {
    finish();
    return null;
  }

  // Determine if current doc needs a gate question (optional docs in move-out)
  const gateConfig = isMoveOut && currentDoc.optional ? GATE_QUESTIONS[currentDoc.id] : null;
  const needsGate = !!gateConfig && gateAnswer === 'pending';

  const progressPercent = Math.round(((currentDocIdx + 1) / docSteps.length) * 100);

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

        {/* Doc step indicators */}
        {docSteps.length > 1 && (
          <div className="flex gap-2 mt-3">
            {docSteps.map((doc, i) => (
              <motion.div
                key={doc.id}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                  i === currentDocIdx
                    ? 'bg-primary/10 border border-primary/30'
                    : i < currentDocIdx
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-muted/30 border border-transparent'
                }`}
              >
                <span className="text-base">{doc.icon}</span>
                <span className="text-[9px] font-medium text-center leading-tight px-1 truncate w-full">
                  {i < currentDocIdx ? '✓' : doc.title.length > 10 ? `${doc.title.substring(0, 8)}…` : doc.title}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Main area */}
      <AnimatePresence mode="wait">
        {/* ── Gate Question (conditional step) ── */}
        {needsGate && gateConfig && (
          <motion.div
            key={`gate-${currentDocIdx}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="flex-1 px-4"
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{currentDoc.icon}</span>
              <div>
                <h3 className="font-bold text-lg leading-tight">{currentDoc.title}</h3>
                <p className="text-xs text-muted-foreground">{currentDoc.subtitle}</p>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 mb-4">
              <p className="text-sm font-medium text-foreground leading-relaxed mb-6">
                {gateConfig.question}
              </p>

              <div className="grid grid-cols-1 gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setGateAnswer('yes')}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">{gateConfig.yesLabel}</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (gateConfig.noHint) {
                      setShowNoHint(true);
                    } else {
                      advanceToNext();
                    }
                  }}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-border hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <span className="font-semibold text-sm text-muted-foreground">{gateConfig.noLabel}</span>
                </motion.button>
              </div>
            </div>

            {/* Legal hint for "No" on utility-bill */}
            <AnimatePresence>
              {showNoHint && gateConfig.noHint && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="glass-card rounded-2xl p-4 mb-4 border border-amber-500/30 bg-amber-500/5"
                >
                  <div className="flex items-start gap-3">
                    <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Rechtlicher Hinweis</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {gateConfig.noHint}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={advanceToNext}
                    className="w-full mt-4 h-11 rounded-2xl font-semibold gap-2"
                  >
                    Verstanden, weiter
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Document Capture (mandatory or after "Yes") ── */}
        {!needsGate && (
          <motion.div
            key={`capture-${currentDocIdx}`}
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
              onDone={advanceToNext}
              onSkip={advanceToNext}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip all button */}
      <div className="px-4 pt-4">
        <button
          onClick={finish}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Alle Schritte überspringen → Manuelle Eingabe
        </button>
      </div>
    </div>
  );
};
