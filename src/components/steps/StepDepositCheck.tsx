import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Euro, AlertTriangle, CheckCircle2, ArrowDown, ArrowUp, ArrowRight,
  Info, Scale, Pencil, Sparkles, ChevronDown, ChevronUp, Gavel,
  Handshake, Key, Landmark, FileText, PiggyBank, Calendar, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover, DepositType } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';

// ── AI cost & legal maps ──
const AI_COST_ESTIMATES: Record<string, number> = {
  'Kratzer': 80, 'Loch': 120, 'Riss': 150, 'Fleck': 60,
  'Schimmel': 350, 'Wasserschaden': 500, 'Bohrloch': 25,
  'Abplatzung': 90, 'Verfärbung': 70, 'Bruch': 200,
};
const LEGAL_REASONING: Record<string, string> = {
  'Kratzer': 'Mieterschuld gem. § 280 Abs. 1 BGB – übermäßige Abnutzung, nicht durch normalen Gebrauch (§ 538 BGB) gedeckt.',
  'Loch': 'Substanzbeschädigung gem. § 280 BGB i.V.m. § 241 Abs. 2 BGB – Schadensersatzpflicht wegen Verletzung der Obhutspflicht.',
  'Riss': 'Strukturelle Beschädigung – Mieterschuld bei Nachweis vertragswidrigen Gebrauchs (§ 538 BGB Umkehrschluss).',
  'Fleck': 'Bewertung: Ggf. normale Gebrauchsspur (§ 538 BGB). Abzug nur bei nachweislich unsachgemäßem Verhalten.',
  'Schimmel': 'Einzelfallprüfung nötig: Baumangel (§ 536 BGB) vs. falsches Lüftungsverhalten (§ 280 BGB). BGH VIII ZR 182/06.',
  'Wasserschaden': 'Mieterhaftung nur bei schuldhafter Verursachung (§ 280 BGB). Beweislast liegt beim Vermieter (BGH VIII ZR 195/03).',
  'Bohrloch': 'Vertragsmäßiger Gebrauch gem. § 535 BGB – bis zu einer angemessenen Anzahl zulässig (BGH VIII ZR 10/92). Nur Rückbau geschuldet.',
  'Abplatzung': 'Mieterschuld bei mechanischer Einwirkung gem. § 280 BGB. Alterungsbedingter Verschleiß ist ausgenommen (§ 538 BGB).',
  'Verfärbung': 'Normale Abnutzung gem. § 538 BGB, sofern keine unsachgemäße Einwirkung vorliegt. Abzug nur bei Nachweispflicht.',
  'Bruch': 'Schadensersatz gem. § 280 Abs. 1 BGB wegen Pflichtverletzung. Zeitwertabzug je nach Alter der Mietsache.',
};

function getAiEstimate(damageType: string): number {
  const lower = damageType.toLowerCase();
  for (const [key, val] of Object.entries(AI_COST_ESTIMATES)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return 100;
}
function getLegalReasoning(damageType: string): string {
  const lower = damageType.toLowerCase();
  for (const [key, val] of Object.entries(LEGAL_REASONING)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return 'Schadensersatzpflicht gem. § 280 Abs. 1 BGB – Prüfung auf vertragswidrigen Gebrauch erforderlich.';
}

/**
 * Amtliche Durchschnittszinssätze (Spareinlagen 3-monatige Kündigungsfrist)
 * Quelle: Deutsche Bundesbank – Zinsstatistik
 */
const BUNDESBANK_RATES: { year: number; rate: number }[] = [
  { year: 2021, rate: 0.01 },
  { year: 2022, rate: 0.01 },
  { year: 2023, rate: 0.35 },
  { year: 2024, rate: 0.80 },
  { year: 2025, rate: 1.10 },
  { year: 2026, rate: 1.10 },
];

function getBundesbankRate(year: number): number {
  const entry = BUNDESBANK_RATES.find(r => r.year === year);
  if (entry) return entry.rate;
  // Fallback: nearest year
  const sorted = [...BUNDESBANK_RATES].sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year));
  return sorted[0]?.rate ?? 0.5;
}

/**
 * Berechne gewichteten Durchschnittszinssatz über den gesamten Anlagezeitraum
 */
function getWeightedAverageRate(startDate: Date, endDate: Date): number {
  if (startDate >= endDate) return 0;
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (totalDays <= 0) return 0;

  let weightedSum = 0;
  let current = new Date(startDate);

  while (current < endDate) {
    const year = current.getFullYear();
    const rate = getBundesbankRate(year);
    const yearEnd = new Date(year + 1, 0, 1); // Jan 1 next year
    const periodEnd = yearEnd < endDate ? yearEnd : endDate;
    const periodDays = Math.floor((periodEnd.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    weightedSum += rate * periodDays;
    current = periodEnd;
  }

  return weightedSum / totalDays;
}

/**
 * Zinsen mit jährlicher Kapitalisierung (Zinseszins) gemäß § 551 Abs. 3 BGB.
 * Berechnung: Für jedes Kalenderjahr werden Zinsen taggenau berechnet und
 * zum Jahreswechsel dem Kapital zugeschlagen (Zinseszins-Effekt).
 */
function calcCompoundInterest(amount: number, startDateStr: string, endDate: Date = new Date()): { interest: number; days: number; breakdown: { year: number; rate: number; days: number; interest: number; capitalAfter: number }[] } {
  if (!amount || !startDateStr) return { interest: 0, days: 0, breakdown: [] };
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return { interest: 0, days: 0, breakdown: [] };
  if (start >= endDate) return { interest: 0, days: 0, breakdown: [] };

  const totalDays = Math.floor((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  let capital = amount;
  let current = new Date(start);
  const breakdown: { year: number; rate: number; days: number; interest: number; capitalAfter: number }[] = [];

  while (current < endDate) {
    const year = current.getFullYear();
    const rate = getBundesbankRate(year);
    const yearEnd = new Date(year + 1, 0, 1);
    const periodEnd = yearEnd < endDate ? yearEnd : endDate;
    const periodDays = Math.floor((periodEnd.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    const periodInterest = capital * (rate / 100) * (periodDays / 365);

    // Capitalize at year-end (Zinseszins)
    if (yearEnd <= endDate) {
      capital += periodInterest;
    }

    breakdown.push({ year, rate, days: periodDays, interest: periodInterest, capitalAfter: capital + (yearEnd > endDate ? periodInterest : 0) });
    current = periodEnd;
  }

  const totalInterest = capital + (breakdown.length > 0 && breakdown[breakdown.length - 1].year === endDate.getFullYear() ? breakdown[breakdown.length - 1].interest : 0) - amount;
  // Simpler: sum all interest from breakdown
  const sumInterest = breakdown.reduce((s, b) => s + b.interest, 0);

  return { interest: sumInterest, days: totalDays, breakdown };
}

/** Berechne Zinsen für Raten-Modell: jede Rate separat ab Einzahlung bis heute mit Zinseszins */
function calcInstallmentInterest(
  totalDeposit: number,
  dates: [string, string, string]
): { perRate: { amount: number; date: string; days: number; interest: number; breakdown: { year: number; rate: number; days: number; interest: number }[] }[]; totalInterest: number } {
  const rateAmount = totalDeposit / 3;
  const now = new Date();
  const perRate = dates.map((dateStr) => {
    const result = calcCompoundInterest(rateAmount, dateStr, now);
    return { amount: rateAmount, date: dateStr, days: result.days, interest: result.interest, breakdown: result.breakdown };
  });
  return { perRate, totalInterest: perRate.reduce((s, r) => s + r.interest, 0) };
}

function daysBetween(dateStr: string): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  if (isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function calcPaymentDeadline(weeksFromNow: number = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + weeksFromNow * 7);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const DEPOSIT_TYPES: { value: DepositType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'cash', label: 'Bar-Kaution', icon: <Euro className="w-5 h-5" />, desc: 'Vermieter hat angelegt – volle Zinspflicht (§ 551 BGB)' },
  { value: 'guarantee', label: 'Bankbürgschaft / Versicherung', icon: <FileText className="w-5 h-5" />, desc: 'Rückgabe der Urkunde – keine Zinsberechnung' },
  { value: 'pledged-account', label: 'Verpfändetes Mieterkonto', icon: <PiggyBank className="w-5 h-5" />, desc: 'Zinsen bereits bankseitig gutgeschrieben' },
];

export const StepDepositCheck = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { depositLabel, ownerRole, clientRole, isSale } = useTransactionLabels();

  const tenantDefects = data.findings.filter(f => f.entryType !== 'note');
  const deposit = parseFloat(data.depositAmount) || 0;
  const missingKeys = data.keyEntries.filter(k => k.count <= 0);

  const isCash = data.depositType === 'cash';
  const isGuarantee = data.depositType === 'guarantee';
  const isPledged = data.depositType === 'pledged-account';

  const installmentDates: [string, string, string] = data.depositInstallmentDates || ['', '', ''];
  const isInstallments = data.depositPaymentMode === 'installments';
  const singleResult = isCash && !isInstallments ? calcCompoundInterest(deposit, data.depositPaymentDate) : null;
  const singleInterest = singleResult?.interest || 0;
  const installmentResult = isCash && isInstallments
    ? calcInstallmentInterest(deposit, installmentDates)
    : null;
  const interest = isCash ? (isInstallments ? (installmentResult?.totalInterest || 0) : singleInterest) : 0;
  const pledgedBalance = isPledged ? (parseFloat(data.pledgedAccountBalance) || 0) : 0;
  const days = singleResult?.days || (!isInstallments ? daysBetween(data.depositPaymentDate) : 0);
  const paymentDeadline = calcPaymentDeadline(2);

  // Weighted average Bundesbank rate for display
  const displayRate = (() => {
    const startStr = isInstallments ? installmentDates[0] : data.depositPaymentDate;
    if (!startStr) return getBundesbankRate(new Date().getFullYear());
    const start = new Date(startStr);
    if (isNaN(start.getTime())) return getBundesbankRate(new Date().getFullYear());
    return getWeightedAverageRate(start, new Date());
  })();

  const [costOverrides, setCostOverrides] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    tenantDefects.forEach(f => {
      map[f.id] = f.recommendedWithholding > 0 ? f.recommendedWithholding : getAiEstimate(f.damageType);
    });
    return map;
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showLegalHint, setShowLegalHint] = useState(false);
  const [agreementReached, setAgreementReached] = useState(data.depositAgreementReached);

  const totalCosts = Object.values(costOverrides).reduce((s, v) => s + v, 0);
  const keyDeduction = missingKeys.length * 50;
  const hasNkData = data.nkVorauszahlung > 0 || data.nkPrognose > 0;
  const nkBuffer = hasNkData ? Math.max(0, (data.nkPrognose - data.nkVorauszahlung) * 3) : 180;
  const totalDeductions = isGuarantee ? 0 : totalCosts + nkBuffer + keyDeduction;
  const baseAmount = isCash ? deposit + interest : isPledged ? pledgedBalance : 0;
  const saldo = baseAmount - totalDeductions;
  const payout = Math.max(0, saldo);
  const restforderung = saldo < 0 ? Math.abs(saldo) : 0;
  const withheld = Math.min(baseAmount, totalDeductions);

  const tenantName = data.tenantName || clientRole;
  const landlordName = data.landlordName || ownerRole;

  const payoutPercent = deposit > 0 ? Math.min(100, (payout / deposit) * 100) : 0;
  const deductPercent = deposit > 0 ? Math.min(100, (totalDeductions / deposit) * 100) : 0;

  const handleUpdateCost = (id: string, value: number) => {
    setCostOverrides(prev => ({ ...prev, [id]: value }));
  };

  const handleAgreement = () => {
    const now = new Date().toISOString();
    setAgreementReached(true);
    const updatedFindings = data.findings.map(f => {
      if (costOverrides[f.id] !== undefined) return { ...f, recommendedWithholding: costOverrides[f.id] };
      return f;
    });
    updateData({ findings: updatedFindings, depositAgreementReached: true, depositAgreementTimestamp: now });
  };

  const handleContinue = () => {
    const updatedFindings = data.findings.map(f => {
      if (costOverrides[f.id] !== undefined) return { ...f, recommendedWithholding: costOverrides[f.id] };
      return f;
    });
    updateData({ findings: updatedFindings });
    goToStepById('defect-analysis');
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-3">
          <Gavel className="w-3.5 h-3.5" />
          Kautions-Schiedsrichter
        </div>
        <h2 className="text-2xl font-bold">{isSale ? 'Kaufpreis-Verrechnung' : 'Finanzielle Abwicklung'}</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Rechtssichere Saldierung inkl. Zinsansprüchen (§ 551 Abs. 3 BGB)
        </p>
      </motion.div>

      <div className="w-full max-w-md space-y-4">

        {/* ── Kautionsart-Auswahl ── */}
        {!isSale && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Kautionsart</h3>
            </div>
            <div className="space-y-2">
              {DEPOSIT_TYPES.map(dt => (
                <button
                  key={dt.value}
                  onClick={() => updateData({ depositType: dt.value })}
                  className={`w-full flex items-start gap-3 rounded-xl p-3 text-left transition-all border ${
                    data.depositType === dt.value
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border/40 bg-secondary/30 hover:bg-secondary/50'
                  }`}
                >
                  <div className={`mt-0.5 ${data.depositType === dt.value ? 'text-primary' : 'text-muted-foreground'}`}>{dt.icon}</div>
                  <div>
                    <span className="text-sm font-medium block">{dt.label}</span>
                    <span className="text-xs text-muted-foreground">{dt.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Bürgschafts-Felder ── */}
        {!isSale && isGuarantee && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Bürgschafts-Details</h3>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bürgschaftsurkunde Nr.</label>
              <Input
                value={data.guaranteeNumber}
                onChange={e => updateData({ guaranteeNumber: e.target.value })}
                placeholder="z. B. BU-2024-123456"
                className="rounded-xl bg-secondary/50 border-0 h-9 text-sm"
              />
            </div>
            <div className="bg-secondary/40 rounded-xl p-3 text-xs text-foreground/80 leading-relaxed">
              <Info className="w-3.5 h-3.5 inline mr-1 text-primary" />
              Die Bürgschaftsurkunde wird dem Mieter ausgehändigt. Keine Barauszahlung erforderlich.
            </div>
          </motion.div>
        )}

        {/* ── Verpfändetes Konto ── */}
        {!isSale && isPledged && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-5 space-y-3">
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
          </motion.div>
        )}

        {/* ── Zinsberechnung (nur Bar-Kaution) ── */}
        {!isSale && isCash && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Zinsen (§ 551 Abs. 3 BGB)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Zinsen stehen gemäß § 551 Abs. 3 BGB dem Mieter zu und erhöhen die rückzugebende Kaution.
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
                  // Auto-fill installment dates from contractStart
                  const start = data.depositPaymentDate || data.contractStart;
                  let dates = installmentDates;
                  if (start && dates[0] === '' && dates[1] === '' && dates[2] === '') {
                    const d0 = new Date(start);
                    const d1 = new Date(start); d1.setMonth(d1.getMonth() + 1);
                    const d2 = new Date(start); d2.setMonth(d2.getMonth() + 2);
                    const fmt = (d: Date) => d.toISOString().split('T')[0];
                    dates = [fmt(d0), fmt(d1), fmt(d2)];
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

            {/* Amtlicher Zinssatz (Info-Label) */}
            <div className="bg-secondary/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-primary shrink-0" />
              <div>
                <span className="text-xs font-semibold block">Amtlicher Zins (Ø Bundesbank): {displayRate.toFixed(2)} % p.a.</span>
                <span className="text-[10px] text-muted-foreground">Spareinlagen 3-monatige Kündigungsfrist · Zinseszins gem. § 551 III BGB</span>
              </div>
            </div>

            {/* Einmalzahlung: ein Datumsfeld */}
            {!isInstallments && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kautionszahlung am</label>
                <Input
                  type="date"
                  value={data.depositPaymentDate}
                  onChange={e => updateData({ depositPaymentDate: e.target.value })}
                  className="rounded-xl bg-secondary/50 border-0 h-9 text-sm"
                />
                {singleResult && singleResult.interest > 0 && (
                  <div className="mt-2 space-y-1">
                    {singleResult.breakdown.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 bg-accent/10 rounded-xl px-3 py-1.5 text-xs text-accent">
                        <ArrowUp className="w-3 h-3 shrink-0" />
                        <span>{b.year}: {deposit.toFixed(0)} € × {b.rate}% × {b.days} Tage = {b.interest.toFixed(2)} €</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 bg-accent/10 rounded-xl px-3 py-2 text-sm text-accent font-semibold">
                      <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                      <span>Zinsen gesamt: <strong>+ {interest.toFixed(2)} €</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3 Raten: drei Datumsfelder */}
            {isInstallments && (
              <div className="space-y-3">
                {[0, 1, 2].map(i => {
                  const rateAmount = deposit / 3;
                  const rateData = installmentResult?.perRate[i];
                  return (
                    <div key={i} className="border border-border/30 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold">{i + 1}. Rate: {rateAmount.toFixed(2)} €</span>
                        {rateData && rateData.interest > 0 && (
                          <span className="text-xs font-medium text-accent">+ {rateData.interest.toFixed(2)} € Zinsen</span>
                        )}
                      </div>
                      <Input
                        type="date"
                        value={installmentDates[i]}
                        onChange={e => {
                          const newDates = [...installmentDates] as [string, string, string];
                          newDates[i] = e.target.value;
                          updateData({ depositInstallmentDates: newDates });
                        }}
                        className="rounded-xl bg-secondary/50 border-0 h-9 text-sm"
                      />
                      {rateData && rateData.days > 0 && rateData.breakdown && (
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
              </div>
            )}

            {/* Gesamtzinsen */}
            {interest > 0 && isInstallments && (
              <div className="flex items-center gap-2 bg-accent/10 rounded-xl px-3 py-2 text-sm text-accent">
                <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                <span>Zinsen gesamt (alle Raten): <strong>+ {interest.toFixed(2)} €</strong></span>
              </div>
            )}

            {/* Transparente Zusammenfassung */}
            <div className="bg-secondary/30 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Eingezahlte Kaution</span>
                <span className="font-semibold">{deposit.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm text-accent">
                <span>+ Errechnete Zinsen</span>
                <span className="font-semibold">+ {interest.toFixed(2)} €</span>
              </div>
              <div className="border-t border-border/30 my-1" />
              <div className="flex justify-between text-sm font-bold">
                <span>Gesamt-Guthaben</span>
                <span>{(deposit + interest).toFixed(2)} €</span>
              </div>
            </div>

            {/* § 551 Abs. 3 BGB Hinweis */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs leading-relaxed">
              <Info className="w-3.5 h-3.5 inline mr-1 text-primary" />
              <strong>§ 551 Abs. 3 BGB:</strong> Die Kaution muss getrennt vom Privatvermögen des Vermieters
              bei einem Kreditinstitut zu dem für Spareinlagen mit dreimonatiger Kündigungsfrist üblichen Zinssatz angelegt werden.
            </div>
          </motion.div>
        )}

        {/* ── Progress Bar ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-2xl p-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {isCash ? 'Kaution + Zinsen' : isPledged ? 'Kontostand' : 'Kaution'} (§ 6 MV)
            </span>
            <span className="text-sm font-bold">{baseAmount.toFixed(2)} €</span>
          </div>
          <div className="w-full h-4 bg-secondary rounded-full overflow-hidden flex">
            {totalDeductions > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${deductPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-destructive/70 rounded-l-full"
              />
            )}
            {payout > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${payoutPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                className="h-full bg-accent rounded-r-full"
              />
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-destructive font-medium flex items-center gap-1">
              <ArrowDown className="w-3 h-3" /> Abzüge: {totalDeductions.toFixed(2)} €
            </span>
            <span className="text-accent font-medium">
              Auszahlung: {payout.toFixed(2)} €
            </span>
          </div>
        </motion.div>

        {/* ── Forderungen (Mängel + Schlüssel) ── */}
        {!isGuarantee && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold text-sm">Forderungen ({tenantDefects.length + missingKeys.length})</h3>
            </div>

            {tenantDefects.length === 0 && missingKeys.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-sm font-medium">Keine Forderungen</p>
                <p className="text-xs text-muted-foreground mt-1">Die Kaution wird vollständig ausgezahlt.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tenantDefects.map((defect, i) => {
                  const cost = costOverrides[defect.id] || 0;
                  const isExpanded = expandedId === defect.id;
                  const aiSuggestion = getAiEstimate(defect.damageType);
                  const reasoning = getLegalReasoning(defect.damageType);

                  return (
                    <motion.div key={defect.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="border border-border/40 rounded-xl overflow-hidden">
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
                                <Input type="number" step="0.01" min="0" value={cost} onChange={e => handleUpdateCost(defect.id, parseFloat(e.target.value) || 0)} className="h-8 rounded-lg bg-background border-border/50 text-sm w-28" />
                              </div>
                              <button onClick={() => handleUpdateCost(defect.id, aiSuggestion)} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                                <Sparkles className="w-3 h-3" />
                                KI-Vorschlag: {aiSuggestion.toFixed(2)} €
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
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
            )}
          </motion.div>
        )}

        {/* ── Kalkulationstabelle ── */}
        {!isGuarantee && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card rounded-2xl p-5 space-y-3">
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
                {interest > 0 && !isInstallments && (
                  <div className="flex justify-between items-center py-2 border-b border-border/30 text-accent">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="w-3 h-3" />
                      <span className="text-sm">Zinsgutschrift ({data.depositInterestRate}% p.a., {days} Tage)</span>
                    </div>
                    <span className="font-semibold">+ {interest.toFixed(2)} €</span>
                  </div>
                )}
                {interest > 0 && isInstallments && installmentResult && (
                  <>
                    {installmentResult.perRate.map((r, i) => r.interest > 0 && (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/20 text-accent">
                        <div className="flex items-center gap-2">
                          <ArrowUp className="w-3 h-3" />
                          <span className="text-xs">{i+1}. Rate Zinsen ({r.days} Tage)</span>
                        </div>
                        <span className="font-medium text-xs">+ {r.interest.toFixed(2)} €</span>
                      </div>
                    ))}
                  </>
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
                  {restforderung > 0 ? 'Offene Restforderung' : `Auszahlung an ${tenantName}`}
                </span>
              </div>
              <span className={`font-bold text-xl ${restforderung > 0 ? 'text-destructive' : 'text-accent'}`}>
                {restforderung > 0 ? restforderung.toFixed(2) : payout.toFixed(2)} €
              </span>
            </div>

            {!isSale && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {data.immediateReletting ? (
                  <>Zahlungsziel: <strong className="ml-1">Sofort fällig</strong> (Anschlussvermietung – § 281 Abs. 2 BGB)</>
                ) : (
                  <>Empfohlenes Zahlungsziel: <strong className="ml-1">{paymentDeadline}</strong> (14 Tage)</>
                )}
              </p>
            )}
          </motion.div>
        )}

        {/* ── Bürgschaft: Rückgabehinweis ── */}
        {!isSale && isGuarantee && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-sm">Rückgabe der Bürgschaftsurkunde</h3>
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 text-sm leading-relaxed">
              <p>
                Die Bürgschaftsurkunde Nr. <strong>{data.guaranteeNumber || '(nicht angegeben)'}</strong> wird dem Mieter ausgehändigt. Keine Barauszahlung.
              </p>
              {totalCosts > 0 && (
                <p className="mt-2 text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  Es liegen dokumentierte Mängel in Höhe von <strong>{totalCosts.toFixed(2)} €</strong> vor.
                  Eine Inanspruchnahme der Bürgschaft ist gesondert zu prüfen.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Zahlungsanweisung / IBAN ── */}
        {!isSale && !isGuarantee && (payout > 0 || restforderung > 0) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">
                {restforderung > 0 ? 'Zahlungsaufforderung (§ 7d)' : 'Zahlungsanweisung (§ 7c)'}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {restforderung > 0
                ? `Bankdaten des ${ownerRole}s für die Zahlungsaufforderung.`
                : 'Bankdaten des Empfängers für das Protokoll erfassen.'}
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kontoinhaber</label>
                <Input
                  value={data.payeeAccountHolder}
                  onChange={e => updateData({ payeeAccountHolder: e.target.value })}
                  placeholder={restforderung > 0 ? (data.landlordName || ownerRole) : (data.tenantName || 'Vor- und Nachname')}
                  className="rounded-xl bg-secondary/50 border-0 h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">IBAN</label>
                <Input
                  value={data.payeeIban}
                  onChange={e => updateData({ payeeIban: e.target.value.toUpperCase() })}
                  placeholder="DE00 0000 0000 0000 0000 00"
                  className="rounded-xl bg-secondary/50 border-0 h-9 text-sm font-mono"
                  maxLength={34}
                />
              </div>
            </div>
            {data.payeeIban && data.payeeAccountHolder && (
              <div className={`rounded-xl p-3 text-xs leading-relaxed ${restforderung > 0 ? 'bg-destructive/10 text-foreground/80' : 'bg-secondary/40 text-foreground/80'}`}>
                {restforderung > 0 ? (
                  <>
                    Der Differenzbetrag in Höhe von <strong>{restforderung.toFixed(2)} €</strong> ist bis zum{' '}
                    <strong>{paymentDeadline}</strong> auf das Konto des {ownerRole}s zu überweisen:{' '}
                    <strong>{data.payeeAccountHolder}</strong>, IBAN: <strong>{data.payeeIban}</strong>.
                    <span className="block mt-1 text-muted-foreground">Rechtsgrundlage: § 280 Abs. 1 BGB</span>
                  </>
                ) : (
                  <>
                    Der Betrag in Höhe von <strong>{payout.toFixed(2)} €</strong> ist bis zum{' '}
                    <strong>{paymentDeadline}</strong> auf das folgende Konto zu überweisen:{' '}
                    <strong>{data.payeeAccountHolder}</strong>, IBAN: <strong>{data.payeeIban}</strong>.
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Restforderung Warnung ── */}
        {restforderung > 0 && !isGuarantee && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Kaution reicht nicht aus</p>
              <p className="text-xs text-muted-foreground mt-1">
                Die Forderungen übersteigen die Kaution um <strong>{restforderung.toFixed(2)} €</strong>.
                Ein Mahnschreiben (§ 280 Abs. 1 BGB) wird dem Protokoll beigefügt.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Einigung ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className={`glass-card rounded-2xl p-5 border-2 ${agreementReached ? 'border-accent/50 bg-accent/5' : 'border-border/30'}`}
        >
          {agreementReached ? (
            <div className="text-center space-y-2">
              <Handshake className="w-8 h-8 text-accent mx-auto" />
              <p className="font-semibold text-accent">Beiderseitiges Anerkenntnis</p>
              <p className="text-xs text-muted-foreground">
                {landlordName} und {tenantName} haben die Kautionsabrechnung als verbindlich anerkannt (§ 781 BGB).
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {data.depositAgreementTimestamp && new Date(data.depositAgreementTimestamp).toLocaleString('de-DE')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Handshake className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">Einigung erzielen</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Wenn beide Parteien den Schiedsrichter-Spruch akzeptieren, wird dies als
                beiderseitiges Anerkenntnis im Protokoll vermerkt (§ 781 BGB).
              </p>
              <Button
                onClick={handleAgreement}
                variant="outline"
                className="w-full rounded-xl gap-2 border-accent text-accent hover:bg-accent/10"
              >
                <Handshake className="w-4 h-4" />
                Einigung bestätigen
              </Button>
            </div>
          )}
        </motion.div>

        {/* ── Rechtssichere Begründung ── */}
        {!isGuarantee && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-sm">Rechtssichere Begründung</h3>
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 text-sm leading-relaxed">
              <p>
                Einbehalt von <strong>{withheld.toFixed(2)} €</strong> empfohlen gemäß BGH-Rechtsprechung
                zur Absicherung künftiger Betriebskostennachzahlungen (BGH VIII ZR 71/05) sowie
                zur Deckung dokumentierter Mängel nach dem Grundsatz „Neu für Alt"
                (§ 538 BGB, BGH VIII ZR 222/15).
              </p>
              {isCash && interest > 0 && (
                <p className="mt-2">
                  Zinsgutschrift von <strong>{interest.toFixed(2)} €</strong> ({data.depositInterestRate}% p.a.
                  für {days} Tage) steht dem Mieter gemäß § 551 Abs. 3 BGB zu.
                </p>
              )}
              {isPledged && (
                <p className="mt-2">
                  Kontostand inkl. bankseitiger Zinsen: <strong>{pledgedBalance.toFixed(2)} €</strong> (laut Sparbuch).
                </p>
              )}
              <p className="mt-2 text-muted-foreground text-xs">
                Berücksichtigt: {tenantDefects.length} Mängel, NK-Risikostufe „{data.nkRisiko}".
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Rechtliche Hinweise (BGH) ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
          <button onClick={() => setShowLegalHint(!showLegalHint)} className="w-full flex items-center justify-between glass-card rounded-2xl p-4 text-left">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Rechtliche Hinweise (BGH)</span>
            </div>
            {showLegalHint ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showLegalHint && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-secondary/30 rounded-b-2xl p-4 -mt-2 pt-5 text-xs leading-relaxed text-foreground/80 space-y-2">
                  <p><strong>§ 551 Abs. 4 BGB:</strong> Die Kaution ist nach Beendigung des Mietverhältnisses zurückzugeben, sobald keine Ansprüche mehr geltend gemacht werden.</p>
                  <p><strong>BGH VIII ZR 71/05:</strong> Der {ownerRole} darf einen angemessenen Teilbetrag für noch ausstehende Betriebskostenabrechnungen einbehalten.</p>
                  <p><strong>§ 538 BGB:</strong> Normale Abnutzung ist vom Mieter nicht zu ersetzen.</p>
                  <p><strong>§ 781 BGB:</strong> Ein beiderseitiges Anerkenntnis hat Wirkung eines abstrakten Schuldanerkenntnisses.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── CTA ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="pt-2">
          <Button onClick={handleContinue} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
            <CheckCircle2 className="w-4 h-4" />
            Abrechnung übernehmen & weiter
            <ArrowRight className="w-4 h-4" />
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Die Saldierung wird in das EstateTurn-Zertifikat übernommen.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default StepDepositCheck;
