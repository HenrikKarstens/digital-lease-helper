import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, Scale, CalendarClock, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExtractedField {
  key: string;
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'error';
  hint?: string;
}

interface ValidationWarning {
  type: 'deposit' | 'date' | 'missing' | 'address';
  title: string;
  description: string;
  severity: 'warning' | 'error';
  legalRef?: string;
}

interface Props {
  fields: ExtractedField[];
  warnings: ValidationWarning[];
  onConfirm: () => void;
  onRescan: () => void;
}

const StatusIcon = ({ status }: { status: 'ok' | 'warning' | 'error' }) => {
  if (status === 'ok') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
  return <XCircle className="w-3.5 h-3.5 text-destructive" />;
};

export const ExtractionResultCard = ({ fields, warnings, onConfirm, onRescan }: Props) => {
  const filledCount = fields.filter(f => f.value).length;
  const hasErrors = warnings.some(w => w.severity === 'error');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">Extrahierte Vertragsdaten</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filledCount} von {fields.length} Feldern erkannt
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${
          filledCount === fields.length
            ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-amber-500/10 text-amber-600'
        }`}>
          {Math.round((filledCount / fields.length) * 100)}%
        </span>
      </div>

      {/* Warnings */}
      <AnimatePresence>
        {warnings.map((warning, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`glass-card rounded-2xl p-4 border ${
              warning.severity === 'error'
                ? 'border-destructive/30 bg-destructive/5'
                : 'border-amber-500/30 bg-amber-500/5'
            }`}
          >
            <div className="flex items-start gap-3">
              {warning.type === 'deposit' ? (
                <Scale className={`w-5 h-5 shrink-0 mt-0.5 ${
                  warning.severity === 'error' ? 'text-destructive' : 'text-amber-600'
                }`} />
              ) : warning.type === 'address' ? (
                <MapPinOff className={`w-5 h-5 shrink-0 mt-0.5 ${
                  warning.severity === 'error' ? 'text-destructive' : 'text-amber-600'
                }`} />
              ) : (
                <CalendarClock className={`w-5 h-5 shrink-0 mt-0.5 ${
                  warning.severity === 'error' ? 'text-destructive' : 'text-amber-600'
                }`} />
              )}
              <div>
                <p className={`text-xs font-semibold mb-0.5 ${
                  warning.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {warning.title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {warning.description}
                </p>
                {warning.legalRef && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1 font-medium">
                    {warning.legalRef}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Extracted fields grid */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {fields.map((field, idx) => (
          <motion.div
            key={field.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * idx }}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              idx < fields.length - 1 ? 'border-b border-border/40' : ''
            }`}
          >
            <StatusIcon status={field.status} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {field.label}
              </p>
              <p className={`text-sm font-medium truncate ${
                field.value ? 'text-foreground' : 'text-muted-foreground/40 italic'
              }`}>
                {field.value || '—'}
              </p>
              {field.hint && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{field.hint}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="space-y-3 pt-2">
        <Button
          onClick={onConfirm}
          className="w-full h-13 rounded-2xl text-base font-semibold gap-2"
          size="lg"
        >
          {hasErrors ? 'Trotzdem übernehmen & prüfen' : 'Daten übernehmen & weiter'}
          <ArrowRight className="w-5 h-5" />
        </Button>
        <button
          onClick={onRescan}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Erneut scannen (weitere Seiten)
        </button>
      </div>
    </motion.div>
  );
};
