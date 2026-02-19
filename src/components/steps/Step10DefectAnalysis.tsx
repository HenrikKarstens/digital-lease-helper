import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, CheckCircle2, ArrowRight, Gavel, Wrench, Mail, Scale,
  AlertTriangle, Euro, ChevronDown, ChevronUp, TrendingDown, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHandover, Finding, LegalClassification } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState } from 'react';

const LEGAL_CLASSES: {
  value: LegalClassification;
  label: string;
  short: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}[] = [
  {
    value: 'Normalverschleiß',
    label: 'Normalverschleiß',
    short: 'Verschleiß',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/40',
    borderColor: 'border-border',
    description: 'Übliche Alterung des Materials – kein Einbehalt möglich',
  },
  {
    value: 'Gebrauchsspur',
    label: 'Gebrauchsspur',
    short: 'Gebrauch',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/40',
    borderColor: 'border-border',
    description: 'Normale Abnutzung durch vertragsgemäßen Gebrauch – kein Einbehalt',
  },
  {
    value: 'Schaden',
    label: 'Schaden',
    short: 'Schaden',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-400/40',
    description: 'Über normalen Verschleiß hinausgehende Beschädigung – Einbehalt möglich',
  },
  {
    value: 'Vertragswidriger Schaden',
    label: 'Vertragswidriger Schaden',
    short: 'Vertragswidrig',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/40',
    description: 'Vorsätzliche oder grob fahrlässige Beschädigung – voller Einbehalt',
  },
];

function addWeeksToDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface ExpandedCardProps {
  finding: Finding;
  onUpdate: (partial: Partial<Finding>) => void;
}

const ExpandedCard = ({ finding, onUpdate }: ExpandedCardProps) => {
  const lc = LEGAL_CLASSES.find(l => l.value === finding.legalClassification);
  const isDamage = finding.legalClassification === 'Schaden' || finding.legalClassification === 'Vertragswidriger Schaden';

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden"
    >
      <div className="pt-3 space-y-3">
        {/* Photo */}
        {finding.photoUrl && (
          <div className="rounded-xl overflow-hidden">
            <img src={finding.photoUrl} alt="Mangel" className="w-full max-h-44 object-cover" />
          </div>
        )}

        {/* KI-Analyse */}
        <div className="bg-secondary/40 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Scale className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-semibold">KI-Materialanalyse</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-background/50 rounded-lg p-2">
              <p className="text-muted-foreground text-[10px]">Material</p>
              <p className="font-semibold">{finding.material}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-2">
              <p className="text-muted-foreground text-[10px]">Zeitwert-Abzug</p>
              <p className="font-semibold">{finding.timeValueDeduction}%</p>
            </div>
          </div>
          <div className="bg-background/50 rounded-lg p-2 text-xs">
            <p className="text-muted-foreground text-[10px] mb-0.5">BGH-Referenz</p>
            <p className="font-mono font-medium text-primary">{finding.bghReference}</p>
          </div>
          <p className="text-xs text-muted-foreground">{finding.description}</p>
        </div>

        {/* Rechtliche Einordnung – 3 inline buttons + Vertragswidrig select */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Gavel className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-semibold">Rechtliche Einordnung</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {LEGAL_CLASSES.map(cls => (
              <button
                key={cls.value}
                onClick={() => onUpdate({ legalClassification: cls.value, remediationOption: undefined, remediationDeadline: undefined })}
                className={`rounded-xl px-3 py-2 text-xs font-semibold border-2 transition-all text-left ${
                  finding.legalClassification === cls.value
                    ? `${cls.bgColor} ${cls.borderColor} ${cls.color}`
                    : 'border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/30'
                }`}
              >
                {cls.short}
              </button>
            ))}
          </div>
          {lc && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-muted-foreground px-1">
              {lc.description}
            </motion.p>
          )}
        </div>

        {/* Mängelbeseitigung – only when classified as damage */}
        <AnimatePresence>
          {isDamage && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold">Beseitigungs-Strategie (§ 281 BGB)</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Option A */}
                <button
                  onClick={() => onUpdate({ remediationOption: 'self', remediationDeadline: undefined })}
                  className={`rounded-xl p-3 border-2 text-left transition-all ${
                    finding.remediationOption === 'self'
                      ? 'border-amber-400/60 bg-amber-500/10'
                      : 'border-border/50 bg-secondary/30 hover:border-amber-400/30'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-3 h-3 rounded-full border-2 ${finding.remediationOption === 'self' ? 'bg-amber-500 border-amber-500' : 'border-muted-foreground'}`} />
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Option A</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Einbehalt / Selbst beheben</p>
                </button>

                {/* Option B */}
                <button
                  onClick={() => onUpdate({
                    remediationOption: 'notice',
                    remediationDeadline: addWeeksToDate(2),
                    remediationParty: 'Mieterseite',
                  })}
                  className={`rounded-xl p-3 border-2 text-left transition-all ${
                    finding.remediationOption === 'notice'
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-border/50 bg-secondary/30 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-3 h-3 rounded-full border-2 ${finding.remediationOption === 'notice' ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                    <p className="text-xs font-bold text-primary">Option B</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Fristsetzung Nachbesserung</p>
                </button>
              </div>

              {/* Option A: party picker */}
              <AnimatePresence>
                {finding.remediationOption === 'self' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Select
                      value={finding.remediationParty || ''}
                      onValueChange={(v) => onUpdate({ remediationParty: v })}
                    >
                      <SelectTrigger className="rounded-xl h-9 bg-secondary/50 border-0 text-xs">
                        <SelectValue placeholder="Wer behebt?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vermieter">Vermieter</SelectItem>
                        <SelectItem value="Mieter">Mieter</SelectItem>
                        <SelectItem value="Beauftragte Firma">Beauftragte Firma</SelectItem>
                      </SelectContent>
                    </Select>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Option B: deadline */}
              <AnimatePresence>
                {finding.remediationOption === 'notice' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2"
                  >
                    <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Gesetzliche Frist (14 Tage)</p>
                      <p className="text-xs font-bold text-primary">{finding.remediationDeadline}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export const Step10DefectAnalysis = () => {
  const { data, updateData, setCurrentStep } = useHandover();
  const { isMoveIn } = useTransactionLabels();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  const totalWithholding = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const classifiedCount = data.findings.filter(f => f.legalClassification).length;
  const allClassified = data.findings.length > 0 && classifiedCount === data.findings.length;

  const updateFinding = (id: string, partial: Partial<Finding>) => {
    updateData({
      findings: data.findings.map(f => f.id === id ? { ...f, ...partial } : f),
    });
  };

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    setViewedIds(prev => new Set(prev).add(id));
  };

  const damageFindings = data.findings.filter(f =>
    f.legalClassification === 'Schaden' || f.legalClassification === 'Vertragswidriger Schaden'
  );
  const realtimeTotal = damageFindings.reduce((sum, f) => sum + f.recommendedWithholding, 0);

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* Header */}
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-1 text-center">
        {isMoveIn ? 'Zustandsanalyse' : 'Mängelanalyse'}
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
        className="text-muted-foreground text-center mb-5 text-sm">
        {isMoveIn ? 'Einordnung & Dokumentation aller Befunde' : 'Rechtliche Einordnung & Beseitigungs-Strategie'}
      </motion.p>

      <div className="w-full max-w-md space-y-4">

        {/* Summary bar */}
        {data.findings.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="glass-card rounded-2xl p-4 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold">{data.findings.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Mängel</p>
            </div>
            <div className="text-center border-x border-border/30">
              <p className="text-2xl font-bold text-amber-500">{classifiedCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Klassifiziert</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{realtimeTotal} €</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Einbehalt</p>
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {data.findings.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-card rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="font-semibold">{isMoveIn ? 'Keine Befunde erfasst' : 'Keine Mängel erfasst'}</p>
            <p className="text-sm text-muted-foreground mt-1">Weiter zur Kautionsberechnung.</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {data.findings.map((f, i) => {
              const isOpen = expandedId === f.id;
              const lc = LEGAL_CLASSES.find(l => l.value === f.legalClassification);
              const classified = !!f.legalClassification;
              const strategySet = f.remediationOption !== undefined;
              const needsStrategy = f.legalClassification === 'Schaden' || f.legalClassification === 'Vertragswidriger Schaden';
              const isComplete = classified && (!needsStrategy || strategySet);

              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={`glass-card rounded-2xl overflow-hidden border-2 transition-colors ${
                    isOpen ? 'border-primary/40' : 'border-transparent'
                  }`}
                >
                  {/* Collapsed header – always visible */}
                  <button
                    onClick={() => toggle(f.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {/* Status dot */}
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isComplete ? 'bg-success' : 'bg-amber-400'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{f.room}</span>
                            <span className="text-xs text-muted-foreground">{f.damageType}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">{f.material}</span>
                            {lc ? (
                              <span className={`text-xs font-medium ${lc.color}`}>{lc.short}</span>
                            ) : (
                              <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Ausstehend
                              </span>
                            )}
                            {f.remediationOption === 'notice' && (
                              <span className="text-xs text-primary font-medium">✉ Frist gesetzt</span>
                            )}
                            {f.remediationOption === 'self' && (
                              <span className="text-xs text-amber-500 font-medium">💰 Einbehalt</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {f.recommendedWithholding > 0 && (
                          <span className="text-sm font-bold text-destructive">{f.recommendedWithholding} €</span>
                        )}
                        <div className="text-muted-foreground">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expandable detail */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <div className="px-4 pb-4">
                        <ExpandedCard
                          finding={f}
                          onUpdate={(partial) => updateFinding(f.id, partial)}
                        />
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Live total */}
        {data.findings.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold">Kautionsabzüge (live)</span>
              </div>
              <motion.span
                key={realtimeTotal}
                initial={{ scale: 1.15, color: 'hsl(var(--destructive))' }}
                animate={{ scale: 1 }}
                className="text-xl font-bold text-destructive"
              >
                {realtimeTotal} €
              </motion.span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>Klassifiziert: {classifiedCount} / {data.findings.length}</span>
              </div>
              {!allClassified && (
                <span className="text-amber-500 font-medium">Noch {data.findings.length - classifiedCount} ausstehend</span>
              )}
              {allClassified && (
                <span className="text-success font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Vollständig
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Button
            onClick={() => setCurrentStep(11)}
            disabled={data.findings.length > 0 && !allClassified}
            className="w-full h-12 rounded-2xl font-semibold gap-2"
            size="lg"
          >
            Analyse abschließen & zur Kautionsberechnung
            <ArrowRight className="w-4 h-4" />
          </Button>
          {data.findings.length > 0 && !allClassified && (
            <p className="text-center text-xs text-muted-foreground mt-2">
              Bitte alle Mängel klassifizieren, um fortzufahren.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};
