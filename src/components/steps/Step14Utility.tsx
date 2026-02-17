import { motion } from 'framer-motion';
import { Zap, Leaf, TrendingDown, Euro, ArrowRight, FileText, CheckCircle2, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export const Step14Utility = () => {
  const { data, resetData } = useHandover();
  const { cancellationTarget } = useTransactionLabels();
  const [switched, setSwitched] = useState(false);
  const [cancellation, setCancellation] = useState(false);
  const { toast } = useToast();

  // Calculate savings from meter data
  const stromMeter = data.meterReadings.find(m => m.medium === 'Strom');
  const annualKwh = stromMeter ? parseFloat(stromMeter.reading.replace('.', '').replace(',', '.')) * 0.3 : 3500;
  const savingsPerYear = 120; // simulated

  const handleSwitch = () => {
    setSwitched(true);
    toast({
      title: '⚡ Wechselantrag eingereicht!',
      description: 'Sie werden in Kürze eine Bestätigung per E-Mail erhalten.',
    });
  };

  const handleCancellation = () => {
    setCancellation(true);
    toast({
      title: '📄 Kündigung vorbereitet!',
      description: 'Die Kündigung wurde als PDF-Entwurf erstellt und kann versendet werden.',
    });
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        Utility-Switch
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Versorger wechseln & sparen – basierend auf Ihren Zählerdaten
      </motion.p>

      <div className="w-full max-w-md space-y-4">
        {/* Savings card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-5 border-2 border-success/30 bg-gradient-to-br from-success/5 to-transparent"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold">Ökostrom-Tarif</h3>
              <p className="text-xs text-muted-foreground">GrünStrom24 – 100% erneuerbar</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-background/60 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Aktueller Verbrauch</p>
              <p className="text-lg font-bold">{stromMeter?.reading || '14.502,4'} kWh</p>
            </div>
            <div className="bg-success/10 rounded-xl p-3">
              <div className="flex items-center gap-1">
                <TrendingDown className="w-4 h-4 text-success" />
                <p className="text-xs text-muted-foreground">Ihre Ersparnis</p>
              </div>
              <div className="flex items-center gap-1">
                <Euro className="w-4 h-4 text-success" />
                <p className="text-lg font-bold text-success">{savingsPerYear}</p>
                <span className="text-xs text-muted-foreground">/Jahr</span>
              </div>
            </div>
          </div>

          {!switched ? (
            <Button onClick={handleSwitch} className="w-full h-12 rounded-2xl font-semibold gap-2 bg-success hover:bg-success/90 text-success-foreground" size="lg">
              <Zap className="w-5 h-5" />
              Jetzt zum Ökostrom-Tarif wechseln & {savingsPerYear} € sparen
            </Button>
          ) : (
            <div className="flex items-center gap-2 justify-center p-3 bg-success/10 rounded-xl text-success text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Wechselantrag eingereicht
            </div>
          )}
        </motion.div>

        {/* Cancellation for old tenant */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Kündigung für {cancellationTarget}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Automatisch generierte Kündigung des bestehenden Stromvertrags zum Auszugsdatum.
          </p>
          {!cancellation ? (
            <Button variant="outline" onClick={handleCancellation} className="w-full rounded-xl gap-2">
              <FileText className="w-4 h-4" />
              Kündigung für {cancellationTarget} vorbereiten
            </Button>
          ) : (
            <div className="flex items-center gap-2 justify-center p-3 bg-secondary/40 rounded-xl text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-success" />
              Kündigung vorbereitet
            </div>
          )}
        </motion.div>

        {/* Completion */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-card rounded-2xl p-6 text-center border-2 border-primary/20"
        >
          <PartyPopper className="w-10 h-10 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-1">Übergabe abgeschlossen!</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Alle 14 Schritte wurden erfolgreich durchlaufen. Ihr EstateTurn-Zertifikat ist rechtssicher erstellt.
          </p>
          <Button variant="outline" onClick={resetData} className="rounded-xl gap-2">
            Neue Übergabe starten
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
