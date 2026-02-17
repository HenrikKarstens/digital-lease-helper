import { motion } from 'framer-motion';
import { Scale, Euro, AlertTriangle, CheckCircle2, Shield, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';

export const Step12Deposit = () => {
  const { data, setCurrentStep } = useHandover();
  const { depositLabel, ownerRole, isSale } = useTransactionLabels();

  const deposit = parseFloat(data.depositAmount) || 0;
  const defectsCost = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const nkBuffer = (data.nkPrognose - data.nkVorauszahlung) * 3;
  const totalDeductions = defectsCost + nkBuffer;
  const payout = Math.max(0, deposit - totalDeductions);
  const withheld = Math.min(deposit, totalDeductions);

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        {isSale ? 'Kaufpreis-Verrechnung' : 'Kautions-Schiedsrichter'}
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Rechtssichere Berechnung auf BGH-Basis
      </motion.p>

      <div className="w-full max-w-md space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Kalkulation</h3>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border/30">
            <span className="text-sm">{depositLabel}</span>
            <span className="font-semibold">{deposit.toFixed(2)} €</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border/30 text-destructive">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3 h-3" />
              <span className="text-sm">Mängelkosten ({data.findings.length} Posten)</span>
            </div>
            <span className="font-semibold">- {defectsCost.toFixed(2)} €</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border/30 text-destructive">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3 h-3" />
              <span className="text-sm">NK-Puffer (3 Mon.)</span>
            </div>
            <span className="font-semibold">- {nkBuffer.toFixed(2)} €</span>
          </div>

          <div className="flex justify-between items-center py-3 bg-primary/5 rounded-xl px-3 -mx-1">
            <div className="flex items-center gap-2">
              <Euro className="w-5 h-5 text-primary" />
              <span className="font-bold text-lg">Auszahlung</span>
            </div>
            <span className="font-bold text-2xl text-primary">{payout.toFixed(2)} €</span>
          </div>
        </motion.div>

        {payout === 0 && deposit > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Vollständiger Einbehalt</p>
              <p className="text-xs text-muted-foreground mt-1">Die Abzüge übersteigen {isSale ? 'den Restbetrag' : 'die Kaution'}. {ownerRole} hat ggf. Nachforderungsansprüche.</p>
            </div>
          </motion.div>
        )}

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
            <p className="mt-2 text-muted-foreground text-xs">
              Die Berechnung berücksichtigt {data.findings.length} dokumentierte Mängel 
              und eine Nebenkostenprognose mit Risikostufe „{data.nkRisiko}".
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Button onClick={() => setCurrentStep(14)} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
            <CheckCircle2 className="w-4 h-4" />
            Weiter zur Finalisierung
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
