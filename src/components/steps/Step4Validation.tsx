import { motion } from 'framer-motion';
import { ArrowRight, Scale, Paintbrush, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState } from 'react';

interface EditableRowProps {
  label: string;
  value: string;
  onSave: (v: string) => void;
  filled: boolean;
}

const EditableRow = ({ label, value, onSave, filled }: EditableRowProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-border/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="h-8 text-sm rounded-lg bg-secondary/60 border-0 focus-visible:ring-1 px-2"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            />
            <button onClick={handleSave} className="shrink-0 p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleCancel} className="shrink-0 p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <p className={`text-sm font-medium truncate ${filled ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
            {value || '—'}
          </p>
        )}
      </div>
      {!editing && (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export const Step4Validation = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole, depositLabel, contractStartLabel, contractEndLabel } = useTransactionLabels();

  const rows: { key: keyof typeof data; label: string }[] = [
    { key: 'propertyAddress', label: 'Objektadresse' },
    { key: 'landlordName', label: ownerRole },
    { key: 'landlordEmail', label: `E-Mail ${ownerRole}` },
    { key: 'tenantName', label: clientRole },
    { key: 'tenantEmail', label: `E-Mail ${clientRole}` },
    { key: 'coldRent', label: 'Kaltmiete (€)' },
    { key: 'nkAdvancePayment', label: 'NK-Vorauszahlung (€)' },
    { key: 'depositAmount', label: `${depositLabel} (€)` },
    { key: 'contractStart', label: contractStartLabel },
    { key: 'contractEnd', label: contractEndLabel },
  ];

  const hasLegalAnalysis = data.depositLegalCheck || data.renovationClauseAnalysis;
  const filledCount = rows.filter(r => !!data[r.key]).length;

  const handleConfirm = () => {
    updateData({
      participants: [
        { id: '1', name: data.landlordName || ownerRole, role: ownerRole, email: data.landlordEmail, present: true },
        { id: '2', name: data.tenantName || clientRole, role: clientRole, email: data.tenantEmail, present: true },
      ]
    });
    goToStepById('floor-plan');
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-1 text-center">
        Daten-Validierung
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-5 text-sm">
        Prüfen Sie die erfassten Daten — tippen Sie zum Bearbeiten auf den ✎ Stift
      </motion.p>

      {/* Completion badge */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
        className="mb-4 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-semibold"
      >
        {filledCount} von {rows.length} Felder befüllt
      </motion.div>

      {/* Tabular summary with inline editing */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl px-5 py-2 w-full max-w-md"
      >
        {rows.map(row => (
          <EditableRow
            key={row.key}
            label={row.label}
            value={(data[row.key] as string) || ''}
            filled={!!(data[row.key])}
            onSave={v => updateData({ [row.key]: v } as any)}
          />
        ))}
      </motion.div>

      {/* Legal analysis */}
      {hasLegalAnalysis && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="w-full max-w-md mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Scale className="w-4 h-4" />
            KI-Rechtsanalyse
          </h3>
          {data.depositLegalCheck && (
            <div className="glass-card rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold">Kautionsprüfung (§ 551 BGB)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.depositLegalCheck}</p>
            </div>
          )}
          {data.renovationClauseAnalysis && (
            <div className="glass-card rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold">Schönheitsreparaturen</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.renovationClauseAnalysis}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Pre-damages */}
      {data.preDamages && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="w-full max-w-md mt-4">
          <div className="glass-card rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">🔍 Vorschäden aus Protokoll</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{data.preDamages}</p>
          </div>
        </motion.div>
      )}

      {/* Confirm button */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="w-full max-w-md mt-6">
        <Button onClick={handleConfirm} className="w-full h-13 rounded-2xl text-base font-semibold gap-2" size="lg">
          Bestätigen & Weiter
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>
    </div>
  );
};
