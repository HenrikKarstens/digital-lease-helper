import { motion } from 'framer-motion';
import { Camera, CheckCircle2, Plus, Gauge, Zap, Droplets, Flame, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover, MeterReading } from '@/context/HandoverContext';
import { useState, useEffect } from 'react';

const MEDIUM_ICONS: Record<string, React.ElementType> = {
  Strom: Zap,
  Wasser: Droplets,
  Gas: Flame,
};

const AI_METER_RESULTS: MeterReading[] = [
  { id: '1', medium: 'Strom', meterNumber: '882341', reading: '14.502,4', unit: 'kWh', maloId: 'DE00056789012345678901234567890' },
  { id: '2', medium: 'Wasser', meterNumber: '445190', reading: '234,7', unit: 'm³', maloId: '' },
  { id: '3', medium: 'Gas', meterNumber: '991204', reading: '8.341,2', unit: 'kWh', maloId: 'DE00098765432109876543210987654' },
];

export const Step8MeterScan = () => {
  const { data, updateData, setCurrentStep } = useHandover();
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const scanMessages = ['KI analysiert Zähler...', 'Erkenne Zählerstand...', 'Prüfe MaLo-ID...'];

  useEffect(() => {
    if (!scanning) return;
    if (scanStep >= scanMessages.length) {
      // Add next meter result
      const nextIndex = data.meterReadings.length % AI_METER_RESULTS.length;
      const result = { ...AI_METER_RESULTS[nextIndex], id: Date.now().toString() };
      updateData({ meterReadings: [...data.meterReadings, result] });
      setScanning(false);
      setScanStep(0);
      return;
    }
    const timer = setTimeout(() => setScanStep(s => s + 1), 800);
    return () => clearTimeout(timer);
  }, [scanning, scanStep]);

  const startScan = () => {
    setScanStep(0);
    setScanning(true);
  };

  const updateMeter = (id: string, field: keyof MeterReading, value: string) => {
    updateData({
      meterReadings: data.meterReadings.map(m => m.id === id ? { ...m, [field]: value } : m),
    });
  };

  const removeMeter = (id: string) => {
    updateData({ meterReadings: data.meterReadings.filter(m => m.id !== id) });
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        Zählererfassung
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Fotografieren Sie die Zähler – die KI erkennt die Werte automatisch
      </motion.p>

      {/* Scan animation */}
      {scanning && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-3xl p-8 w-full max-w-md text-center mb-6">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-14 h-14 rounded-full border-4 border-success/20 border-t-success mx-auto mb-4" />
          <h3 className="font-semibold mb-4">KI-Zähleranalyse</h3>
          <div className="space-y-3 text-left">
            {scanMessages.map((msg, i) => (
              <motion.div key={msg} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i <= scanStep ? 1 : 0.3, x: 0 }} className="flex items-center gap-3 text-sm">
                {i < scanStep ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> : i === scanStep ? <div className="w-4 h-4 rounded-full border-2 border-success/30 border-t-success animate-spin shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />}
                <span>{msg}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Scan button */}
      {!scanning && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-md mb-6">
          <Button onClick={startScan} className="w-full h-14 rounded-2xl text-base font-semibold gap-2" size="lg">
            <Camera className="w-5 h-5" />
            Zähler scannen
          </Button>
        </motion.div>
      )}

      {/* Meter list */}
      {data.meterReadings.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md space-y-3">
          <h3 className="text-sm font-semibold">Erfasste Zähler ({data.meterReadings.length})</h3>
          {data.meterReadings.map((meter) => {
            const Icon = MEDIUM_ICONS[meter.medium] || Gauge;
            const isEditing = editingId === meter.id;
            return (
              <motion.div key={meter.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-semibold">{meter.medium}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(isEditing ? null : meter.id)} className="gap-1 text-xs">
                    <Edit3 className="w-3 h-3" />
                    {isEditing ? 'Fertig' : 'Korrigieren'}
                  </Button>
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Input value={meter.meterNumber} onChange={e => updateMeter(meter.id, 'meterNumber', e.target.value)} placeholder="Zählernummer" className="rounded-xl text-sm" />
                    <Input value={meter.reading} onChange={e => updateMeter(meter.id, 'reading', e.target.value)} placeholder="Zählerstand" className="rounded-xl text-sm" />
                    <Input value={meter.maloId} onChange={e => updateMeter(meter.id, 'maloId', e.target.value)} placeholder="MaLo-ID" className="rounded-xl text-sm" />
                    <Button variant="destructive" size="sm" onClick={() => removeMeter(meter.id)} className="w-full rounded-xl text-xs mt-1">Entfernen</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground text-xs">Zählernr.</span><p className="font-mono font-medium">{meter.meterNumber}</p></div>
                    <div><span className="text-muted-foreground text-xs">Stand</span><p className="font-mono font-medium">{meter.reading} {meter.unit}</p></div>
                    {meter.maloId && <div className="col-span-2"><span className="text-muted-foreground text-xs">MaLo-ID</span><p className="font-mono text-xs truncate">{meter.maloId}</p></div>}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Navigation */}
      {data.meterReadings.length > 0 && !scanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md mt-6">
          <Button onClick={() => setCurrentStep(9)} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
            Weiter zur Unterschrift
          </Button>
        </motion.div>
      )}
    </div>
  );
};
