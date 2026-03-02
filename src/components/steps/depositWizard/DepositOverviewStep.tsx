import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, Euro, AlertTriangle, ArrowDown, ArrowUp, ArrowRight,
  Info, Pencil, Sparkles, ChevronDown, ChevronUp, Gavel, Key, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import {
  calcCompoundInterest, calcInstallmentInterest, getAiEstimate, getLegalReasoning,
} from './utils';

interface Props {
  onNext: (costOverrides: Record<string, number>) => void;
}

export const DepositOverviewStep = ({ onNext }: Props) => {
  const { data, updateData } = useHandover();
  const { depositLabel, isSale } = useTransactionLabels();

  const deposit = parseFloat(data.depositAmount) || 0;
  const tenantDefects = data.findings.filter(f => f.entryType !== 'note');
  const missingKeys = data.keyEntries.filter(k => k.count <= 0);

  const isCash = data.depositType === 'cash';
  const isGuarantee = data.depositType === 'guarantee';
  const isPledged = data.depositType === 'pledged-account';
  const isInstallments = data.depositPaymentMode === 'installments';
  const installmentDates: [string, string, string] = data.depositInstallmentDates || ['', '', ''];

  const singleResult = isCash && !isInstallments ? calcCompoundInterest(deposit, data.depositPaymentDate) : null;
  const installmentResult = isCash && isInstallments ? calcInstallmentInterest(deposit, installmentDates) : null;
  const interest = isCash ? (isInstallments ? (installmentResult?.totalInterest || 0) : (singleResult?.interest || 0)) : 0;
  const pledgedBalance = isPledged ? (parseFloat(data.pledgedAccountBalance) || 0) : 0;
  const days = singleResult?.days || 0;

  const baseAmount = isCash ? deposit + interest : isPledged ? pledgedBalance : 0;

  const [costOverrides, setCostOverrides] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    tenantDefects.forEach(f => {
      map[f.id] = f.recommendedWithholding > 0 ? f.recommendedWithholding : getAiEstimate(f.damageType);
    });
    return map;
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalCosts = Object.values(costOverrides).reduce((s, v) => s + v, 0);
  const keyDeduction = missingKeys.length * 50;
  const hasNkData = data.nkVorauszahlung > 0 || data.nkPrognose > 0;
  const nkBuffer = hasNkData ? Math.max(0, (data.nkPrognose - data.nkVorauszahlung) * 3) : 180;
  const totalDeductions = isGuarantee ? 0 : totalCosts + nkBuffer + keyDeduction;
  const saldo = baseAmount - totalDeductions;
  const payout = Math.max(0, saldo);
  const restforderung = saldo < 0 ? Math.abs(saldo) : 0;

  const payoutPercent = deposit > 0 ? Math.min(100, (payout / deposit) * 100) : 0;
  const deductPercent = deposit > 0 ? Math.min(100, (totalDeductions / deposit) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* ── Progress Bar ── */}
      {!isGuarantee && (
        <div className="glass-card-premium p-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isCash ? 'Kaution + Zinsen' : isPledged ? 'Kontostand' : 'Kaution'} (§ 6 MV)
            </span>
            <span className="text-lg font-bold font-display">{baseAmount.toFixed(2)} €</span>
          </div>
          <div className="w-full h-5 bg-secondary/60 backdrop-blur-sm rounded-full overflow-hidden flex border border-border/30">
            {totalDeductions > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${deductPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-destructive/70 rounded-l-full backdrop-blur-sm"
              />
            )}
            {payout > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${payoutPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                className="h-full bg-accent rounded-r-full backdrop-blur-sm"
              />
            )}
          </div>
          <div className="flex justify-between mt-3 text-xs">
            <span className="text-destructive font-semibold flex items-center gap-1">
              <ArrowDown className="w-3 h-3" /> Abzüge: {totalDeductions.toFixed(2)} €
            </span>
            <span className="text-accent font-semibold">
              Auszahlung: {payout.toFixed(2)} €
            </span>
          </div>
        </div>
      )}

      {/* ── Kalkulationstabelle ── */}
      {!isGuarantee && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Kalkulation</h3>
          </div>

          {isCash && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-border/30">
                <span className="text-sm">{depositLabel || 'Mietsicherheit'}{isInstallments ? ' (3 Raten)' : ''}</span>
                <span className="font-semibold">+ {deposit.toFixed(2)} €</span>
              </div>
              {interest > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border/30 text-accent">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-3 h-3" />
                    <span className="text-sm">Zinsgutschrift ({days} Tage)</span>
                  </div>
                  <span className="font-semibold">+ {interest.toFixed(2)} €</span>
                </div>
              )}
            </>
          )}

          {isPledged && (
            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-sm">Kontostand laut Sparbuch (inkl. Zinsen)</span>
              <span className="font-semibold">+ {pledgedBalance.toFixed(2)} €</span>
            </div>
          )}

          <div className="flex justify-between items-center py-2 border-b border-border/30 text-destructive">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3 h-3" />
              <span className="text-sm">Mängelkosten ({tenantDefects.length} Posten)</span>
            </div>
            <span className="font-semibold">- {totalCosts.toFixed(2)} €</span>
          </div>

          {keyDeduction > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-border/30 text-destructive">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-3 h-3" />
                <span className="text-sm">Fehlende Schlüssel ({missingKeys.length})</span>
              </div>
              <span className="font-semibold">- {keyDeduction.toFixed(2)} €</span>
            </div>
          )}

          <div className="flex justify-between items-center py-2 border-b border-border/30 text-destructive">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3 h-3" />
              <span className="text-sm">NK-Einbehalt {hasNkData ? '(KI-Prognose, 3 Mon.)' : '(Standardwert)'}</span>
            </div>
            <span className="font-semibold">- {nkBuffer.toFixed(2)} €</span>
          </div>

          <div className={`flex justify-between items-center py-3 rounded-xl px-3 -mx-1 ${restforderung > 0 ? 'bg-destructive/10' : 'bg-accent/10'}`}>
            <div className="flex items-center gap-2">
              <Euro className={`w-5 h-5 ${restforderung > 0 ? 'text-destructive' : 'text-accent'}`} />
              <span className="font-bold text-base">
                {restforderung > 0 ? 'Offene Restforderung' : 'Auszahlung'}
              </span>
            </div>
            <span className={`font-bold text-xl ${restforderung > 0 ? 'text-destructive' : 'text-accent'}`}>
              {restforderung > 0 ? restforderung.toFixed(2) : payout.toFixed(2)} €
            </span>
          </div>
        </div>
      )}

      {/* ── Forderungen (Mängel + Schlüssel) ── */}
      {!isGuarantee && tenantDefects.length > 0 && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-sm">Forderungen ({tenantDefects.length + missingKeys.length})</h3>
          </div>
          <div className="space-y-2">
            {tenantDefects.map((defect, i) => {
              const cost = costOverrides[defect.id] || 0;
              const isExpanded = expandedId === defect.id;
              const aiSuggestion = getAiEstimate(defect.damageType);
              const reasoning = getLegalReasoning(defect.damageType);

              return (
                <div key={defect.id} className="border border-border/40 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedId(isExpanded ? null : defect.id)} className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-secondary rounded-md px-1.5 py-0.5 font-medium shrink-0">{defect.room}</span>
                        <span className="text-sm font-medium truncate">{defect.damageType || defect.description?.slice(0, 30)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-destructive">{cost.toFixed(2)} €</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border/30">
                        <div className="p-3 space-y-3 bg-secondary/10">
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Gavel className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-semibold text-primary">Schiedsrichter-Spruch</span>
                            </div>
                            <p className="text-xs leading-relaxed text-foreground/80">{reasoning}</p>
                          </div>
                          {defect.description && <p className="text-xs text-muted-foreground">{defect.description}</p>}
                          <div className="flex items-center gap-2">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <label className="text-xs text-muted-foreground shrink-0">Abzug (€):</label>
                            <Input type="number" step="0.01" min="0" value={cost} onChange={e => setCostOverrides(prev => ({ ...prev, [defect.id]: parseFloat(e.target.value) || 0 }))} className="h-8 rounded-lg bg-background border-border/50 text-sm w-28" />
                          </div>
                          <button onClick={() => setCostOverrides(prev => ({ ...prev, [defect.id]: aiSuggestion }))} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <Sparkles className="w-3 h-3" />
                            KI-Vorschlag: {aiSuggestion.toFixed(2)} €
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {missingKeys.map(key => (
              <div key={key.id} className="border border-border/40 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-destructive" />
                  <div>
                    <span className="text-sm font-medium">Fehlender Schlüssel: {key.type}</span>
                    <p className="text-xs text-muted-foreground">§ 1 Ziffer 3 – Rückgabepflicht</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-destructive">50.00 €</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Anschlussvermietung ── */}
      {!isGuarantee && tenantDefects.length > 0 && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="immediateReletting"
              checked={data.immediateReletting}
              onCheckedChange={(checked) => updateData({ immediateReletting: !!checked })}
              className="mt-0.5"
            />
            <label htmlFor="immediateReletting" className="text-sm font-medium cursor-pointer leading-snug">
              Sofortige Anschlussvermietung (Einzug innerhalb von 7 Tagen)
            </label>
          </div>
          <AnimatePresence>
            {data.immediateReletting && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Datum des Neueinzugs</label>
                  <Input
                    type="date"
                    value={data.relettingDate}
                    onChange={e => updateData({ relettingDate: e.target.value })}
                    className="rounded-xl bg-secondary/50 border-0 h-9 text-sm max-w-[200px]"
                  />
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-semibold text-amber-600">§ 281 Abs. 2 BGB – Fristsetzung entbehrlich</p>
                    <p className="text-muted-foreground mt-1">
                      Aufgrund der Anschlussvermietung ist eine Nachbesserung durch den Mieter unzumutbar.
                      Alle Mängelposten werden als <strong>endgültiger Schadensersatz</strong> deklariert.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="w-3 h-3 text-primary shrink-0" />
                  <span>{tenantDefects.length} Schäden werden als endgültiger Schadensersatz verrechnet – keine 14-Tage-Frist.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!data.immediateReletting && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="w-3 h-3 text-primary shrink-0" />
              <span>Mieter erhält gesetzliche 14-Tage-Frist zur Nachbesserung gemäß § 281 Abs. 1 BGB.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Bürgschafts-Hinweis (bei Bürgschaft statt Kalkulation) ── */}
      {isGuarantee && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">Bürgschafts-Übersicht</h3>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-sm leading-relaxed">
            <p>
              Bürgschaftsurkunde Nr. <strong>{data.guaranteeNumber || '(nicht angegeben)'}</strong> – Rückgabe an Mieter.
            </p>
            {totalCosts > 0 && (
              <p className="mt-2 text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                Dokumentierte Mängel: <strong>{totalCosts.toFixed(2)} €</strong>. 
                Gesonderte Prüfung der Inanspruchnahme erforderlich.
              </p>
            )}
          </div>
        </div>
      )}

      <Button onClick={() => onNext(costOverrides)} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
        Weiter zum Abschluss
        <ArrowRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
};
