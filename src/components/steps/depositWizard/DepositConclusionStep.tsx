import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Euro, AlertTriangle, CheckCircle2, ArrowRight,
  Info, CreditCard, Handshake, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import {
  calcCompoundInterest, calcInstallmentInterest, calcPaymentDeadline,
} from './utils';

interface Props {
  costOverrides: Record<string, number>;
  onFinish: () => void;
}

export const DepositConclusionStep = ({ costOverrides, onFinish }: Props) => {
  const { data, updateData } = useHandover();
  const { ownerRole, clientRole, isSale } = useTransactionLabels();

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
  const paymentDeadline = calcPaymentDeadline(2);

  const tenantName = data.tenantName || clientRole;
  const landlordName = data.landlordName || ownerRole;

  const [agreementReached, setAgreementReached] = useState(data.depositAgreementReached);
  const [showLegalHint, setShowLegalHint] = useState(false);

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
    onFinish();
  };

  // ── Determine scenario ──
  const scenarioType: 'payout' | 'guarantee-return' | 'demand' =
    isGuarantee ? 'guarantee-return' : restforderung > 0 ? 'demand' : 'payout';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* ── Scenario A: Auszahlung (Saldo positiv) ── */}
      {scenarioType === 'payout' && (
        <>
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="w-5 h-5 text-accent" />
              <h3 className="font-semibold">Auszahlung an {tenantName}</h3>
            </div>
            <div className={`flex justify-between items-center py-3 rounded-xl px-3 bg-accent/10`}>
              <span className="font-bold text-base">Endbetrag</span>
              <span className="font-bold text-xl text-accent">{payout.toFixed(2)} €</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {data.immediateReletting ? (
                <>Zahlungsziel: <strong className="ml-1">Sofort fällig</strong> (§ 281 Abs. 2 BGB)</>
              ) : (
                <>Zahlungsziel: <strong className="ml-1">{paymentDeadline}</strong> (14 Tage nach Übergabe)</>
              )}
            </p>
          </div>

          {/* IBAN */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Zahlungsanweisung (§ 7c)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Bankdaten des Empfängers für das Protokoll erfassen.
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kontoinhaber</label>
                <Input
                  value={data.payeeAccountHolder}
                  onChange={e => updateData({ payeeAccountHolder: e.target.value })}
                  placeholder={data.tenantName || 'Vor- und Nachname'}
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
              <div className="rounded-xl p-3 text-xs leading-relaxed bg-secondary/40 text-foreground/80">
                Der Betrag in Höhe von <strong>{payout.toFixed(2)} €</strong> ist bis zum{' '}
                <strong>{paymentDeadline}</strong> auf das folgende Konto zu überweisen:{' '}
                <strong>{data.payeeAccountHolder}</strong>, IBAN: <strong>{data.payeeIban}</strong>.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Scenario B: Urkunden-Rückgabe ── */}
      {scenarioType === 'guarantee-return' && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">Rückgabe der Bürgschaftsurkunde</h3>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-sm leading-relaxed">
            <p>
              Bürgschaftsurkunde Nr. <strong>{data.guaranteeNumber || '(nicht angegeben)'}</strong> wird
              dem Mieter ausgehändigt. <strong>Keine Barauszahlung.</strong>
            </p>
            {totalCosts > 0 && (
              <p className="mt-2 text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                Mängel ({totalCosts.toFixed(2)} €) führen zu gesonderter Prüfung der Inanspruchnahme.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Scenario C: Nachforderung (Saldo negativ) ── */}
      {scenarioType === 'demand' && (
        <>
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Kaution reicht nicht aus</p>
              <p className="text-xs text-muted-foreground mt-1">
                Die Forderungen übersteigen die Kaution um <strong>{restforderung.toFixed(2)} €</strong>.
                Ein Mahnschreiben gemäß § 280 Abs. 1 BGB wird dem Protokoll beigefügt.
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Zahlungsaufforderung (§ 7d)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Bankdaten des {ownerRole}s für die Zahlungsaufforderung an den Mieter.
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kontoinhaber</label>
                <Input
                  value={data.payeeAccountHolder}
                  onChange={e => updateData({ payeeAccountHolder: e.target.value })}
                  placeholder={data.landlordName || ownerRole}
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
              <div className="rounded-xl p-3 text-xs leading-relaxed bg-destructive/10 text-foreground/80">
                Der Differenzbetrag von <strong>{restforderung.toFixed(2)} €</strong> ist bis zum{' '}
                <strong>{paymentDeadline}</strong> auf das Konto des {ownerRole}s zu überweisen:{' '}
                <strong>{data.payeeAccountHolder}</strong>, IBAN: <strong>{data.payeeIban}</strong>.
                <span className="block mt-1 text-muted-foreground">Rechtsgrundlage: § 280 Abs. 1 BGB</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Einigung (§ 781 BGB) ── */}
      <div className={`glass-card rounded-2xl p-5 border-2 ${agreementReached ? 'border-accent/50 bg-accent/5' : 'border-border/30'}`}>
        {agreementReached ? (
          <div className="text-center space-y-2">
            <Handshake className="w-8 h-8 text-accent mx-auto" />
            <p className="font-semibold text-accent">Beiderseitiges Anerkenntnis</p>
            <p className="text-xs text-muted-foreground">
              {landlordName} und {tenantName} haben die Kautionsabrechnung als verbindlich anerkannt (§ 781 BGB).
            </p>
            {data.depositAgreementTimestamp && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                {new Date(data.depositAgreementTimestamp).toLocaleString('de-DE')}
              </p>
            )}
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
      </div>

      {/* ── Rechtssichere Begründung ── */}
      {!isGuarantee && (
        <div className="glass-card rounded-2xl p-5">
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
                Zinsgutschrift von <strong>{interest.toFixed(2)} €</strong> für {days} Tage
                steht dem Mieter gemäß § 551 Abs. 3 BGB zu.
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
        </div>
      )}

      {/* ── Rechtliche Hinweise (BGH) ── */}
      <div>
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
      </div>

      {/* ── CTA ── */}
      <div className="pt-2">
        <Button onClick={handleContinue} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
          <CheckCircle2 className="w-4 h-4" />
          Abrechnung übernehmen & Protokoll freischalten
          <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Die Saldierung wird in das EstateTurn-Zertifikat übernommen.
        </p>
      </div>
    </motion.div>
  );
};
