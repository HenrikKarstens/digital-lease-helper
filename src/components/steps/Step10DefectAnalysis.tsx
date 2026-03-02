import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, ArrowRight, Euro, ChevronDown, ChevronUp,
  TrendingDown, Shield, Camera, AlertTriangle, CalendarClock, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  isMoveOut: boolean;
}

const ExpandedCard = memo(({ finding, isMoveOut }: ExpandedCardProps) => {
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
              <p className="text-muted-foreground text-[10px]">Schadensart</p>
              <p className="font-semibold">{finding.damageType}</p>
            </div>
          </div>
        </div>

        {/* Financial details – move-out only */}
        {!isMoveOut ? null : (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-background/50 rounded-lg p-2">
                <p className="text-muted-foreground text-[10px]">Zeitwert-Abzug</p>
                <p className="font-semibold">{finding.timeValueDeduction}%</p>
              </div>
              <div className="bg-background/50 rounded-lg p-2">
                <p className="text-muted-foreground text-[10px]">BGH-Referenz</p>
                <p className="font-mono font-medium text-primary">{finding.bghReference}</p>
              </div>
            </div>
            {finding.recommendedWithholding > 0 && (
              <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2">
                <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Automatisch: § 281 BGB Fristsetzung</p>
                  <p className="text-xs font-bold text-primary">Frist bis {finding.remediationDeadline || addWeeksToDate(2)}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
});
ExpandedCard.displayName = 'ExpandedCard';

export const Step10DefectAnalysis = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { isMoveIn } = useTransactionLabels();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalWithholding = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const damageFindings = data.findings.filter(f => f.recommendedWithholding > 0);
  const realtimeTotal = damageFindings.reduce((sum, f) => sum + f.recommendedWithholding, 0);

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // ── 14-Tage-Regel für Anschlussvermietung (§ 281 BGB) ──
  const REFERENCE_TODAY = '2026-03-02';

  // daysUntilNewTenant: Differenz zwischen Neueinzugsdatum und heute
  const daysUntilNewTenant: number | null = (() => {
    if (!data.relettingDate) return null;
    const todayMs = new Date(REFERENCE_TODAY).getTime();
    const targetMs = new Date(data.relettingDate).getTime();
    if (isNaN(targetMs)) return null;
    return Math.round((targetMs - todayMs) / (86400000));
  })();

  const hasRelettingDate = Boolean(data.relettingDate) && daysUntilNewTenant !== null;
  const isDateInRange = hasRelettingDate && daysUntilNewTenant! >= 0 && daysUntilNewTenant! <= 14;
  const isDateTooFar = hasRelettingDate && daysUntilNewTenant! > 14;
  const isDateBeforeToday = hasRelettingDate && daysUntilNewTenant! < 0;

  // HARTE REGEL: Toggle MUSS disabled sein wenn > 14 Tage oder kein Datum
  const toggleDisabled = !isDateInRange;
  // Effektiver Wert: nur true wenn Toggle aktiv UND Datum ≤ 14 Tage
  const effectiveReletting = data.immediateReletting && isDateInRange;

  // AUTO-KORREKTUR: Wenn Toggle true aber Datum > 14 Tage → sofort auf false setzen
  if (data.immediateReletting && hasRelettingDate && !isDateInRange) {
    // Schedule update to avoid render-loop
    setTimeout(() => updateData({ immediateReletting: false }), 0);
  }

  // Button-Sperre:
  // 1. Datum in der Vergangenheit → IMMER blockiert
  // 2. Toggle aktiv aber Datum ungültig → blockiert (sollte durch Auto-Korrektur nicht vorkommen)
  // 3. Kein Datum + keine Schäden → erlaubt (Sektion nicht relevant)
  // 4. Datum > 14 Tage + Toggle aus → erlaubt (Fristsetzungs-Modus)
  const hasDamages = damageFindings.length > 0 && !isMoveIn;
  const isRelettingBlocked = hasDamages && isDateBeforeToday;

  // Auto-apply § 281 BGB logic to all findings when proceeding
  const handleContinue = () => {
    if (isRelettingBlocked) return;
    const deadline = addWeeksToDate(2);
    const isReletting = effectiveReletting;
    const updatedFindings = data.findings.map(f => ({
      ...f,
      legalClassification: f.recommendedWithholding > 0
        ? ('Schaden' as const)
        : ('Normalverschleiß' as const),
      remediationOption: f.recommendedWithholding > 0
        ? (isReletting ? undefined : ('notice' as const))
        : undefined,
      remediationParty: f.recommendedWithholding > 0
        ? (isReletting ? undefined : 'Mieterseite')
        : undefined,
      remediationDeadline: f.recommendedWithholding > 0 && !isReletting ? deadline : undefined,
    }));
    updateData({ findings: updatedFindings });
    goToStepById('unlock');
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
            className={`glass-card rounded-2xl p-4 grid ${isMoveIn ? 'grid-cols-1' : 'grid-cols-3'} gap-3`}>
            <div className="text-center">
              <p className="text-2xl font-bold">{data.findings.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Befunde</p>
            </div>
            {!isMoveIn && (
              <div className="text-center border-x border-border/30">
                <p className="text-2xl font-bold text-amber-500">{damageFindings.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Schäden</p>
              </div>
            )}
            {!isMoveIn && (
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{realtimeTotal} €</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Einbehalt</p>
              </div>
            )}
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
                        {!isMoveIn && f.recommendedWithholding > 0 && (
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
                        <ExpandedCard finding={f} isMoveOut={!isMoveIn} />
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Live total – move-out only */}
        {data.findings.length > 0 && !isMoveIn && (
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

        {/* ── Anschlussvermietung Checkbox ── */}
        {damageFindings.length > 0 && !isMoveIn && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="glass-card rounded-2xl p-4 space-y-4">
            
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              Anschlussvermietung prüfen
            </h3>

            {/* Step 1: Date input FIRST */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Einzugstermin des Nachmieters
                <span className="ml-1 text-foreground/40">(falls bekannt)</span>
              </label>
              <Input
                type="date"
                value={data.relettingDate}
                min={REFERENCE_TODAY}
                onChange={e => {
                  const val = e.target.value;
                  if (!val) {
                    updateData({ relettingDate: '', immediateReletting: false });
                    return;
                  }
                  const diff = Math.round((new Date(val).getTime() - new Date(REFERENCE_TODAY).getTime()) / (1000 * 60 * 60 * 24));
                  const inRange = diff >= 0 && diff <= 14;
                  updateData({ relettingDate: val, immediateReletting: inRange ? data.immediateReletting : false });
                }}
                className={`rounded-xl bg-secondary/50 border-0 h-9 text-sm max-w-[220px] ${(isDateBeforeToday || isDateTooFar) ? 'ring-2 ring-destructive/50 border-destructive' : ''}`}
              />
              {daysUntilNewTenant !== null && (
                <p className={`text-xs mt-1 ${isDateInRange ? 'text-accent' : 'text-muted-foreground'}`}>
                  → {daysUntilNewTenant} Tage nach Auszug
                </p>
              )}
            </div>

            {/* Step 2: Toggle – only enabled if ≤ 14 days */}
            <div className={`flex items-start gap-3 rounded-xl p-3 border transition-all ${
              !toggleDisabled
                ? 'border-border/30 bg-secondary/20' 
                : 'border-destructive/20 bg-destructive/5 opacity-60'
            }`}>
              <Checkbox
                id="immediateReletting"
                checked={effectiveReletting}
                disabled={toggleDisabled}
                onCheckedChange={(checked) => {
                  updateData({ immediateReletting: !!checked });
                }}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label 
                  htmlFor="immediateReletting" 
                  className={`text-sm font-medium leading-snug ${toggleDisabled ? 'text-muted-foreground' : 'cursor-pointer'}`}
                >
                  Sofortige Anschlussvermietung (§ 281 Abs. 2 BGB)
                </label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Nur aktivierbar bei Neueinzug innerhalb von 14 Tagen
                </p>
              </div>
            </div>

            {/* Info: Date too far → forced remediation period */}
            {isDateTooFar && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-2">
                <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold text-primary">Nachbesserungsfrist erforderlich (§ 281 Abs. 1 BGB)</p>
                  <p className="text-muted-foreground mt-1">
                    Hinweis: Da der Einzug erst in <strong>{daysUntilNewTenant} Tagen</strong> erfolgt, hat der Mieter 
                    gesetzlichen Anspruch auf eine Nachbesserungsfrist. Sofortiger Abzug unzulässig.
                  </p>
                </div>
              </motion.div>
            )}

            {isDateBeforeToday && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-destructive">
                  <p className="font-semibold">Ungültiges Datum</p>
                  <p className="mt-1">Der Neueinzug kann nicht vor heute (02.03.2026) liegen.</p>
                </div>
              </motion.div>
            )}

            {/* Info: Valid reletting selected */}
            {effectiveReletting && isDateInRange && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold text-amber-600">§ 281 Abs. 2 BGB – Fristsetzung entbehrlich</p>
                  <p className="text-muted-foreground mt-1">
                    Aufgrund der Anschlussvermietung ({daysUntilNewTenant} Tage) ist eine Nachbesserung durch den Mieter unzumutbar.
                    Alle {damageFindings.length} Mängelposten ({realtimeTotal.toFixed(2)} €) werden als <strong>sofortiger Schadensersatz</strong> vom Kautionssaldo abgezogen.
                  </p>
                </div>
              </motion.div>
            )}

            {/* No date entered yet */}
            {!data.relettingDate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3 h-3 text-primary shrink-0" />
                Geben Sie das Einzugsdatum des Nachmieters ein, um die rechtlich korrekte Abwicklung festzulegen.
              </p>
            )}
          </motion.div>
        )}

        {/* CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Button
            onClick={handleContinue}
            disabled={isRelettingBlocked}
            className="w-full h-12 rounded-2xl font-semibold gap-2"
            size="lg"
          >
            Bestandsaufnahme abschließen & zur Kautionsberechnung
            <ArrowRight className="w-4 h-4" />
          </Button>
          {damageFindings.length > 0 && !effectiveReletting && (
            <p className="text-center text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3 text-primary" />
              {damageFindings.length} Schäden werden automatisch mit 14-Tage-Frist versehen.
            </p>
          )}
          {damageFindings.length > 0 && effectiveReletting && (
            <p className="text-center text-xs text-amber-500 mt-2 flex items-center justify-center gap-1">
              <CalendarClock className="w-3 h-3" />
              {damageFindings.length} Schäden werden als endgültiger Schadensersatz verrechnet.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};
