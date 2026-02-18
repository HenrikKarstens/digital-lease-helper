import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, PenLine, ArrowRight, AlertCircle, SkipForward, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { PageGallery } from './PageGallery';
import { DocumentAnalysisProgress } from './DocumentAnalysisProgress';
import { AnalysisSummaryCard } from './AnalysisSummaryCard';
import type { DocStep, PagePhoto, InputMode } from './types';

const analysisStepLabels = [
  'Seiten werden geladen...',
  'KI liest Dokumentenstruktur...',
  'Parteien & Adresse werden extrahiert...',
  'Finanzielle Konditionen werden erkannt...',
  'Rechtliche Klauseln werden geprüft...',
  'Analyse abgeschlossen ✓',
];

interface Props {
  docStep: DocStep;
  docIndex: number;
  totalDocs: number;
  onDone: () => void;
  onSkip: () => void;
}

export const SingleDocCapture = ({ docStep, docIndex, totalDocs, onDone, onSkip }: Props) => {
  const { data, updateData } = useHandover();
  const { isSale } = useTransactionLabels();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<InputMode>('idle');
  const [pages, setPages] = useState<PagePhoto[]>([]);
  const [analysisStepIdx, setAnalysisStepIdx] = useState(0);
  const [currentAnalyzingPage, setCurrentAnalyzingPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<Record<string, string> | null>(null);

  const addPages = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        setPages(prev => [...prev, {
          id: crypto.randomUUID(),
          dataUrl,
          mimeType: file.type,
          file,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleAnalyze = async () => {
    if (pages.length === 0) return;
    setMode('analyzing');
    setError(null);
    setAnalysisStepIdx(0);

    // Animate analysis steps
    const interval = setInterval(() => {
      setAnalysisStepIdx(prev => {
        if (prev >= analysisStepLabels.length - 2) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    try {
      const formData = new FormData();
      formData.append('transactionType', data.transactionType || 'rental');
      formData.append('documentType', docStep.id);

      pages.forEach((page, idx) => {
        setCurrentAnalyzingPage(idx + 1);
        formData.append(`file_${idx}`, page.file);
      });

      const { data: responseData, error: fnError } = await supabase.functions.invoke('analyze-contract', {
        body: formData,
      });

      clearInterval(interval);
      setAnalysisStepIdx(analysisStepLabels.length - 1);

      if (fnError) throw new Error(fnError.message);
      if (!responseData?.success) throw new Error(responseData?.error || 'Analyse fehlgeschlagen');

      const result = responseData.data;

      // Merge extracted data into HandoverData
      const patch: Record<string, string> = {};
      const fieldMap: Record<string, string> = {
        propertyAddress: 'propertyAddress',
        landlordName: 'landlordName',
        landlordEmail: 'landlordEmail',
        tenantName: 'tenantName',
        tenantEmail: 'tenantEmail',
        depositAmount: 'depositAmount',
        coldRent: 'coldRent',
        nkAdvancePayment: 'nkAdvancePayment',
        contractStart: 'contractStart',
        contractEnd: 'contractEnd',
        depositLegalCheck: 'depositLegalCheck',
        renovationClauseAnalysis: 'renovationClauseAnalysis',
        preDamages: 'preDamages',
      };

      Object.entries(fieldMap).forEach(([src, dst]) => {
        if (result[src]) patch[dst] = result[src];
      });

      updateData(patch as any);

      const summaryKey = {
        'main-contract': result.depositLegalCheck || result.renovationClauseAnalysis,
        'amendment': result.amendmentSummary,
        'handover-protocol': result.protocolSummary,
        'utility-bill': result.billSummary,
      }[docStep.id];

      setAnalysisResult({ ...result, _summary: summaryKey || '' });

      setTimeout(() => setMode('done'), 500);
    } catch (err: any) {
      clearInterval(interval);
      console.error('Analysis error:', err);
      setError(err.message || 'Fehler bei der Analyse');
      setMode('idle');
    }
  };

  const getSummaryFields = () => {
    if (!analysisResult) return [];
    const fields: { key: string; label: string; value: string; onUpdate: (v: string) => void }[] = [];

    const add = (key: string, label: string, dataKey: keyof typeof data) => {
      const val = (analysisResult[key] || (data[dataKey] as string) || '').toString();
      if (val) fields.push({
        key,
        label,
        value: val,
        onUpdate: (v: string) => updateData({ [dataKey]: v } as any),
      });
    };

    if (docStep.id === 'main-contract') {
      add('propertyAddress', 'Objektadresse', 'propertyAddress');
      add('landlordName', isSale ? 'Verkäufer' : 'Vermieter', 'landlordName');
      add('tenantName', isSale ? 'Käufer' : 'Mieter', 'tenantName');
      add('coldRent', 'Kaltmiete', 'coldRent');
      add('nkAdvancePayment', 'NK-Vorauszahlung', 'nkAdvancePayment');
      add('depositAmount', isSale ? 'Kaufpreis' : 'Kaution', 'depositAmount');
    } else if (docStep.id === 'amendment') {
      add('coldRent', 'Neue Kaltmiete', 'coldRent');
      add('nkAdvancePayment', 'Neue NK-Vorauszahlung', 'nkAdvancePayment');
    } else if (docStep.id === 'handover-protocol') {
      add('preDamages', 'Vorschäden', 'preDamages');
    } else if (docStep.id === 'utility-bill') {
      add('nkAdvancePayment', 'Monatl. Vorauszahlung', 'nkAdvancePayment');
    }

    return fields;
  };

  if (mode === 'analyzing') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <DocumentAnalysisProgress
          currentPage={currentAnalyzingPage}
          totalPages={pages.length}
          steps={analysisStepLabels}
          currentStepIndex={analysisStepIdx}
        />
      </div>
    );
  }

  if (mode === 'done' && analysisResult) {
    return (
      <div className="flex flex-col items-center px-4 py-6">
        <AnalysisSummaryCard
          docType={docStep.id}
          fields={getSummaryFields()}
          analysisSummary={analysisResult._summary}
          onContinue={onDone}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        multiple
        onChange={e => { addPages(e.target.files); e.target.value = ''; }}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={e => { addPages(e.target.files); e.target.value = ''; }}
        className="hidden"
      />

      {/* Doc header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">{docStep.icon}</span>
          <div>
            <h3 className="font-bold text-lg leading-tight">{docStep.title}</h3>
            <p className="text-xs text-muted-foreground">{docStep.subtitle}</p>
          </div>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-3 mb-4 border border-destructive/30 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </motion.div>
      )}

      {/* Input options */}
      {pages.length === 0 ? (
        <div className="grid grid-cols-1 gap-3">
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => cameraInputRef.current?.click()}
            className="glass-card rounded-2xl p-5 flex items-center gap-4 text-left w-full border-2 border-primary/20 hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">Foto aufnehmen</h4>
              <p className="text-xs text-muted-foreground">Mehrere Seiten nacheinander scannen</p>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            className="glass-card rounded-2xl p-5 flex items-center gap-4 text-left w-full hover:border-primary/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-semibold">PDF / Bild hochladen</h4>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG unterstützt</p>
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDone}
            className="glass-card rounded-2xl p-5 flex items-center gap-4 text-left w-full hover:border-primary/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <PenLine className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-semibold">Manuelle Eingabe</h4>
              <p className="text-xs text-muted-foreground">Daten selbst im Formular eingeben</p>
            </div>
          </motion.button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Document frame hint */}
          <div className="relative bg-muted/30 rounded-2xl border-2 border-dashed border-primary/30 p-6 flex flex-col items-center gap-3">
            <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-primary/60 rounded-tl-lg" />
            <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-primary/60 rounded-tr-lg" />
            <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-primary/60 rounded-bl-lg" />
            <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-primary/60 rounded-br-lg" />
            <PageGallery
              pages={pages}
              onRemove={id => setPages(prev => prev.filter(p => p.id !== id))}
              onAdd={() => cameraInputRef.current?.click()}
            />
          </div>

          <Button
            onClick={handleAnalyze}
            className="w-full h-12 rounded-2xl font-semibold gap-2"
            size="lg"
          >
            KI-Analyse starten
            <ChevronRight className="w-5 h-5" />
          </Button>

          <button
            onClick={() => setPages([])}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Seiten verwerfen und neu beginnen
          </button>
        </motion.div>
      )}

      {/* Skip button (only for optional docs) */}
      {docStep.optional && pages.length === 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={onSkip}
          className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-3 w-full"
        >
          <SkipForward className="w-4 h-4" />
          Überspringen
        </motion.button>
      )}
    </div>
  );
};
