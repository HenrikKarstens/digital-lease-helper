import { motion, AnimatePresence } from 'framer-motion';
import { PenLine, AlertCircle, SkipForward, CheckCircle2, RefreshCw, Eye, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { DocumentAnalysisProgress } from './DocumentAnalysisProgress';
import { DocumentScanner } from './DocumentScanner';

import { useExtractionValidation } from './useExtractionValidation';
import type { DocStep, PagePhoto, InputMode } from './types';

const analysisStepLabels = [
  'Seiten werden geladen...',
  'KI liest Dokumentenstruktur...',
  'Parteien & Adresse werden extrahiert...',
  'Finanzielle Konditionen werden erkannt...',
  'Kautionsprüfung gemäß § 551 BGB...',
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
      { key: 'propertyStreet', label: 'Straße', placeholder: 'Musterstraße' },
      { key: 'propertyHouseNumber', label: 'Hausnummer', placeholder: '1' },
      { key: 'propertyZip', label: 'PLZ', placeholder: '12345' },
      { key: 'propertyCity', label: 'Ort', placeholder: 'Berlin' },
      { key: 'propertyFloor', label: 'Lage / Geschoss', placeholder: 'z.B. Erdgeschoss, 2. OG' },
      { key: 'propertyUnitNumber', label: 'Wohnungsnummer', placeholder: 'z.B. Whg. 3' },
      { key: 'landlordName', label: ownerRole, placeholder: `Name des ${ownerRole}s` },
      { key: 'landlordAddress', label: `Anschrift ${ownerRole}`, placeholder: 'Straße Nr, PLZ Ort' },
      { key: 'landlordEmail', label: `E-Mail ${ownerRole}`, placeholder: 'email@beispiel.de', type: 'email' },
      { key: 'tenantName', label: clientRole, placeholder: `Name des ${clientRole}s` },
      { key: 'tenantAddress', label: `Anschrift ${clientRole}`, placeholder: 'Straße Nr, PLZ Ort' },
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
  const { fields: validationFields, warnings: validationWarnings } = useExtractionValidation(data);

  const [mode, setMode] = useState<InputMode>('idle');
  const [analysisStepIdx, setAnalysisStepIdx] = useState(0);
  const [currentAnalyzingPage, setCurrentAnalyzingPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewPageIdx, setPreviewPageIdx] = useState(0);

  /** Compress an image file to max ~1.5MB for reliable AI analysis */
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      // Skip non-image files (PDFs etc.)
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxDim = 2048;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressed = new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' });
              console.log(`[EstateTurn] Compressed ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
              resolve(compressed);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const runAnalysis = async (scannedPages: PagePhoto[]) => {
    if (scannedPages.length === 0) return;

    console.log('[EstateTurn] File detected:', scannedPages.map(p => `${p.file.name} (${p.mimeType}, ${(p.file.size / 1024).toFixed(0)}KB)`));
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
      // Compress images before upload
      const compressedFiles = await Promise.all(scannedPages.map(p => compressImage(p.file)));

      const formData = new FormData();
      formData.append('transactionType', data.transactionType || 'rental');
      formData.append('documentType', docStep.id);

      compressedFiles.forEach((file, idx) => {
        setCurrentAnalyzingPage(idx + 1);
        formData.append(`file_${idx}`, file);
      });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await authFetch(`${supabaseUrl}/functions/v1/analyze-contract`, {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();
      clearInterval(interval);
      setAnalysisStepIdx(analysisStepLabels.length - 1);

      if (!response.ok) throw new Error(responseData?.error || `HTTP ${response.status}`);
      if (!responseData?.success) throw new Error(responseData?.error || 'Analyse fehlgeschlagen');

      const result = responseData.data;

      const fieldMap: Record<string, string> = {
        propertyAddress: 'propertyAddress', propertyFloor: 'propertyFloor', propertyUnitNumber: 'propertyUnitNumber',
        landlordName: 'landlordName', landlordAddress: 'landlordAddress', landlordEmail: 'landlordEmail',
        landlordPhone: 'landlordPhone', landlordBirthday: 'landlordBirthday', tenantName: 'tenantName',
        tenantAddress: 'tenantAddress', tenantEmail: 'tenantEmail', tenantPhone: 'tenantPhone', tenantBirthday: 'tenantBirthday',
        priorAddress: 'priorAddress', depositAmount: 'depositAmount', coldRent: 'coldRent',
        nkAdvancePayment: 'nkAdvancePayment', heatingCosts: 'heatingCosts', totalRent: 'totalRent',
        roomCount: 'roomCount', contractStart: 'contractStart', contractEnd: 'contractEnd',
        contractDuration: 'contractDuration', contractType: 'contractType', contractSigningDate: 'contractSigningDate',
        depositLegalCheck: 'depositLegalCheck', depositLegalStatus: 'depositLegalStatus',
        smallRepairAnalysis: 'smallRepairAnalysis', smallRepairStatus: 'smallRepairStatus',
        endRenovationAnalysis: 'endRenovationAnalysis', endRenovationStatus: 'endRenovationStatus',
        renovationClauseAnalysis: 'renovationClauseAnalysis', depositSourceRef: 'depositSourceRef',
        smallRepairSourceRef: 'smallRepairSourceRef', endRenovationSourceRef: 'endRenovationSourceRef',
        preDamages: 'preDamages', amendmentDate: 'amendmentDate',
      };

      const patch: Record<string, string> = {};
      Object.entries(fieldMap).forEach(([src, dst]) => {
        if (result[src]) patch[dst] = result[src];
      });
      // Parse propertyAddress into structured fields
      if (result.propertyAddress) {
        const addr = result.propertyAddress as string;
        // Try pattern: "Straße Nr, PLZ Ort" or "Straße Nr, PLZ Ort"
        const match = addr.match(/^(.+?)\s+(\d+\s*\w?)\s*,\s*(\d{5})\s+(.+)$/);
        if (match) {
          patch['propertyStreet'] = match[1].trim();
          patch['propertyHouseNumber'] = match[2].trim();
          patch['propertyZip'] = match[3].trim();
          patch['propertyCity'] = match[4].trim();
        } else {
          // Fallback: put entire address into street
          patch['propertyStreet'] = addr;
        }
      }
      if (docStep.id === 'amendment' && result.contractStart) {
        patch['amendmentDate'] = result.contractStart;
      }
      // Store address validation results if present
      if (result._addressValidation) {
        patch['_addressValidation'] = JSON.stringify(result._addressValidation);
      }
      // Store OCR confidence map for uncertain fields
      if (result.confidence && typeof result.confidence === 'object') {
        // Merge with existing confidence data
        const existing = (data as any)._ocrConfidence || {};
        patch['_ocrConfidence'] = JSON.stringify({ ...existing, ...result.confidence });
      }
      // Strip trailing "?" from all values (legacy AI responses) and add to confidence
      const confidenceFromQuestionMarks: Record<string, string> = {};
      for (const [key, val] of Object.entries(patch)) {
        if (typeof val === 'string' && val.endsWith('?') && key !== '_addressValidation' && key !== '_ocrConfidence') {
          patch[key] = val.slice(0, -1);
          confidenceFromQuestionMarks[key] = 'low';
        }
      }
      if (Object.keys(confidenceFromQuestionMarks).length > 0) {
        const prev = patch['_ocrConfidence'] ? JSON.parse(patch['_ocrConfidence']) : ((data as any)._ocrConfidence || {});
        patch['_ocrConfidence'] = JSON.stringify({ ...prev, ...confidenceFromQuestionMarks });
      }
      updateData(patch as any);
      console.log('[EstateTurn] Daten in globalen State geschrieben:', Object.keys(patch));

      // Skip extraction results card – go directly to data-check
      setTimeout(() => onDone(), 300);
    } catch (err: any) {
      clearInterval(interval);
      console.error('[EstateTurn] Analyse-Fehler:', err);
      setError('Daten konnten nicht automatisch extrahiert werden. Bitte nutzen Sie die manuelle Eingabe.');
      setMode('idle');
    }
  };

  const handleScannerComplete = (scannedPages: PagePhoto[]) => {
    const existingDocs = data.capturedDocuments || [];
    const existingIdx = existingDocs.findIndex(d => d.type === docStep.id);
    const newDoc = {
      id: `${docStep.id}-${Date.now()}`,
      type: docStep.id as 'main-contract' | 'amendment' | 'handover-protocol' | 'utility-bill',
      pages: scannedPages.map(p => ({ id: p.id, dataUrl: p.dataUrl, mimeType: p.mimeType })),
      analyzed: false,
    };

    const updatedDocs = existingIdx >= 0
      ? existingDocs.map((d, i) => i === existingIdx ? newDoc : d)
      : [...existingDocs, newDoc];

    updateData({ capturedDocuments: updatedDocs });
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




  // ── Manual input form ──
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

  // ── Analyzing ──
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

  // ── Done fallback ──
  if (mode === 'done') {
    onDone();
    return null;
  }

  const existingDoc = (data.capturedDocuments || []).find(d => d.type === docStep.id);

  const handleDeleteDoc = () => {
    const updatedDocs = (data.capturedDocuments || []).filter(d => d.type !== docStep.id);
    updateData({ capturedDocuments: updatedDocs });
    setShowPreview(false);
  };

  // ── Idle / capture ──
  return (
    <div className="flex flex-col px-4 py-2">
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">{docStep.icon}</span>
          <div>
            <h3 className="font-bold text-lg leading-tight">{docStep.title}</h3>
            <p className="text-xs text-muted-foreground">{docStep.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Already uploaded document preview */}
      {existingDoc && existingDoc.pages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-4 mb-4 border border-primary/20"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold">Dokument hochgeladen</span>
              <span className="text-[10px] text-muted-foreground">({existingDoc.pages.length} {existingDoc.pages.length === 1 ? 'Seite' : 'Seiten'})</span>
            </div>
          </div>

          {/* Thumbnail gallery */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {existingDoc.pages.map((page, idx) => (
              <button
                key={page.id}
                onClick={() => { setPreviewPageIdx(idx); setShowPreview(true); }}
                className="shrink-0 w-16 h-20 rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-colors relative group"
              >
                {page.dataUrl?.startsWith('data:') ? (
                  <img src={page.dataUrl} alt={`Seite ${idx + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center text-[10px] text-muted-foreground">S.{idx + 1}</div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Eye className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => { setPreviewPageIdx(0); setShowPreview(true); }} className="flex-1 rounded-xl text-xs h-9 gap-1">
              <Eye className="w-3.5 h-3.5" />
              Ansehen
            </Button>
            <Button size="sm" variant="outline" onClick={handleDeleteDoc} className="flex-1 rounded-xl text-xs h-9 gap-1 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
              Löschen & Neu
            </Button>
          </div>
        </motion.div>
      )}

      {/* Full-screen preview modal */}
      <AnimatePresence>
        {showPreview && existingDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
          >
            <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={() => setShowPreview(false)} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center w-full px-4 py-16">
              {existingDoc.pages[previewPageIdx]?.dataUrl?.startsWith('data:') ? (
                <img
                  src={existingDoc.pages[previewPageIdx].dataUrl}
                  alt={`Seite ${previewPageIdx + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-white text-sm">Vorschau nicht verfügbar</div>
              )}
            </div>
            {existingDoc.pages.length > 1 && (
              <div className="flex items-center gap-4 pb-6">
                <button
                  disabled={previewPageIdx === 0}
                  onClick={() => setPreviewPageIdx(p => p - 1)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm disabled:opacity-30"
                >
                  ← Zurück
                </button>
                <span className="text-white text-sm">{previewPageIdx + 1} / {existingDoc.pages.length}</span>
                <button
                  disabled={previewPageIdx >= existingDoc.pages.length - 1}
                  onClick={() => setPreviewPageIdx(p => p + 1)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm disabled:opacity-30"
                >
                  Weiter →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
            <Button size="sm" variant="outline" onClick={() => { setError(null); setMode('manual'); }} className="flex-1 rounded-xl text-xs h-9">
              <PenLine className="w-3.5 h-3.5" />
              Manuell eingeben
            </Button>
            <Button size="sm" variant="outline" onClick={() => setError(null)} className="flex-1 rounded-xl text-xs h-9">
              <RefreshCw className="w-3.5 h-3.5" />
              Erneut versuchen
            </Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-3">
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
