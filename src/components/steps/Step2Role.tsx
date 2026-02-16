import { motion } from 'framer-motion';
import { Building2, Home } from 'lucide-react';
import { useHandover } from '@/context/HandoverContext';

export const Step2Role = () => {
  const { updateData, setCurrentStep } = useHandover();

  const selectRole = (role: 'landlord' | 'tenant') => {
    updateData({ role });
    setCurrentStep(3);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-2 text-center"
      >
        Ihre Rolle
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-muted-foreground text-center mb-8"
      >
        Wählen Sie Ihre Perspektive für die Übergabe
      </motion.p>

      <div className="grid gap-4 w-full max-w-md">
        {([
          { role: 'landlord' as const, icon: Building2, title: 'Vermieter / Verkäufer', desc: 'Sie übergeben das Objekt' },
          { role: 'tenant' as const, icon: Home, title: 'Mieter / Käufer', desc: 'Sie übernehmen das Objekt' },
        ]).map((item, i) => (
          <motion.button
            key={item.role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => selectRole(item.role)}
            className="glass-card rounded-2xl p-6 flex items-center gap-5 text-left w-full transition-colors hover:border-primary/30"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <item.icon className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
