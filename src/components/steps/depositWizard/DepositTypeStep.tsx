import { motion } from 'framer-motion';
import { Euro, FileText, PiggyBank, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover, DepositType } from '@/context/HandoverContext';
import { ArrowRight } from 'lucide-react';

const DEPOSIT_TYPES: { value: DepositType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'cash', label: 'Bar-Kaution', icon: <Euro className="w-5 h-5" />, desc: 'Vermieter hat angelegt – volle Zinspflicht (§ 551 BGB)' },
  { value: 'guarantee', label: 'Bankbürgschaft / Versicherung', icon: <FileText className="w-5 h-5" />, desc: 'Rückgabe der Urkunde – keine Zinsberechnung' },
  { value: 'pledged-account', label: 'Verpfändetes Mieterkonto', icon: <PiggyBank className="w-5 h-5" />, desc: 'Zinsen bereits bankseitig gutgeschrieben' },
];

interface Props {
  onNext: () => void;
}

export const DepositTypeStep = ({ onNext }: Props) => {
  const { data, updateData } = useHandover();

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Landmark className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Kautionsart auswählen</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Wählen Sie die Art der hinterlegten Mietsicherheit. Dies bestimmt den weiteren Abrechnungsprozess.
        </p>
        <div className="space-y-2">
          {DEPOSIT_TYPES.map(dt => (
            <button
              key={dt.value}
              onClick={() => updateData({ depositType: dt.value })}
              className={`w-full flex items-start gap-3 rounded-xl p-4 text-left transition-all border ${
                data.depositType === dt.value
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border/40 bg-secondary/30 hover:bg-secondary/50'
              }`}
            >
              <div className={`mt-0.5 ${data.depositType === dt.value ? 'text-primary' : 'text-muted-foreground'}`}>
                {dt.icon}
              </div>
              <div>
                <span className="text-sm font-medium block">{dt.label}</span>
                <span className="text-xs text-muted-foreground">{dt.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={onNext} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
        Weiter
        <ArrowRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
};
