import { motion } from 'framer-motion';
import { ArrowRight, Pencil, Check, X, FileText, BookOpen } from 'lucide-react';
import { DeepParagraphCheck } from './DeepParagraphCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState } from 'react';
import { toast } from 'sonner';
import { Step3SmartEntry } from './Step3SmartEntry';

// ── Editable Row ──────────────────────────────────────────────────────
interface EditableRowProps {
  label: string;
  value: string;
  sourceRef?: string;
  onSave: (v: string) => void;
  filled: boolean;
  rowId?: string;
}

const EditableRow = ({ label, value, sourceRef, onSave, filled, rowId }: EditableRowProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => { onSave(draft); setEditing(false); };
  const handleCancel = () => { setDraft(value); setEditing(false); };
  const handleBlur = () => { if (draft !== value) { onSave(draft); } setEditing(false); };

  return (
    <div id={rowId} className="flex items-center gap-2 py-2.5 border-b border-border/40 last:border-0 scroll-mt-20">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
          {sourceRef && (
            <span className="text-[9px] text-muted-foreground/60 mb-0.5 flex items-center gap-0.5">
              <BookOpen className="w-2.5 h-2.5" />
              {sourceRef}
            </span>
          )}
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="h-8 text-sm rounded-lg bg-secondary/60 border-0 focus-visible:ring-1 px-2"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
              onBlur={(e) => {
                // Don't auto-save if user clicked save or cancel button
                const related = e.relatedTarget as HTMLElement;
                if (related?.closest('[data-edit-action]')) return;
                handleBlur();
              }}
            />
            <button data-edit-action onClick={handleSave} className="shrink-0 p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button data-edit-action onClick={handleCancel} className="shrink-0 p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
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

// ── Source reference mapping for Borchardt contract ─────────────────
const FIELD_SOURCE_REFS: Record<string, string> = {
  contractStart: '§ 2 Abs. 1',
  coldRent: '§ 3 Abs. 1',
  depositAmount: '§ 6 Abs. 1',
  nkAdvancePayment: '§ 4',
  heatingCosts: '§ 4',
  contractEnd: '§ 2 Abs. 2',
  contractType: '§ 2',
};

// ── Main Component ──────────────────────────────────────────────────
export const Step4Validation = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole, depositLabel, contractStartLabel, contractEndLabel } = useTransactionLabels();

  const hasAnalysisData = !!(data.propertyAddress || data.landlordName || data.tenantName || data.coldRent);
  const [showScanner, setShowScanner] = useState(!hasAnalysisData);

  const isMoveIn = data.handoverDirection === 'move-in';

  const toggleClause = (clauseId: string) => {
    const current = data.strickenClauses || [];
    const updated = current.includes(clauseId)
      ? current.filter(c => c !== clauseId)
      : [...current, clauseId];
    updateData({ strickenClauses: updated });

    if (updated.includes(clauseId)) {
      toast.success('Klausel als gestrichen markiert.');
    } else {
      toast.info('Klausel wiederhergestellt.');
    }
  };

  const rows: { key: keyof typeof data; label: string }[] = [
    { key: 'propertyAddress', label: 'Objektadresse' },
    { key: 'roomCount', label: 'Zimmeranzahl' },
    { key: 'landlordName', label: ownerRole },
    { key: 'landlordEmail', label: `E-Mail ${ownerRole}` },
    { key: 'landlordPhone', label: `Mobilnummer ${ownerRole}` },
    { key: 'landlordBirthday', label: `Geburtstag ${ownerRole}` },
    { key: 'tenantName', label: clientRole },
    { key: 'tenantEmail', label: `E-Mail ${clientRole}` },
    { key: 'tenantPhone', label: `Mobilnummer ${clientRole}` },
    { key: 'tenantBirthday', label: `Geburtstag ${clientRole}` },
    ...(isMoveIn ? [{ key: 'priorAddress' as keyof typeof data, label: 'Voranschrift' }] : []),
    ...(!isMoveIn ? [{ key: 'nextAddress' as keyof typeof data, label: 'Nachanschrift (neue Adresse)' }] : []),
    { key: 'coldRent', label: 'Kaltmiete (€)' },
    { key: 'nkAdvancePayment', label: 'NK-Vorauszahlung (€)' },
    { key: 'heatingCosts', label: 'Heiz-/Warmwasserkosten (€)' },
    { key: 'totalRent', label: 'Gesamtmiete (€)' },
    { key: 'depositAmount', label: `${depositLabel} (€)` },
    { key: 'contractStart', label: contractStartLabel },
    { key: 'contractEnd', label: contractEndLabel },
    { key: 'contractType', label: 'Vertragsart' },
    { key: 'contractSigningDate', label: 'Datum Vertragsunterzeichnung' },
  ];

  const hasLegalAnalysis = !!(data.deepLegalClauses?.length);
  const filledCount = rows.filter(r => !!data[r.key]).length;
  const stricken = data.strickenClauses || [];

  const handleConfirm = () => {
    updateData({
      participants: [
        { id: '1', name: data.landlordName || ownerRole, role: ownerRole, email: data.landlordEmail || '', present: true },
        { id: '2', name: data.tenantName || clientRole, role: clientRole, email: data.tenantEmail || '', present: true },
      ]
    });
    goToStepById('participants');
  };

  if (showScanner) {
    return (
      <div className="min-h-[80vh] flex flex-col">
        <Step3SmartEntry onComplete={() => setShowScanner(false)} embedded />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-4">
      {/* Compact header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Daten-Check & Rechtsanalyse</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Prüfen, korrigieren & bestätigen
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
              {filledCount}/{rows.length}
            </span>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-[11px] font-medium hover:text-foreground transition-colors"
            >
              <FileText className="w-3 h-3" />
              + Dokument
            </button>
          </div>
        </div>
      </motion.div>

      {/* Unified Legal Analysis (Deep Paragraph Check) */}
      <div className="w-full max-w-md pb-3">
        <DeepParagraphCheck />
      </div>

      {/* Scrollable editable validation fields */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl px-5 py-2 w-full max-w-md"
      >
        {rows.map(row => (
          <EditableRow
            key={row.key}
            rowId={`row-${row.key}`}
            label={row.label}
            sourceRef={FIELD_SOURCE_REFS[row.key as string]}
            value={(data[row.key] as string) || ''}
            filled={!!(data[row.key])}
            onSave={v => updateData({ [row.key]: v } as any)}
          />
        ))}
      </motion.div>

      {/* Pre-damages */}
      {data.preDamages && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="w-full max-w-md mt-3">
          <div className="glass-card rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">🔍 Vorschäden aus Protokoll</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{data.preDamages}</p>
          </div>
        </motion.div>
      )}

      {/* Confirm button */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="w-full max-w-md mt-5">
        <Button onClick={handleConfirm} className="w-full h-13 rounded-2xl text-base font-semibold gap-2" size="lg">
          Daten bestätigen & Protokoll starten
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>
    </div>
  );
};
