import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, PenLine, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const analysisSteps = [
  'Dokument wird verarbeitet...',
  'KI prüft Vertragsdetails nach BGB...',
  'Extrahiere Parteien & Adressen...',
  'Prüfe Kautionshöhe gegen § 551 BGB...',
  'Analysiere Schönheitsreparaturklauseln...',
  'Analyse abgeschlossen ✓',
];

export const Step3SmartEntry = () => {
  const { data, updateData, setCurrentStep } = useHandover();
  const { contractLabel, isSale } = useTransactionLabels();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisCompleteRef = useRef(false);

  useEffect(() => {
    if (!analyzing || analysisCompleteRef.current) return;
    if (analysisStep >= analysisSteps.length) {
      analysisCompleteRef.current = true;
      setTimeout(() => setCurrentStep(5), 600);
      return;
    }
    const timer = setTimeout(() => setAnalysisStep(s => s + 1), 1400);
    return () => clearTimeout(timer);
  }, [analyzing, analysisStep]);

  const handleFileUpload = async (file: File) => {
    setError(null);
    setAnalyzing(true);
    setAnalysisStep(0);
    analysisCompleteRef.current = false;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('transactionType', data.transactionType || 'rental');

      const { data: responseData, error: fnError } = await supabase.functions.invoke('analyze-contract', {
        body: formData,
      });

      if (fnError) throw new Error(fnError.message);
      if (!responseData?.success) throw new Error(responseData?.error || 'Analyse fehlgeschlagen');

      const result = responseData.data;
      updateData({
        propertyAddress: result.propertyAddress || '',
        landlordName: result.landlordName || '',
        landlordEmail: result.landlordEmail || '',
        tenantName: result.tenantName || '',
        tenantEmail: result.tenantEmail || '',
        depositAmount: result.depositAmount?.toString() || '',
        contractStart: result.contractStart || '',
        contractEnd: result.contractEnd || '',
        depositLegalCheck: result.depositLegalCheck || '',
        renovationClauseAnalysis: result.renovationClauseAnalysis || '',
      });

      // Fast-forward animation to completion
      setAnalysisStep(analysisSteps.length);
    } catch (err: any) {
      console.error('Contract analysis error:', err);
      setError(err.message || 'Fehler bei der Vertragsanalyse');
      setAnalyzing(false);
      setAnalysisStep(0);
    }
  };

  const handleScan = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFileChange}
        className="hidden"
      />

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

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-4 w-full max-w-md mb-4 border border-destructive/30 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Analyse fehlgeschlagen</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </motion.div>
      )}

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
            <p className="text-sm text-muted-foreground">KI-gestützte Analyse via Gemini</p>
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
