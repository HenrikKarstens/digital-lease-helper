import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, ArrowRight, Euro, ChevronDown, ChevronUp,
  TrendingDown, Shield, Camera, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover, Finding } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState } from 'react';

function addWeeksToDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface ExpandedCardProps {
  finding: Finding;
}

const ExpandedCard = ({ finding }: ExpandedCardProps) => {
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
        {finding.photoUrl ? (
          <div className="rounded-xl overflow-hidden">
            <img src={finding.photoUrl} alt="Mangel" className="w-full max-h-44 object-cover" />
          </div>
        ) : (
          <div className="rounded-xl bg-secondary/30 flex items-center justify-center h-24 gap-2 text-muted-foreground">
            <Camera className="w-4 h-4" />
            <span className="text-xs">Kein Foto erfasst</span>
          </div>
        )}

        {/* Beschreibung */}
        <div className="bg-secondary/40 rounded-xl p-3 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{finding.description}</p>
        </div>

        {/* KI-Materialanalyse */}
        <div className="bg-secondary/40 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">KI-Materialanalyse</p>
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
        </div>

        {/* Auto-strategy info */}
        {finding.recommendedWithholding > 0 && (
          <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2">
            <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Automatisch: § 281 BGB Fristsetzung</p>
              <p className="text-xs font-bold text-primary">Frist bis {finding.remediationDeadline || addWeeksToDate(2)}</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const Step10DefectAnalysis = () => {
  const { data, updateData, setCurrentStep } = useHandover();
  const { isMoveIn } = useTransactionLabels();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalWithholding = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const damageFindings = data.findings.filter(f => f.recommendedWithholding > 0);
  const realtimeTotal = damageFindings.reduce((sum, f) => sum + f.recommendedWithholding, 0);

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // Auto-apply § 281 BGB logic to all findings when proceeding
  const handleContinue = () => {
    const deadline = addWeeksToDate(2);
    const updatedFindings = data.findings.map(f => ({
      ...f,
      legalClassification: f.recommendedWithholding > 0
        ? ('Schaden' as const)
        : ('Normalverschleiß' as const),
      remediationOption: f.recommendedWithholding > 0 ? ('notice' as const) : undefined,
      remediationParty: f.recommendedWithholding > 0 ? 'Mieterseite' : undefined,
      remediationDeadline: f.recommendedWithholding > 0 ? deadline : undefined,
    }));
    updateData({ findings: updatedFindings });
    setCurrentStep(11);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* Header */}
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-1 text-center">
        {isMoveIn ? 'Zustandsübersicht' : 'Mängelübersicht'}
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
        className="text-muted-foreground text-center mb-5 text-sm">
        Bestandsaufnahme aller dokumentierten Befunde
      </motion.p>

      <div className="w-full max-w-md space-y-4">

        {/* Summary bar */}
        {data.findings.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="glass-card rounded-2xl p-4 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold">{data.findings.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Befunde</p>
            </div>
            <div className="text-center border-x border-border/30">
              <p className="text-2xl font-bold text-amber-500">{damageFindings.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Schäden</p>
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
              const isDamage = f.recommendedWithholding > 0;

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
                  {/* Collapsed header */}
                  <button
                    onClick={() => toggle(f.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {/* Status dot */}
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isDamage ? 'bg-amber-400' : 'bg-success'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{f.room}</span>
                            <span className="text-xs text-muted-foreground">{f.damageType}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">{f.material}</span>
                            {isDamage && (
                              <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Schaden
                              </span>
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

                  {/* Expandable detail – photo, description, material only */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <div className="px-4 pb-4">
                        <ExpandedCard finding={f} />
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
                <span className="text-sm font-semibold">Geschätzte Kautionsabzüge</span>
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
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Shield className="w-3 h-3 text-primary" />
              <span>Fristsetzung gem. § 281 BGB wird automatisch im Protokoll gesetzt</span>
            </div>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Button
            onClick={handleContinue}
            className="w-full h-12 rounded-2xl font-semibold gap-2"
            size="lg"
          >
            Bestandsaufnahme abschließen & zur Kautionsberechnung
            <ArrowRight className="w-4 h-4" />
          </Button>
          {damageFindings.length > 0 && (
            <p className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3 text-primary" />
              {damageFindings.length} Schäden werden automatisch mit 14-Tage-Frist versehen.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};
