import { motion } from 'framer-motion';
import { FileText, Search, Zap, ArrowRight, Shield, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';

const features = [
  {
    icon: FileText,
    title: 'Vertrags-KI',
    description: 'Automatische Analyse Ihrer Mietverträge mit KI-gestützter Datenextraktion.',
    delay: 0.2,
  },
  {
    icon: Search,
    title: 'Mängel-Experte',
    description: 'Intelligente Schadenserkennung mit BGH-Rechtsprechung und Zeitwertberechnung.',
    delay: 0.4,
  },
  {
    icon: Zap,
    title: 'Versorger-Wechsel',
    description: 'One-Click Ummeldung von Strom, Gas & Wasser mit Einsparungsberechnung.',
    delay: 0.6,
  },
];

export const Step1Hero = () => {
  const { goToStepById } = useHandover();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-2"
      >
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          <span className="text-primary">Estate</span>
          <span className="text-success">Turn</span>
        </h1>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-muted-foreground text-center text-lg mb-10 max-w-md"
      >
        Die intelligente Wohnungsübergabe – rechtssicher, digital, fair.
      </motion.p>

      {/* Feature Cards */}
      <div className="grid gap-4 w-full max-w-md mb-10">
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: feature.delay, duration: 0.5 }}
            className="glass-card rounded-2xl p-5 flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <feature.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Button
          onClick={() => goToStepById('transaction-type')}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-primary hover:bg-primary/90 gap-2"
          size="lg"
        >
          Übergabe starten
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>

      {/* Trust elements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="flex items-center gap-4 mt-6 text-xs text-muted-foreground"
      >
        <div className="flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-success" />
          <span>Rechtssicher</span>
        </div>
        <div className="flex items-center gap-1">
          <Scale className="w-3.5 h-3.5 text-success" />
          <span>Nach dt. Mietrecht</span>
        </div>
      </motion.div>
    </div>
  );
};
