import { motion } from 'framer-motion';
import { CheckCircle2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import type { DocType } from './types';

interface SummaryField {
  key: string;
  label: string;
  value: string;
  onUpdate: (val: string) => void;
}

interface Props {
  docType: DocType;
  fields: SummaryField[];
  analysisSummary?: string;
  onContinue: () => void;
}

export const AnalysisSummaryCard = ({ docType, fields, analysisSummary, onContinue }: Props) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const titles: Record<DocType, string> = {
    'main-contract': '✅ Vertrag analysiert',
    'amendment': '✅ Nachtrag analysiert',
    'handover-protocol': '✅ Protokoll analysiert',
    'utility-bill': '✅ Abrechnung analysiert',
  };

  const filledFields = fields.filter(f => f.value && f.value.trim() !== '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md space-y-3"
    >
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

        <div className="space-y-2">
          {filledFields.map(field => (
            <div key={field.key} className="flex items-center gap-2">
              {editingKey === field.key ? (
                <div className="flex-1 flex gap-2">
                  <Input
                    value={field.value}
                    onChange={e => field.onUpdate(e.target.value)}
                    className="h-8 text-sm rounded-lg"
                    autoFocus
                    onBlur={() => setEditingKey(null)}
                    onKeyDown={e => e.key === 'Enter' && setEditingKey(null)}
                  />
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground">{field.label}</p>
                    <p className="text-sm font-medium truncate">{field.value}</p>
                  </div>
                  <button
                    onClick={() => setEditingKey(field.key)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {filledFields.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Keine Daten erkannt – bitte manuell ergänzen
          </p>
        )}
      </div>

      <Button
        onClick={onContinue}
        className="w-full rounded-2xl h-12 font-semibold"
      >
        Weiter zum nächsten Dokument
      </Button>
    </motion.div>
  );
};
