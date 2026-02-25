import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Euro, AlertTriangle, CheckCircle2, ArrowDown, ArrowRight,
  Info, Scale, Pencil, Sparkles, ChevronDown, ChevronUp, Gavel,
  Handshake, Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';

// AI cost estimates per damage type (€)
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

export const StepDepositCheck = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole } = useTransactionLabels();

  const tenantDefects = data.findings.filter(f => f.entryType !== 'note');
  const deposit = parseFloat(data.depositAmount) || 0;

  // Missing keys deduction
  const missingKeys = data.keyEntries.filter(k => k.count <= 0);

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
  const keyDeduction = missingKeys.length * 50; // 50€ per missing key set
  const nkBuffer = data.nkVorauszahlung > 0 || data.nkPrognose > 0
    ? Math.max(0, (data.nkPrognose - data.nkVorauszahlung) * 3)
    : 180;
  const totalDeductions = totalCosts + nkBuffer + keyDeduction;
  const payout = Math.max(0, deposit - totalDeductions);
  const deficit = Math.max(0, totalDeductions - deposit);

  const tenantName = data.tenantName || clientRole;
  const landlordName = data.landlordName || ownerRole;

  const handleUpdateCost = (id: string, value: number) => {
    setCostOverrides(prev => ({ ...prev, [id]: value }));
  };

  const handleAgreement = () => {
    const now = new Date().toISOString();
    setAgreementReached(true);
    const updatedFindings = data.findings.map(f => {
      if (costOverrides[f.id] !== undefined) {
        return { ...f, recommendedWithholding: costOverrides[f.id] };
      }
      return f;
    });
    updateData({
      findings: updatedFindings,
      depositAgreementReached: true,
      depositAgreementTimestamp: now,
    });
  };

  const handleContinue = () => {
    const updatedFindings = data.findings.map(f => {
      if (costOverrides[f.id] !== undefined) {
        return { ...f, recommendedWithholding: costOverrides[f.id] };
      }
      return f;
    });
    updateData({ findings: updatedFindings });
    goToStepById('keys');
  };

  const payoutPercent = deposit > 0 ? Math.min(100, (payout / deposit) * 100) : 0;
  const deductPercent = deposit > 0 ? Math.min(100, (totalDeductions / deposit) * 100) : 0;

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-3">
          <Gavel className="w-3.5 h-3.5" />
          Kautions-Schiedsrichter
        </div>
        <h2 className="text-2xl font-bold">Finanzielle Abwicklung</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Live-Saldierung der Mietsicherheit für {tenantName}
        </p>
      </motion.div>

      <div className="w-full max-w-md space-y-4">

        {/* ── Progress Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-5"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">Kaution (§ 6 Mietvertrag)</span>
            <span className="text-sm font-bold">{deposit.toFixed(2)} €</span>
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-sm">Forderungen ({tenantDefects.length + missingKeys.length})</h3>
          </div>

          {tenantDefects.length === 0 && missingKeys.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-2" />
              <p className="text-sm font-medium">Keine Forderungen</p>
              <p className="text-xs text-muted-foreground mt-1">
                Die Kaution wird vollständig ausgezahlt.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tenantDefects.map((defect, i) => {
                const cost = costOverrides[defect.id] || 0;
                const isExpanded = expandedId === defect.id;
                const aiSuggestion = getAiEstimate(defect.damageType);
                const reasoning = getLegalReasoning(defect.damageType);

                return (
                  <motion.div
                    key={defect.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="border border-border/40 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : defect.id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-secondary rounded-md px-1.5 py-0.5 font-medium shrink-0">
                            {defect.room}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {defect.damageType || defect.description?.slice(0, 30)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-destructive">
                          {cost.toFixed(2)} €
                        </span>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border/30"
                        >
                          <div className="p-3 space-y-3 bg-secondary/10">
                            {/* Schiedsrichter-Spruch */}
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Gavel className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-semibold text-primary">Schiedsrichter-Spruch</span>
                              </div>
                              <p className="text-xs leading-relaxed text-foreground/80">{reasoning}</p>
                            </div>

                            {defect.description && (
                              <p className="text-xs text-muted-foreground">{defect.description}</p>
                            )}

                            <div className="flex items-center gap-2">
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <label className="text-xs text-muted-foreground shrink-0">Abzug (€):</label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={cost}
                                onChange={e => handleUpdateCost(defect.id, parseFloat(e.target.value) || 0)}
                                className="h-8 rounded-lg bg-background border-border/50 text-sm w-28"
                              />
                            </div>
                            <button
                              onClick={() => handleUpdateCost(defect.id, aiSuggestion)}
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
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

              {/* Missing keys */}
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

        {/* ── Live-Saldierung ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Euro className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Live-Saldierung</h3>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <span className="text-sm">Mietsicherheit (§ 6 Mietvertrag)</span>
            <span className="font-semibold">+ {deposit.toFixed(2)} €</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border/30 text-destructive">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3 h-3" />
              <span className="text-sm">Reparaturkosten ({tenantDefects.length} Posten)</span>
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
              <span className="text-sm">NK-Einbehalt (BK-Abrechnung)</span>
            </div>
            <span className="font-semibold">- {nkBuffer.toFixed(2)} €</span>
          </div>

          <div className={`flex justify-between items-center py-3 rounded-xl px-3 -mx-1 ${
            deficit > 0 ? 'bg-destructive/10' : 'bg-accent/10'
          }`}>
            <div className="flex items-center gap-2">
              <Euro className={`w-5 h-5 ${deficit > 0 ? 'text-destructive' : 'text-accent'}`} />
              <span className="font-bold text-base">
                {deficit > 0 ? 'Offene Restforderung' : `Auszahlung an ${tenantName}`}
              </span>
            </div>
            <span className={`font-bold text-xl ${deficit > 0 ? 'text-destructive' : 'text-accent'}`}>
              {deficit > 0 ? deficit.toFixed(2) : payout.toFixed(2)} €
            </span>
          </div>
        </motion.div>

        {/* ── Einigung ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className={`glass-card rounded-2xl p-5 border-2 ${
            agreementReached ? 'border-accent/50 bg-accent/5' : 'border-border/30'
          }`}
        >
          {agreementReached ? (
            <div className="text-center space-y-2">
              <Handshake className="w-8 h-8 text-accent mx-auto" />
              <p className="font-semibold text-accent">Beiderseitiges Anerkenntnis</p>
              <p className="text-xs text-muted-foreground">
                {landlordName} und {tenantName} haben die Kautionsabrechnung als verbindlich anerkannt.
                Dies wird im Protokoll dokumentiert.
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
                beiderseitiges Anerkenntnis im Protokoll vermerkt (§ 781 BGB – Schuldanerkenntnis).
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

        {/* ── Rechtliche Hinweise ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <button
            onClick={() => setShowLegalHint(!showLegalHint)}
            className="w-full flex items-center justify-between glass-card rounded-2xl p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Rechtliche Hinweise (BGH)</span>
            </div>
            {showLegalHint
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
            }
          </button>
          <AnimatePresence>
            {showLegalHint && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-secondary/30 rounded-b-2xl p-4 -mt-2 pt-5 text-xs leading-relaxed text-foreground/80 space-y-2">
                  <p><strong>§ 551 Abs. 4 BGB:</strong> Die Kaution ist nach Beendigung des Mietverhältnisses zurückzugeben, sobald keine Ansprüche mehr geltend gemacht werden.</p>
                  <p><strong>BGH VIII ZR 71/05:</strong> Der {ownerRole} darf einen angemessenen Teilbetrag für noch ausstehende Betriebskostenabrechnungen einbehalten (i.d.R. 3–6 Monatsvorauszahlungen).</p>
                  <p><strong>§ 538 BGB:</strong> Normale Abnutzung ist vom Mieter nicht zu ersetzen. Nur Schäden durch vertragswidrigen Gebrauch begründen Ersatzansprüche.</p>
                  <p><strong>§ 781 BGB:</strong> Ein beiderseitiges Anerkenntnis der Kautionsabrechnung hat Wirkung eines abstrakten Schuldanerkenntnisses.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Deficit Warning ── */}
        {deficit > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Kaution reicht nicht aus</p>
              <p className="text-xs text-muted-foreground mt-1">
                Die Forderungen übersteigen die Kaution um <strong>{deficit.toFixed(2)} €</strong>.
                Eine Zahlungsaufforderung wird dem Protokoll beigefügt (§ 280 Abs. 1 BGB).
              </p>
            </div>
          </motion.div>
        )}

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pt-2"
        >
          <Button
            onClick={handleContinue}
            className="w-full h-12 rounded-2xl font-semibold gap-2"
            size="lg"
          >
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
