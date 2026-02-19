import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, CheckCircle2, ChevronRight, ArrowRight, Gavel, Wrench, Mail, Scale, AlertTriangle, X, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHandover, Finding, LegalClassification, RemediationOption } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState } from 'react';

const LEGAL_CLASSES: { value: LegalClassification; label: string; color: string; description: string }[] = [
  { value: 'Gebrauchsspur', label: 'Gebrauchsspur', color: 'text-muted-foreground', description: 'Normale Abnutzung durch vertragsgemäßen Gebrauch – kein Einbehalt' },
  { value: 'Normalverschleiß', label: 'Normalverschleiß', color: 'text-muted-foreground', description: 'Übliche Alterung des Materials – kein Einbehalt' },
  { value: 'Schaden', label: 'Schaden', color: 'text-destructive', description: 'Über normalen Verschleiß hinausgehende Beschädigung – Einbehalt möglich' },
  { value: 'Vertragswidriger Schaden', label: 'Vertragswidriger Schaden', color: 'text-destructive font-bold', description: 'Vorsätzliche oder grob fahrlässige Beschädigung – voller Einbehalt' },
];

function addWeeksToDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface FindingDetailProps {
  finding: Finding;
  onUpdate: (updated: Partial<Finding>) => void;
  onClose: () => void;
}

const FindingDetail = ({ finding, onUpdate, onClose }: FindingDetailProps) => {
  const lc = LEGAL_CLASSES.find(l => l.value === finding.legalClassification);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="font-bold text-lg">{finding.room} – {finding.damageType}</h3>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-6">
        {/* Photo */}
        {finding.photoUrl && (
          <div className="rounded-2xl overflow-hidden">
            <img src={finding.photoUrl} alt="Mangel" className="w-full max-h-52 object-cover" />
          </div>
        )}

        {/* KI-Analyse */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">KI-Materialanalyse</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-secondary/40 rounded-xl p-2">
              <p className="text-muted-foreground">Material</p>
              <p className="font-semibold">{finding.material}</p>
            </div>
            <div className="bg-secondary/40 rounded-xl p-2">
              <p className="text-muted-foreground">Zeitwert-Abzug</p>
              <p className="font-semibold">{finding.timeValueDeduction}% (Neu für Alt)</p>
            </div>
          </div>
          <div className="bg-secondary/40 rounded-xl p-2 text-xs">
            <p className="text-muted-foreground mb-1">BGH-Referenz</p>
            <p className="font-mono font-medium">{finding.bghReference}</p>
          </div>
          <p className="text-xs text-muted-foreground">{finding.description}</p>
        </div>

        {/* Rechtliche Einordnung */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gavel className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">Rechtliche Einordnung</p>
          </div>
          <Select
            value={finding.legalClassification || ''}
            onValueChange={(v) => onUpdate({ legalClassification: v as LegalClassification })}
          >
            <SelectTrigger className="rounded-xl bg-secondary/50 border-0">
              <SelectValue placeholder="Bitte klassifizieren…" />
            </SelectTrigger>
            <SelectContent>
              {LEGAL_CLASSES.map(lc => (
                <SelectItem key={lc.value} value={lc.value}>
                  <span className={lc.color}>{lc.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lc && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground mt-2 px-1">
              {lc.description}
            </motion.p>
          )}
        </div>

        {/* Mängelbeseitigungs-Logik */}
        {(finding.legalClassification === 'Schaden' || finding.legalClassification === 'Vertragswidriger Schaden') && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Mängelbeseitigung (§ 281 BGB)</p>
            </div>

            <div className="space-y-2">
              {/* Option A – Selbst */}
              <button
                onClick={() => onUpdate({ remediationOption: 'self', remediationDeadline: undefined })}
                className={`w-full text-left rounded-xl p-3 border-2 transition-colors ${
                  finding.remediationOption === 'self'
                    ? 'border-success bg-success/10'
                    : 'border-border hover:border-primary/40 bg-secondary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {finding.remediationOption === 'self' ? <CheckCircle2 className="w-4 h-4 text-success" /> : <div className="w-4 h-4 rounded-full border-2 border-muted" />}
                  <p className="text-sm font-semibold">Option A – Selbst beheben</p>
                </div>
                <p className="text-xs text-muted-foreground pl-6">Wird durch die ausgewählte Partei selbst behoben.</p>
                {finding.remediationOption === 'self' && (
                  <Select
                    value={finding.remediationParty || ''}
                    onValueChange={(v) => onUpdate({ remediationParty: v })}
                  >
                    <SelectTrigger className="mt-2 rounded-xl bg-background border border-border text-xs h-8">
                      <SelectValue placeholder="Wer behebt?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vermieter">Vermieter</SelectItem>
                      <SelectItem value="Mieter">Mieter</SelectItem>
                      <SelectItem value="Beauftragte Firma">Beauftragte Firma</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </button>

              {/* Option B – Fristsetzung */}
              <button
                onClick={() => onUpdate({
                  remediationOption: 'notice',
                  remediationDeadline: addWeeksToDate(2),
                  remediationParty: 'Mieterseite',
                })}
                className={`w-full text-left rounded-xl p-3 border-2 transition-colors ${
                  finding.remediationOption === 'notice'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40 bg-secondary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {finding.remediationOption === 'notice' ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <div className="w-4 h-4 rounded-full border-2 border-muted" />}
                  <p className="text-sm font-semibold">Option B – Schriftliche Aufforderung</p>
                </div>
                <div className="text-xs text-muted-foreground pl-6 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Mieterseite wird schriftlich zur Nachbesserung aufgefordert.
                </div>
                {finding.remediationOption === 'notice' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 ml-6 bg-primary/10 rounded-lg px-3 py-2 text-xs">
                    <p className="text-muted-foreground">Gesetzliche Frist (§ 281 BGB – 14 Tage)</p>
                    <p className="font-bold text-primary">{finding.remediationDeadline}</p>
                  </motion.div>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Einbehalt */}
        <div className="flex items-center justify-between bg-primary/5 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Euro className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Empfohlener Einbehalt</p>
          </div>
          <p className="font-bold text-lg text-primary">
            {finding.recommendedWithholding > 0 ? `${finding.recommendedWithholding} €` : 'Kein Einbehalt'}
          </p>
        </div>
      </div>

      <div className="px-4 pb-6">
        <Button onClick={onClose} className="w-full h-12 rounded-2xl font-semibold">
          Übernehmen & Schließen
        </Button>
      </div>
    </motion.div>
  );
};

export const Step10DefectAnalysis = () => {
  const { data, updateData, setCurrentStep } = useHandover();
  const { isMoveIn } = useTransactionLabels();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedFinding = data.findings.find(f => f.id === selectedId) ?? null;
  const totalCost = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const classifiedCount = data.findings.filter(f => f.legalClassification).length;

  const updateFinding = (id: string, partial: Partial<Finding>) => {
    updateData({
      findings: data.findings.map(f => f.id === id ? { ...f, ...partial } : f),
    });
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        {isMoveIn ? 'Zustandsanalyse' : 'Detailanalyse Mängel'}
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-2 text-sm">
        {isMoveIn ? 'Rechtliche Einordnung & Dokumentation' : 'Einordnung, Strategie & Fristsetzung'}
      </motion.p>

      {data.findings.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="text-xs text-muted-foreground mb-4"
        >
          {classifiedCount} / {data.findings.length} klassifiziert
        </motion.div>
      )}

      <div className="w-full max-w-md space-y-3">
        {data.findings.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="font-semibold">{isMoveIn ? 'Keine Befunde erfasst' : 'Keine Mängel erfasst'}</p>
            <p className="text-sm text-muted-foreground mt-1">Weiter zur Kautionsberechnung.</p>
          </motion.div>
        ) : (
          data.findings.map((f, i) => {
            const lc = LEGAL_CLASSES.find(l => l.value === f.legalClassification);
            return (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => setSelectedId(f.id)}
                className="w-full glass-card rounded-2xl p-4 text-left hover:ring-2 hover:ring-primary/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-destructive shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{f.room} – {f.material}</p>
                      <p className="text-xs text-muted-foreground truncate">{f.damageType}</p>
                      {lc && (
                        <p className={`text-xs font-medium mt-0.5 ${lc.color}`}>{lc.label}</p>
                      )}
                      {!f.legalClassification && (
                        <p className="text-xs text-amber-500 font-medium mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Einordnung ausstehend
                        </p>
                      )}
                      {f.remediationOption && (
                        <p className="text-xs text-primary mt-0.5">
                          {f.remediationOption === 'self' ? `✓ Selbst behoben (${f.remediationParty || '?'})` : `✉ Frist: ${f.remediationDeadline || '?'}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {f.recommendedWithholding > 0 && (
                      <span className="text-sm font-bold text-destructive">{f.recommendedWithholding} €</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </motion.button>
            );
          })
        )}

        {data.findings.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="glass-card rounded-2xl p-4 flex items-center justify-between border border-primary/20"
          >
            <div className="flex items-center gap-2">
              <Euro className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Gesamteinbehalt</span>
            </div>
            <span className="text-lg font-bold text-primary">{totalCost} €</span>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Button onClick={() => setCurrentStep(11)} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
            Weiter zur Kautionsberechnung
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedFinding && (
          <FindingDetail
            finding={selectedFinding}
            onUpdate={(partial) => updateFinding(selectedFinding.id, partial)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
