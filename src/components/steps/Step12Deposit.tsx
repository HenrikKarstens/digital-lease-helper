import { motion } from 'framer-motion';
import { Scale, Euro, AlertTriangle, CheckCircle2, Shield, ArrowDown, ArrowUp, Info, CreditCard, Calendar, FileText, Landmark, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover, DepositType } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';

/** Zinsen = Kaution × (Zinssatz/100) × (Tage/360) */
function calcInterest(depositAmount: number, ratePercent: number, paymentDateStr: string): number {
  if (!depositAmount || !ratePercent || !paymentDateStr) return 0;
  const start = new Date(paymentDateStr);
  if (isNaN(start.getTime())) return 0;
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
  return depositAmount * (ratePercent / 100) * (days / 360);
}

function calcPaymentDeadline(weeksFromNow: number = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + weeksFromNow * 7);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysBetween(dateStr: string): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  if (isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

const DEPOSIT_TYPES: { value: DepositType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'cash', label: 'Bar-Kaution', icon: <Euro className="w-5 h-5" />, desc: 'Vermieter hat angelegt – volle Zinspflicht (§ 551 BGB)' },
  { value: 'guarantee', label: 'Bankbürgschaft / Versicherung', icon: <FileText className="w-5 h-5" />, desc: 'Rückgabe der Urkunde – keine Zinsberechnung' },
  { value: 'pledged-account', label: 'Verpfändetes Mieterkonto', icon: <PiggyBank className="w-5 h-5" />, desc: 'Zinsen bereits bankseitig gutgeschrieben' },
];

export const Step12Deposit = () => {
  const { data, updateData, setCurrentStep } = useHandover();
  const { depositLabel, ownerRole, isSale } = useTransactionLabels();

  const deposit = parseFloat(data.depositAmount) || 0;
  const defectsCost = data.findings.filter(f => f.entryType !== 'note').reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const hasNkData = data.nkVorauszahlung > 0 || data.nkPrognose > 0;
  const nkBuffer = hasNkData ? Math.max(0, (data.nkPrognose - data.nkVorauszahlung) * 3) : 180;

  const isCash = data.depositType === 'cash';
  const isGuarantee = data.depositType === 'guarantee';
  const isPledged = data.depositType === 'pledged-account';

  const interest = isCash ? calcInterest(deposit, data.depositInterestRate, data.depositPaymentDate) : 0;
  const pledgedBalance = isPledged ? (parseFloat(data.pledgedAccountBalance) || 0) : 0;
  const baseAmount = isCash ? deposit + interest : isPledged ? pledgedBalance : 0;
  const totalDeductions = isGuarantee ? 0 : defectsCost + nkBuffer;
  const payout = Math.max(0, baseAmount - totalDeductions);
  const withheld = Math.min(baseAmount, totalDeductions);
  const days = daysBetween(data.depositPaymentDate);
  const paymentDeadline = calcPaymentDeadline(2); // 14 Tage

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        {isSale ? 'Kaufpreis-Verrechnung' : 'Kautions-Schiedsrichter'}
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Rechtssichere Berechnung auf BGH-Basis inkl. Zinsansprüchen (§ 551 Abs. 3 BGB)
      </motion.p>

      <div className="w-full max-w-md space-y-4">

        {/* ── Kautionsart-Auswahl ── */}
        {!isSale && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-card rounded-2xl p-5 space-y-3">
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Zinsen (§ 551 Abs. 3 BGB)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Zinsen stehen gemäß § 551 Abs. 3 BGB dem Mieter zu und erhöhen die rückzugebende Kaution.
              Berechnung: Kaution × Zinssatz × Tage / 360.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Datum der Kautionszahlung</label>
                <Input
                  type="date"
                  value={data.depositPaymentDate}
                  onChange={e => updateData({ depositPaymentDate: e.target.value })}
                  className="rounded-xl bg-secondary/50 border-0 h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Zinssatz (% p.a.)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={data.depositInterestRate}
                  onChange={e => updateData({ depositInterestRate: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl bg-secondary/50 border-0 h-9 text-sm"
                  placeholder="1.5"
                />
              </div>
            </div>
            {interest > 0 && (
              <div className="flex items-center gap-2 bg-success/10 rounded-xl px-3 py-2 text-sm text-success">
                <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                <span>Aufgelaufene Zinsen ({days} Tage): <strong>+ {interest.toFixed(2)} €</strong></span>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Kalkulationstabelle (nicht bei Bürgschaft) ── */}
        {!isGuarantee && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Kalkulation</h3>
            </div>

            {isCash && (
              <>
                <div className="flex justify-between items-center py-2 border-b border-border/30">
                  <span className="text-sm">{depositLabel}</span>
                  <span className="font-semibold">+ {deposit.toFixed(2)} €</span>
                </div>
                {interest > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-border/30 text-success">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="w-3 h-3" />
                      <span className="text-sm">Zinsgutschrift ({data.depositInterestRate}% p.a., {days} Tage)</span>
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
                <span className="text-sm">
                  {data.immediateReletting ? 'Endgültiger Schadensersatz' : 'Mängelkosten'} ({data.findings.filter(f => f.entryType !== 'note').length} Posten)
                </span>
              </div>
              <span className="font-semibold">- {defectsCost.toFixed(2)} €</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-border/30 text-destructive">
              <div className="flex items-center gap-2">
                <ArrowDown className="w-3 h-3" />
                <span className="text-sm">NK-Puffer {hasNkData ? '(KI-Prognose, 3 Mon.)' : '(Standardwert)'}</span>
              </div>
              <span className="font-semibold">- {nkBuffer.toFixed(2)} €</span>
            </div>

            <div className="flex justify-between items-center py-3 bg-primary/5 rounded-xl px-3 -mx-1">
              <div className="flex items-center gap-2">
                <Euro className="w-5 h-5 text-primary" />
                <span className="font-bold text-lg">Auszuzahlender Endbetrag</span>
              </div>
              <span className="font-bold text-2xl text-primary">{payout.toFixed(2)} €</span>
            </div>

            {!isSale && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {data.immediateReletting ? (
                  <>Zahlungsziel: <strong className="ml-1">Sofort fällig</strong> (Anschlussvermietung – keine Fristsetzung gem. § 281 Abs. 2 BGB)</>
                ) : (
                  <>Empfohlenes Zahlungsziel: <strong className="ml-1">{paymentDeadline}</strong> (14 Tage nach Übergabe für den unstrittigen Teil)</>
                )}
              </p>
            )}
          </motion.div>
        )}

        {/* ── Bürgschaft: Rückgabehinweis ── */}
        {!isSale && isGuarantee && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-success" />
              <h3 className="font-semibold text-sm">Rückgabe der Bürgschaftsurkunde</h3>
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 text-sm leading-relaxed">
              <p>
                Die Bürgschaftsurkunde Nr. <strong>{data.guaranteeNumber || '(nicht angegeben)'}</strong> wird
                dem Mieter ausgehändigt. Keine Barauszahlung.
              </p>
              {defectsCost > 0 && (
                <p className="mt-2 text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  Es liegen dokumentierte Mängel in Höhe von <strong>{defectsCost.toFixed(2)} €</strong> vor.
                  Eine Inanspruchnahme der Bürgschaft ist gesondert zu prüfen.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {payout === 0 && baseAmount > 0 && !isGuarantee && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Vollständiger Einbehalt</p>
              <p className="text-xs text-muted-foreground mt-1">Die Abzüge übersteigen {isSale ? 'den Restbetrag' : 'die Kaution inkl. Zinsen'}. {ownerRole} hat ggf. Nachforderungsansprüche.</p>
            </div>
          </motion.div>
        )}

        {/* ── Zahlungsanweisung / IBAN (nicht bei Bürgschaft) ── */}
        {!isSale && !isGuarantee && payout > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Zahlungsanweisung (§ 7c)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Bankdaten des Empfängers (i.d.R. Mieter beim Auszug) für das Protokoll erfassen.
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
              <div className="bg-secondary/40 rounded-xl p-3 text-xs text-foreground/80 leading-relaxed">
                Der Betrag in Höhe von <strong>{payout.toFixed(2)} €</strong> ist bis zum{' '}
                <strong>{paymentDeadline}</strong> auf das folgende Konto zu überweisen:{' '}
                <strong>{data.payeeAccountHolder}</strong>, IBAN: <strong>{data.payeeIban}</strong>.
              </div>
            )}
          </motion.div>
        )}

        {/* ── Rechtliche Begründung (nicht bei Bürgschaft) ── */}
        {!isGuarantee && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-success" />
              <h3 className="font-semibold text-sm">Rechtssichere Begründung</h3>
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 text-sm leading-relaxed">
              <p>
                Einbehalt von <strong>{withheld.toFixed(2)} €</strong> empfohlen gemäß BGH-Rechtsprechung 
                zur Absicherung künftiger Betriebskostennachzahlungen (BGH VIII ZR 71/05) sowie 
                zur Deckung dokumentierter Mängel nach dem Grundsatz „Neu für Alt" 
                (§ 538 BGB, BGH VIII ZR 222/15).
              </p>
              {!isSale && isCash && interest > 0 && (
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
                Die Berechnung berücksichtigt {data.findings.filter(f => f.entryType !== 'note').length} dokumentierte Mängel 
                und eine Nebenkostenprognose mit Risikostufe „{data.nkRisiko}".
              </p>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Button onClick={() => setCurrentStep(12)} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
            <CheckCircle2 className="w-4 h-4" />
            Weiter zum Master-Protokoll
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
