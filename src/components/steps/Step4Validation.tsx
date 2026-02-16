import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHandover } from '@/context/HandoverContext';

export const Step4Validation = () => {
  const { data, updateData, setCurrentStep } = useHandover();

  const fields = [
    { key: 'propertyAddress', label: 'Objektadresse', value: data.propertyAddress },
    { key: 'landlordName', label: 'Vermieter', value: data.landlordName },
    { key: 'landlordEmail', label: 'E-Mail Vermieter', value: data.landlordEmail },
    { key: 'tenantName', label: 'Mieter', value: data.tenantName },
    { key: 'tenantEmail', label: 'E-Mail Mieter', value: data.tenantEmail },
    { key: 'depositAmount', label: 'Kaution (€)', value: data.depositAmount },
    { key: 'contractStart', label: 'Vertragsbeginn', value: data.contractStart },
    { key: 'contractEnd', label: 'Vertragsende', value: data.contractEnd },
  ] as const;

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-2 text-center"
      >
        Daten-Validierung
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-muted-foreground text-center mb-6 text-sm"
      >
        Bitte überprüfen und ergänzen Sie die Angaben
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-6 w-full max-w-md space-y-4"
      >
        {fields.map((field, i) => (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
              {field.value && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
            </div>
            <Input
              value={field.value}
              onChange={e => updateData({ [field.key]: e.target.value } as any)}
              className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
              placeholder={field.label}
            />
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-md mt-6"
      >
        <Button
          onClick={() => {
            // Pre-fill participants from data
            updateData({
              participants: [
                { id: '1', name: data.landlordName || 'Vermieter', role: 'Vermieter', email: data.landlordEmail, present: true },
                { id: '2', name: data.tenantName || 'Mieter', role: 'Mieter', email: data.tenantEmail, present: true },
              ]
            });
            setCurrentStep(5);
          }}
          className="w-full h-13 rounded-2xl text-base font-semibold gap-2"
          size="lg"
        >
          Daten bestätigen
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>
    </div>
  );
};
