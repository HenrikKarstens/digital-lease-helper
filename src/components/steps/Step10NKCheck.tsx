import { motion } from 'framer-motion';
import { Upload, AlertTriangle, CheckCircle2, TrendingUp, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useState, useEffect } from 'react';

export const Step10NKCheck = () => {
  const { data, updateData, goToStepById } = useHandover();
  const [uploaded, setUploaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [step, setStep] = useState(0);

  const analysisSteps = ['Lese Abrechnung...', 'Vergleiche Vorauszahlungen...', 'Erstelle Risiko-Prognose...'];

  useEffect(() => {
    if (!analyzing) return;
    if (step >= analysisSteps.length) {
      setAnalyzing(false);
      setAnalyzed(true);
      updateData({ nkVorauszahlung: 150, nkPrognose: 210, nkRisiko: 'hoch' });
      return;
    }
    const timer = setTimeout(() => setStep(s => s + 1), 900);
    return () => clearTimeout(timer);
  }, [analyzing, step]);

  const handleUpload = () => {
    setUploaded(true);
    setStep(0);
    setAnalyzing(true);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        Nebenkosten-Check
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Laden Sie die letzte NK-Abrechnung hoch
      </motion.p>

      <div className="w-full max-w-md space-y-4">
        {!uploaded && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            onClick={handleUpload}
            className="glass-card rounded-2xl p-8 border-2 border-dashed border-border/60 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors"
          >
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="font-semibold text-sm">NK-Abrechnung hochladen</p>
            <p className="text-xs text-muted-foreground">PDF oder Foto der letzten Nebenkostenabrechnung</p>
          </motion.div>
        )}

        {analyzing && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-3xl p-8 text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-14 h-14 rounded-full border-4 border-success/20 border-t-success mx-auto mb-4" />
            <h3 className="font-semibold mb-4">KI-Kostenanalyse</h3>
            <div className="space-y-3 text-left">
              {analysisSteps.map((msg, i) => (
                <motion.div key={msg} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i <= step ? 1 : 0.3, x: 0 }} className="flex items-center gap-3 text-sm">
                  {i < step ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> : i === step ? <div className="w-4 h-4 rounded-full border-2 border-success/30 border-t-success animate-spin shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />}
                  <span>{msg}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {analyzed && (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Kostenprognose 2026</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Monatl. Vorauszahlung</p>
                  <p className="text-xl font-bold">{data.nkVorauszahlung} €</p>
                </div>
                <div className="bg-destructive/10 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Prognostizierte Kosten</p>
                  <p className="text-xl font-bold text-destructive">{data.nkPrognose} €</p>
                </div>
              </div>

              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Risiko: Hoch</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Die Vorauszahlung von {data.nkVorauszahlung} € deckt voraussichtlich nicht die Energiekosten 2026. 
                    Erwartete Nachzahlung: ca. {(data.nkPrognose - data.nkVorauszahlung) * 12} € / Jahr.
                  </p>
                </div>
              </div>

              <div className="bg-primary/5 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Empfohlener NK-Puffer</p>
                <div className="flex items-center gap-1">
                  <Euro className="w-4 h-4 text-primary" />
                  <p className="text-lg font-bold text-primary">{(data.nkPrognose - data.nkVorauszahlung) * 3} €</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">3 Monatsraten Differenz als Sicherheit</p>
              </div>
            </motion.div>

            <Button onClick={() => goToStepById('certificate')} className="w-full h-12 rounded-2xl font-semibold" size="lg">
              Weiter zur Mängelübersicht
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
