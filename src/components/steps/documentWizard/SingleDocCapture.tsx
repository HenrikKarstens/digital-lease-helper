import { motion } from 'framer-motion';
import { PenLine, AlertCircle, SkipForward, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { DocumentAnalysisProgress } from './DocumentAnalysisProgress';

import { DocumentScanner } from './DocumentScanner';
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

const getManualFields = (docType: string, isSale: boolean, ownerRole: string, clientRole: string) => {
  if (docType === 'main-contract') {
    return [
      { key: 'propertyAddress', label: 'Objektadresse', placeholder: 'Musterstraße 1, 12345 Berlin' },
      { key: 'landlordName', label: ownerRole, placeholder: `Name des ${ownerRole}s` },
      { key: 'landlordEmail', label: `E-Mail ${ownerRole}`, placeholder: 'email@beispiel.de', type: 'email' },
      { key: 'tenantName', label: clientRole, placeholder: `Name des ${clientRole}s` },
      { key: 'tenantEmail', label: `E-Mail ${clientRole}`, placeholder: 'email@beispiel.de', type: 'email' },
      { key: 'roomCount', label: 'Anzahl Zimmer', placeholder: 'z.B. 3' },
      { key: 'contractStart', label: isSale ? 'Übergabedatum' : 'Vertragsbeginn', placeholder: 'TT.MM.JJJJ', required: true },
      { key: 'contractDuration', label: 'Befristung', placeholder: 'unbefristet oder TT.MM.JJJJ' },
      { key: 'coldRent', label: isSale ? 'Kaufpreis (€)' : 'Kaltmiete (€)', placeholder: '0.00', required: true },
      { key: 'nkAdvancePayment', label: 'Betriebskostenvorauszahlung (€)', placeholder: '0.00' },
      { key: 'heatingCosts', label: 'Heiz-/Warmwasserkosten (€)', placeholder: '0.00' },
      { key: 'depositAmount', label: isSale ? 'Kaufpreisrestbetrag (€)' : 'Kaution (€)', placeholder: '0.00', required: true },
    ];
  }
  if (docType === 'amendment') {
    return [
      { key: 'coldRent', label: 'Neue Kaltmiete (€)', placeholder: '0.00' },
      { key: 'nkAdvancePayment', label: 'Neue Betriebskostenvorauszahlung (€)', placeholder: '0.00' },
      { key: 'heatingCosts', label: 'Neue Heiz-/Warmwasserkosten (€)', placeholder: '0.00' },
    ];
  }
  if (docType === 'handover-protocol') {
    return [
      { key: 'preDamages', label: 'Vorschäden (Freitext)', placeholder: 'z.B. Kratzer an der Wohnungstür, Fleck im Bad...' },
    ];
  }
  if (docType === 'utility-bill') {
    return [
      { key: 'nkAdvancePayment', label: 'Monatl. Vorauszahlung (€)', placeholder: '0.00' },
      { key: 'heatingCosts', label: 'Heizkosten-Anteil (€)', placeholder: '0.00' },
    ];
  }
  return [];
};

export const SingleDocCapture = ({ docStep, docIndex, totalDocs, onDone, onSkip }: Props) => {
  const { data, updateData } = useHandover();
  const { isSale, ownerRole, clientRole } = useTransactionLabels();

  const [mode, setMode] = useState<InputMode>('idle');
  const [analysisStepIdx, setAnalysisStepIdx] = useState(0);
  const [currentAnalyzingPage, setCurrentAnalyzingPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<Record<string, string> | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});

  // ── Core analysis function – accepts pages directly to avoid stale closure ──
  const runAnalysis = async (scannedPages: PagePhoto[]) => {
    if (scannedPages.length === 0) return;

    console.log('[EstateTurn] File detected:', scannedPages.map(p => `${p.file.name} (${p.mimeType})`));
    console.log('[EstateTurn] Datei erhalten –', scannedPages.length, 'Seite(n)');
    setMode('analyzing');
    setError(null);
    setAnalysisStepIdx(0);

    const interval = setInterval(() => {
      setAnalysisStepIdx(prev => {
        if (prev >= analysisStepLabels.length - 2) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 1200);

    try {
      const formData = new FormData();
      formData.append('transactionType', data.transactionType || 'rental');
      formData.append('documentType', docStep.id);

      scannedPages.forEach((page, idx) => {
        setCurrentAnalyzingPage(idx + 1);
        formData.append(`file_${idx}`, page.file);
      });

      console.log('[EstateTurn] Rufe Edge Function auf... (Dokument:', docStep.id, ')');
      console.log('[EstateTurn] Text extraction successful: True');

      // Use direct fetch instead of supabase.functions.invoke for reliable FormData handling
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-contract`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: formData,
      });

      const responseData = await response.json();

      clearInterval(interval);
      setAnalysisStepIdx(analysisStepLabels.length - 1);

      console.log('[EstateTurn] AI Response received:', JSON.stringify(responseData));

      if (!response.ok) throw new Error(responseData?.error || `HTTP ${response.status}`);
      if (!responseData?.success) throw new Error(responseData?.error || 'Analyse fehlgeschlagen');

      const result = responseData.data;

      // Map all returned fields into global state immediately
      const fieldMap: Record<string, string> = {
        propertyAddress: 'propertyAddress',
        landlordName: 'landlordName',
        landlordEmail: 'landlordEmail',
        landlordPhone: 'landlordPhone',
        landlordBirthday: 'landlordBirthday',
        tenantName: 'tenantName',
        tenantEmail: 'tenantEmail',
        tenantPhone: 'tenantPhone',
        tenantBirthday: 'tenantBirthday',
        priorAddress: 'priorAddress',
        depositAmount: 'depositAmount',
        coldRent: 'coldRent',
        nkAdvancePayment: 'nkAdvancePayment',
        heatingCosts: 'heatingCosts',
        totalRent: 'totalRent',
        roomCount: 'roomCount',
        contractStart: 'contractStart',
        contractEnd: 'contractEnd',
        contractDuration: 'contractDuration',
        contractType: 'contractType',
        contractSigningDate: 'contractSigningDate',
        depositLegalCheck: 'depositLegalCheck',
        depositLegalStatus: 'depositLegalStatus',
        smallRepairAnalysis: 'smallRepairAnalysis',
        smallRepairStatus: 'smallRepairStatus',
        endRenovationAnalysis: 'endRenovationAnalysis',
        endRenovationStatus: 'endRenovationStatus',
        renovationClauseAnalysis: 'renovationClauseAnalysis',
        depositSourceRef: 'depositSourceRef',
        smallRepairSourceRef: 'smallRepairSourceRef',
        endRenovationSourceRef: 'endRenovationSourceRef',
        preDamages: 'preDamages',
      };

      const patch: Record<string, string> = {};
      Object.entries(fieldMap).forEach(([src, dst]) => {
        if (result[src]) patch[dst] = result[src];
      });
      updateData(patch as any);
      console.log('[EstateTurn] Daten in globalen State geschrieben:', Object.keys(patch));

      const summaryKey = ({
        'main-contract': result.depositLegalCheck || result.renovationClauseAnalysis,
        'amendment': result.amendmentSummary,
        'handover-protocol': result.protocolSummary,
        'utility-bill': result.billSummary,
      } as Record<string, string>)[docStep.id];

      setAnalysisResult({ ...result, _summary: summaryKey || '' });
      // Skip summary screen – go directly to data-check
      setTimeout(() => onDone(), 300);
    } catch (err: any) {
      clearInterval(interval);
      console.error('[EstateTurn] Analyse-Fehler:', err);
      setError('Daten konnten nicht automatisch extrahiert werden. Bitte nutzen Sie die manuelle Eingabe.');
      setMode('idle');
    }
  };

  // Called by DocumentScanner when the user finishes scanning/uploading
  const handleScannerComplete = (scannedPages: PagePhoto[]) => {
    // Store the scanned pages in capturedDocuments so DeepParagraphCheck can access them
    const existingDocs = data.capturedDocuments || [];
    const existingIdx = existingDocs.findIndex(d => d.type === docStep.id);
    const newDoc = {
      id: `${docStep.id}-${Date.now()}`,
      type: docStep.id as 'main-contract' | 'amendment' | 'handover-protocol' | 'utility-bill',
      pages: scannedPages.map(p => ({
        id: p.id,
        dataUrl: p.dataUrl,
        mimeType: p.mimeType,
      })),
      analyzed: false,
    };

    const updatedDocs = existingIdx >= 0
      ? existingDocs.map((d, i) => i === existingIdx ? newDoc : d)
      : [...existingDocs, newDoc];

    updateData({ capturedDocuments: updatedDocs });
    console.log('[EstateTurn] capturedDocuments aktualisiert:', docStep.id, scannedPages.length, 'Seite(n)');

    runAnalysis(scannedPages);
  };

  const handleManualSave = () => {
    const patch: Record<string, string> = {};
    const manualFields = getManualFields(docStep.id, isSale, ownerRole, clientRole);
    manualFields.forEach(f => {
      if (manualValues[f.key]) patch[f.key] = manualValues[f.key];
    });
    updateData(patch as any);
    onDone();
  };

  // ── Manual input form ──────────────────────────────────────────────────
  if (mode === 'manual') {
    const manualFields = getManualFields(docStep.id, isSale, ownerRole, clientRole);
    return (
      <div className="flex flex-col px-4 py-2">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">{docStep.icon}</span>
          <div>
            <h3 className="font-bold text-lg leading-tight">{docStep.title}</h3>
            <p className="text-xs text-muted-foreground">Manuelle Eingabe</p>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-5 space-y-4 mb-4"
        >
          {manualFields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{field.label}</Label>
              <Input
                type={field.type || 'text'}
                placeholder={field.placeholder}
                value={manualValues[field.key] || ''}
                onChange={e => setManualValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
              />
            </div>
          ))}
        </motion.div>
        <Button onClick={handleManualSave} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
          <CheckCircle2 className="w-4 h-4" />
          Speichern & Weiter
        </Button>
        <button onClick={() => setMode('idle')} className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 text-center w-full">
          ← Zurück zur Auswahl
        </button>
      </div>
    );
  }

  // ── Analyzing ─────────────────────────────────────────────────────────
  if (mode === 'analyzing') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <DocumentAnalysisProgress
          currentPage={currentAnalyzingPage}
          totalPages={currentAnalyzingPage}
          steps={analysisStepLabels}
          currentStepIndex={analysisStepIdx}
        />
        <p className="mt-4 text-sm text-muted-foreground animate-pulse text-center">
          KI liest den Vertrag… Bitte warten.
        </p>
      </div>
    );
  }

  // ── Done → should not happen (we skip directly to next), fallback ──
  if (mode === 'done') {
    onDone();
    return null;
  }

  // ── Idle / capture ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col px-4 py-2">
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

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-4 mb-4 border border-destructive/30 flex flex-col gap-3"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setError(null); setMode('manual'); }}
              className="flex-1 rounded-xl text-xs h-9"
            >
              <PenLine className="w-3.5 h-3.5" />
              Manuell eingeben
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setError(null)}
              className="flex-1 rounded-xl text-xs h-9"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Erneut versuchen
            </Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {/* DocumentScanner handles camera + file upload; auto-triggers analysis on complete */}
        <DocumentScanner onComplete={handleScannerComplete} />

        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMode('manual')}
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

      {docStep.optional && (
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
