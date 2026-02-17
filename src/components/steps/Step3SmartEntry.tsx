import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, PenLine, Upload, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useEffect } from 'react';

const analysisSteps = [
  'Analysiere Vertragsdaten...',
  'Extrahiere Parteien...',
  'Erkenne Kautionshöhe...',
  'Prüfe Vertragslaufzeit...',
  'Analyse abgeschlossen ✓',
];

export const Step3SmartEntry = () => {
  const { updateData, setCurrentStep } = useHandover();
  const { contractLabel, isSale } = useTransactionLabels();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    if (!analyzing) return;
    if (analysisStep >= analysisSteps.length) {
      updateData({
        propertyAddress: 'Musterstraße 42, 10115 Berlin',
        landlordName: isSale ? 'Dr. Thomas Müller' : 'Dr. Thomas Müller',
        landlordEmail: 'mueller@immobilien.de',
        tenantName: isSale ? 'Anna Schmidt' : 'Anna Schmidt',
        tenantEmail: 'a.schmidt@mail.de',
        depositAmount: isSale ? '15.000' : '2.400',
        contractStart: '2021-04-01',
        contractEnd: '2025-03-31',
      });
      setTimeout(() => setCurrentStep(5), 500);
      return;
    }
    const timer = setTimeout(() => setAnalysisStep(s => s + 1), 1200);
    return () => clearTimeout(timer);
  }, [analyzing, analysisStep]);

  const handleScan = () => {
    setAnalyzing(true);
    setAnalysisStep(0);
  };

  const handleManual = () => {
    setCurrentStep(5);
  };

  if (analyzing) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-3xl p-8 w-full max-w-md text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-6"
          />
          <h3 className="font-semibold text-lg mb-6">KI-Vertragsanalyse</h3>
          <div className="space-y-3 text-left">
            {analysisSteps.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i <= analysisStep ? 1 : 0.3, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 text-sm"
              >
                {i < analysisStep ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                ) : i === analysisStep ? (
                  <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />
                )}
                <span className={i < analysisStep ? 'text-foreground' : 'text-muted-foreground'}>
                  {step}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-2 text-center"
      >
        Smart-Einstieg
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-muted-foreground text-center mb-8 max-w-sm"
      >
        Laden Sie Ihren {contractLabel} hoch oder geben Sie die Daten manuell ein
      </motion.p>

      <div className="grid gap-4 w-full max-w-md">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleScan}
          className="glass-card rounded-2xl p-6 flex items-center gap-5 text-left w-full border-2 border-primary/20 hover:border-primary/40 transition-colors"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <ScanLine className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{contractLabel} scannen</h3>
            <p className="text-sm text-muted-foreground">KI-gestützte Analyse Ihres Vertrags</p>
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleManual}
          className="glass-card rounded-2xl p-6 flex items-center gap-5 text-left w-full hover:border-primary/30 transition-colors"
        >
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
            <PenLine className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Manuelle Eingabe</h3>
            <p className="text-sm text-muted-foreground">Daten selbst eingeben</p>
          </div>
        </motion.button>
      </div>
    </div>
  );
};
