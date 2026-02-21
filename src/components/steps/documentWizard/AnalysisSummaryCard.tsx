import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useMemo } from 'react';
import type { DocType } from './types';

export interface SummaryField {
  key: string;
  label: string;
  value: string;
  required?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  onUpdate: (val: string) => void;
}

interface LegalWarning {
  type: 'error' | 'warning' | 'info';
  text: string;
}

interface Props {
  docType: DocType;
  fields: SummaryField[];
  analysisSummary?: string;
  legalWarnings?: LegalWarning[];
  onContinue: () => void;
}

export const AnalysisSummaryCard = ({ docType, fields, analysisSummary, legalWarnings = [], onContinue }: Props) => {
  // Local editable state seeded from props
  const [localValues, setLocalValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    fields.forEach(f => { init[f.key] = f.value; });
    return init;
  });

  const titles: Record<DocType, string> = {
    'main-contract': '✅ Vertrag analysiert',
    'amendment': '✅ Nachtrag analysiert',
    'handover-protocol': '✅ Protokoll analysiert',
    'utility-bill': '✅ Abrechnung analysiert',
  };

  const handleChange = (key: string, val: string, onUpdate: (v: string) => void) => {
    setLocalValues(prev => ({ ...prev, [key]: val }));
    onUpdate(val);
  };

  // Check required fields
  const requiredFields = fields.filter(f => f.required);
  const allRequiredFilled = requiredFields.every(f => {
    const val = localValues[f.key] || '';
    return val.trim() !== '';
  });

  const getFieldBorderClass = (field: SummaryField) => {
    const val = localValues[field.key] || '';
    if (field.required && val.trim() === '') return 'border-destructive/50 ring-1 ring-destructive/30';
    if (field.confidence === 'low') return 'border-yellow-400/70 ring-1 ring-yellow-400/40';
    if (field.confidence === 'medium') return 'border-yellow-300/50';
    return 'border-border';
  };

  const getConfidenceBadge = (field: SummaryField) => {
    if (field.confidence === 'low') return <span className="text-[9px] bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded-full">Bitte prüfen</span>;
    if (field.confidence === 'medium') return <span className="text-[9px] bg-yellow-300/15 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">Unsicher</span>;
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md space-y-3"
    >
      {/* Legal warnings */}
      {legalWarnings.length > 0 && (
        <div className="space-y-2">
          {legalWarnings.map((w, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl p-4 flex items-start gap-3 text-xs leading-relaxed ${
                w.type === 'error'
                  ? 'bg-destructive/10 border border-destructive/30 text-destructive'
                  : w.type === 'warning'
                  ? 'bg-yellow-400/10 border border-yellow-400/30 text-yellow-700 dark:text-yellow-300'
                  : 'bg-blue-400/10 border border-blue-400/30 text-blue-700 dark:text-blue-300'
              }`}
            >
              {w.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> :
               w.type === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> :
               <Info className="w-4 h-4 shrink-0 mt-0.5" />}
              <p>{w.text}</p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="glass-card rounded-2xl p-5 border border-success/20">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-success" />
          <h3 className="font-semibold">{titles[docType]}</h3>
        </div>

        {analysisSummary && (
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed bg-muted/50 rounded-xl p-3">
            {analysisSummary}
          </p>
        )}

        <div className="space-y-3">
          {fields.map(field => (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">{field.label}{field.required && ' *'}</Label>
                {getConfidenceBadge(field)}
              </div>
              <Input
                value={localValues[field.key] || ''}
                onChange={e => handleChange(field.key, e.target.value, field.onUpdate)}
                className={`h-9 text-sm rounded-xl bg-secondary/50 ${getFieldBorderClass(field)}`}
                placeholder={field.label}
              />
            </div>
          ))}
        </div>

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Keine Daten erkannt – bitte manuell ergänzen
          </p>
        )}
      </div>

      <Button
        onClick={onContinue}
        disabled={!allRequiredFilled}
        className="w-full rounded-2xl h-12 font-semibold"
      >
        {allRequiredFilled ? 'Weiter zum nächsten Dokument' : 'Bitte Pflichtfelder ausfüllen'}
      </Button>
    </motion.div>
  );
};
