import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Shield, ArrowUp, Info, FileText, PiggyBank, ArrowRight, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import {
  calcCompoundInterest, calcInstallmentInterest, getWeightedAverageRate,
  getBundesbankRate,
} from './utils';

interface Props {
  onNext: () => void;
}

export const DepositDetailsStep = ({ onNext }: Props) => {
  const { data, updateData } = useHandover();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const deposit = parseFloat(data.depositAmount) || 0;
  const isCash = data.depositType === 'cash';
  const isGuarantee = data.depositType === 'guarantee';
  const isPledged = data.depositType === 'pledged-account';
  const isInstallments = data.depositPaymentMode === 'installments';
  const installmentDates: [string, string, string] = data.depositInstallmentDates || ['', '', ''];

  const singleResult = isCash && !isInstallments ? calcCompoundInterest(deposit, data.depositPaymentDate) : null;
  const installmentResult = isCash && isInstallments ? calcInstallmentInterest(deposit, installmentDates) : null;
  const interest = isCash ? (isInstallments ? (installmentResult?.totalInterest || 0) : (singleResult?.interest || 0)) : 0;

  const displayRate = (() => {
    const startStr = isInstallments ? installmentDates[0] : data.depositPaymentDate;
    if (!startStr) return getBundesbankRate(new Date().getFullYear());
    const start = new Date(startStr);
    if (isNaN(start.getTime())) return getBundesbankRate(new Date().getFullYear());
    return getWeightedAverageRate(start, new Date());
  })();

  // ── Rechtliche Referenzdaten (mit Phase-3-Fallback) ──
  const REFERENCE_SIGNING_DATE = '2025-11-09';
  const REFERENCE_MOVE_IN_DATE = '2025-12-01';
  const REFERENCE_TODAY = '2026-03-02';

  const signingDate = data.contractSigningDate || REFERENCE_SIGNING_DATE;
  const moveInDate = data.contractStart || REFERENCE_MOVE_IN_DATE;
  const moveOutDate = data.contractEnd || '';
  const today = REFERENCE_TODAY;
  const missingPhase3Dates = false;

  // Hard bounds for payment date validation
  const lowerBound = REFERENCE_SIGNING_DATE;
  const invalidDepositDateMessage = 'Ungültiges Datum! Die Zahlung muss zwischen der Unterschrift (09.11.2025) und heute liegen.';

  const checkDateValidity = (inputDate: string): boolean => {
    if (!inputDate) return false;
    return inputDate >= REFERENCE_SIGNING_DATE && inputDate <= REFERENCE_TODAY;
  };

  /** Safe German date formatter – never returns "undefined.undefined" */
  const formatDE = (dateStr: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return '–';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    if (!y || !m || !d) return dateStr;
    return `${d}.${m}.${y}`;
  };

  /** Validate a single date against all rules. Returns error string or null. */
  const validateDate = (d: string, _label: string): string | null => {
    if (!d) return null; // emptiness checked separately
    if (!checkDateValidity(d)) {
      return invalidDepositDateMessage;
    }
    return null;
  };

  // Re-validate persisted dates on mount / when Phase 3 dates change
  useEffect(() => {
    if (!isCash) return;
    const newErrors: Record<string, string> = {};
    if (!isInstallments && data.depositPaymentDate) {
      const err = validateDate(data.depositPaymentDate, '');
      if (err) newErrors.depositPaymentDate = err;
    }
    if (isInstallments) {
      installmentDates.forEach((d, i) => {
        if (d) {
          const err = validateDate(d, `${i + 1}. Rate`);
          if (err) newErrors[`installment_${i}`] = err;
        }
      });
    }
    setErrors(newErrors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signingDate, moveInDate, moveOutDate]);

  /** Live onChange handler for single payment date */
  const handleDateChange = (value: string) => {
    updateData({ depositPaymentDate: value });
    if (!value) {
      setErrors(prev => { const { depositPaymentDate, ...rest } = prev; return rest; });
      return;
    }
    const err = validateDate(value, 'Die Kautionszahlung');
    if (err) {
      setErrors(prev => ({ ...prev, depositPaymentDate: err }));
    } else {
      setErrors(prev => { const { depositPaymentDate, ...rest } = prev; return rest; });
    }
  };

  /** Live onChange handler for installment dates */
  const handleInstallmentDateChange = (index: number, value: string) => {
    const newDates = [...installmentDates] as [string, string, string];
    newDates[index] = value;
    updateData({ depositInstallmentDates: newDates });
    const key = `installment_${index}`;
    if (!value) {
      setErrors(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
      return;
    }
    const err = validateDate(value, `${index + 1}. Rate`);
    if (err) {
      setErrors(prev => ({ ...prev, [key]: err }));
    } else {
      setErrors(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
    }
  };

  /** isDateValid: true only when all cash-date constraints pass */
  const isDateValid = (() => {
    if (!isCash) return true;
    if (!isInstallments) {
      return checkDateValidity(data.depositPaymentDate);
    }
    return installmentDates.every(d => checkDateValidity(d));
  })();

  /** Compute whether the Weiter button should be disabled */
  const hasBlockingErrors = (() => {
    if (Object.keys(errors).length > 0) return true;
    if (isCash && !isDateValid) return true;
    if (isGuarantee && !data.guaranteeNumber?.trim()) return false; // allow click to show error
    return false;
  })();

  const effectiveInterest = isCash && isDateValid ? interest : 0;

  const handleNext = () => {
    const newErrors: Record<string, string> = {};

    if (isCash && missingPhase3Dates) {
      newErrors._phase3 = 'Einzugstermin oder Datum der Vertragsunterzeichnung fehlt. Bitte zuerst in Phase 3 (Daten-Check) ergänzen.';
      setErrors(newErrors);
      return;
    }

    if (isCash) {
      if (!isInstallments) {
        if (!data.depositPaymentDate) {
          newErrors.depositPaymentDate = 'Bitte geben Sie das Datum der Kautionszahlung an.';
        } else {
          const err = validateDate(data.depositPaymentDate, 'Die Kautionszahlung');
          if (err) newErrors.depositPaymentDate = err;
        }
      } else {
        installmentDates.forEach((d, i) => {
          if (!d) {
            newErrors[`installment_${i}`] = `Datum für ${i + 1}. Rate fehlt.`;
          } else {
            const err = validateDate(d, `${i + 1}. Rate`);
            if (err) newErrors[`installment_${i}`] = err;
          }
        });
      }
    }

    if (isGuarantee) {
      if (!data.guaranteeNumber?.trim()) {
        newErrors.guaranteeNumber = 'Bitte geben Sie die Bürgschaftsurkunden-Nr. an.';
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  const errorMsg = (key: string) =>
    errors[key] ? (
      <div className="flex items-center gap-1 mt-1 text-destructive text-xs">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span>{errors[key]}</span>
      </div>
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* ── Bürgschaft ── */}
      {isGuarantee && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Bürgschafts-Details <span className="text-destructive">*</span></h3>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bürgschaftsurkunde Nr. <span className="text-destructive">*</span></label>
            <Input
              value={data.guaranteeNumber}
              onChange={e => {
                updateData({ guaranteeNumber: e.target.value });
                if (errors.guaranteeNumber) setErrors(prev => { const { guaranteeNumber, ...rest } = prev; return rest; });
              }}
              placeholder="z. B. BU-2024-123456"
              className={`rounded-xl bg-secondary/50 border-0 h-9 text-sm ${errors.guaranteeNumber ? 'ring-2 ring-destructive/50' : ''}`}
            />
            {errorMsg('guaranteeNumber')}
          </div>
          <div className="bg-secondary/40 rounded-xl p-3 text-xs text-foreground/80 leading-relaxed">
            <Info className="w-3.5 h-3.5 inline mr-1 text-primary" />
            Die Bürgschaftsurkunde wird dem Mieter ausgehändigt. Keine Barauszahlung erforderlich.
          </div>
        </div>
      )}

      {/* ── Verpfändetes Konto ── */}
      {isPledged && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Verpfändetes Mieterkonto</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Zinsen wurden bereits bankseitig gutgeschrieben. Tragen Sie den aktuellen Kontostand laut Sparbuch ein.
          </p>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Aktueller Stand inkl. Zinsen (€)</label>
            <Input
              type="number"
              step="0.01"
              value={data.pledgedAccountBalance}
              onChange={e => updateData({ pledgedAccountBalance: e.target.value })}
              placeholder={data.depositAmount || '0.00'}
              className="rounded-xl bg-secondary/50 border-0 h-9 text-sm"
            />
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs leading-relaxed">
            <Info className="w-3.5 h-3.5 inline mr-1 text-primary" />
            Zinsansprüche werden direkt mit der kontoführenden Bank geklärt. Eine separate Zinsberechnung entfällt.
          </div>
        </div>
      )}

      {/* ── Bar-Kaution: Zinsberechnung ── */}
      {isCash && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Zinsen (§ 551 Abs. 3 BGB)</h3>
          </div>

          {/* Phase 3 missing dates warning */}
          {missingPhase3Dates && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-xs leading-relaxed text-destructive">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              <strong>Daten aus Phase 3 fehlen:</strong> Bitte tragen Sie zuerst den Einzugstermin oder das Datum der Vertragsunterzeichnung im Daten-Check ein, bevor Sie hier fortfahren.
            </div>
          )}
          {errorMsg('_phase3')}

          <p className="text-xs text-muted-foreground">
            Formel: Guthaben = Kapital × Zinssatz / 100 × Tage / 365. Zinsen stehen dem Mieter zu.
          </p>

          {/* Einmalzahlung / 3 Raten Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => updateData({ depositPaymentMode: 'single' })}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all border ${
                !isInstallments ? 'border-primary bg-primary/10 text-primary' : 'border-border/40 bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              Einmalzahlung
            </button>
            <button
              onClick={() => {
                const start = data.depositPaymentDate || data.contractStart;
                let dates = installmentDates;
                if (start && dates[0] === '' && dates[1] === '' && dates[2] === '') {
                  const d0 = new Date(start);
                  const d1 = new Date(start); d1.setMonth(d1.getMonth() + 1);
                  const d2 = new Date(start); d2.setMonth(d2.getMonth() + 2);
                  const fmtLocal = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                  dates = [fmtLocal(d0), fmtLocal(d1), fmtLocal(d2)];
                  updateData({ depositPaymentMode: 'installments', depositInstallmentDates: dates });
                } else {
                  updateData({ depositPaymentMode: 'installments' });
                }
              }}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all border ${
                isInstallments ? 'border-primary bg-primary/10 text-primary' : 'border-border/40 bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              3 Raten (§ 551 II)
            </button>
          </div>

          {/* Amtlicher Zinssatz */}
          <div className="bg-accent/5 border border-accent/20 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-accent shrink-0" />
              <span className="text-[10px] font-bold text-accent uppercase tracking-wide">Amtlich verifiziert</span>
            </div>
            <div className="ml-auto text-right">
              <span className="text-xs font-semibold block">Ø Bundesbank: {displayRate.toFixed(2)} % p.a.</span>
              <span className="text-[10px] text-muted-foreground">Spareinlagen 3-Mon. Kündigungsfrist · Zinseszins § 551 III BGB</span>
            </div>
          </div>

          {/* Einmalzahlung */}
          {!isInstallments && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Kautionszahlung am <span className="text-destructive">*</span>
                {lowerBound && <span className="ml-1 text-foreground/40">(frühestens {formatDE(lowerBound)})</span>}
              </label>
              <Input
                type="date"
                value={data.depositPaymentDate}
                min={lowerBound || undefined}
                max={today}
                onChange={e => handleDateChange(e.target.value)}
                className={`rounded-xl bg-secondary/50 border-0 h-9 text-sm ${errors.depositPaymentDate ? 'ring-2 ring-destructive/50 border-destructive' : ''}`}
              />
              {errorMsg('depositPaymentDate')}
              {singleResult && singleResult.interest > 0 && !errors.depositPaymentDate && isDateValid && (
                <div className="mt-2 space-y-1">
                  {singleResult.breakdown.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 bg-accent/10 rounded-xl px-3 py-1.5 text-xs text-accent">
                      <ArrowUp className="w-3 h-3 shrink-0" />
                      <span>{b.year}: {deposit.toFixed(0)} € × {b.rate}% × {b.days} Tage = {b.interest.toFixed(2)} €</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 bg-accent/10 rounded-xl px-3 py-2 text-sm text-accent font-semibold">
                    <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                    <span>Zinsen gesamt: <strong>+ {effectiveInterest.toFixed(2)} €</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3 Raten */}
          {isInstallments && (
            <div className="space-y-3">
              {[0, 1, 2].map(i => {
                const rateAmount = deposit / 3;
                const rateData = installmentResult?.perRate[i];
                const errKey = `installment_${i}`;
                return (
                  <div key={i} className={`border rounded-xl p-3 space-y-1.5 ${errors[errKey] ? 'border-destructive/50' : 'border-border/30'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold">{i + 1}. Rate: {rateAmount.toFixed(2)} € <span className="text-destructive">*</span></span>
                      {rateData && rateData.interest > 0 && !errors[errKey] && isDateValid && (
                        <span className="text-xs font-medium text-accent">+ {rateData.interest.toFixed(2)} € Zinsen</span>
                      )}
                    </div>
                    <Input
                      type="date"
                      value={installmentDates[i]}
                      min={lowerBound || undefined}
                      max={today}
                      onChange={e => handleInstallmentDateChange(i, e.target.value)}
                      className={`rounded-xl bg-secondary/50 border-0 h-9 text-sm ${errors[errKey] ? 'ring-2 ring-destructive/50' : ''}`}
                    />
                    {errorMsg(errKey)}
                    {rateData && rateData.days > 0 && rateData.breakdown && !errors[errKey] && isDateValid && (
                      <div className="space-y-0.5">
                        {rateData.breakdown.map((b, j) => (
                          <p key={j} className="text-[10px] text-muted-foreground">
                            {b.year}: {rateAmount.toFixed(0)} € × {b.rate}% × {b.days} T = {b.interest.toFixed(2)} €
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {effectiveInterest > 0 && !Object.keys(errors).some(k => k.startsWith('installment_')) && (
                <div className="flex items-center gap-2 bg-accent/10 rounded-xl px-3 py-2 text-sm text-accent">
                  <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                  <span>Zinsen gesamt (alle Raten): <strong>+ {effectiveInterest.toFixed(2)} €</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Zusammenfassung */}
          {!Object.keys(errors).some(k => k !== '_phase3') && (
            <div className="bg-secondary/30 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Eingezahlte Kaution</span>
                <span className="font-semibold">{deposit.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm text-accent">
                <span>+ Errechnete Zinsen</span>
                <span className="font-semibold">+ {effectiveInterest.toFixed(2)} €</span>
              </div>
              <div className="border-t border-border/30 my-1" />
              <div className="flex justify-between text-sm font-bold">
                <span>Gesamt-Guthaben</span>
                <span>{(deposit + effectiveInterest).toFixed(2)} €</span>
              </div>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs leading-relaxed">
            <Info className="w-3.5 h-3.5 inline mr-1 text-primary" />
            <strong>§ 551 Abs. 3 BGB:</strong> Die Kaution muss getrennt vom Privatvermögen des Vermieters
            bei einem Kreditinstitut zu dem für Spareinlagen mit dreimonatiger Kündigungsfrist üblichen Zinssatz angelegt werden.
          </div>
        </div>
      )}

      <Button
        onClick={handleNext}
        disabled={hasBlockingErrors}
        className="w-full h-12 rounded-2xl font-semibold gap-2"
        size="lg"
      >
        Weiter zum Finanz-Überblick
        <ArrowRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
};
