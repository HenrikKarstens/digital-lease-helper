import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, MapPin, Key, Gauge, Users, Camera, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';

export const Step10DataComplete = () => {
  const { data, goToStepById } = useHandover();

  const address = data.propertyAddress || 'Ihr Objekt';
  const addressShort = address.split(',')[0].trim();

  const stats = [
    { icon: Key, label: 'Schlüssel', value: `${data.keyEntries.reduce((s, k) => s + k.count, 0)} Stück` },
    { icon: Gauge, label: 'Zähler', value: `${data.meterReadings.length} erfasst` },
    { icon: Users, label: 'Teilnehmer', value: `${data.participants.filter(p => p.present).length} anwesend` },
    { icon: Camera, label: 'Befunde', value: `${data.findings.length} dokumentiert` },
  ];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"
      >
        <CheckCircle2 className="w-9 h-9 text-primary" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-2xl font-bold text-center mb-1"
      >
        Daten vollständig erfasst
      </motion.h2>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-1.5 text-muted-foreground text-sm mb-6"
      >
        <MapPin className="w-4 h-4" />
        <span>{addressShort}</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-md glass-card rounded-2xl p-5 mb-6"
      >
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Zusammenfassung
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className="bg-secondary/30 rounded-xl p-3 flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-semibold">{s.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-muted-foreground text-center max-w-sm mb-6"
      >
        Alle Daten für die Übergabe wurden erfolgreich erfasst. Im nächsten Schritt erstellen wir Ihr rechtssicheres Übergabeprotokoll.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="w-full max-w-md"
      >
        <Button
          onClick={() => goToStepById('defect-analysis')}
          className="w-full h-14 rounded-2xl text-base font-semibold gap-2"
          size="lg"
        >
          <ArrowRight className="w-5 h-5" />
          Weiter zum Protokoll
        </Button>
      </motion.div>
    </div>
  );
};
