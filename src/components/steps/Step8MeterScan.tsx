import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, Plus, Gauge, Zap, Droplets, Flame, Edit3, Thermometer, HelpCircle, Trash2, PenLine, CalendarIcon, X, Home, ShieldCheck, Paintbrush, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useHandover, MeterReading, HkvRoomReading } from '@/context/HandoverContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const METER_TYPES = [
  { value: 'Strom', label: 'Strom', icon: Zap, unit: 'kWh' },
  { value: 'Wasser', label: 'Wasser', icon: Droplets, unit: 'm³' },
  { value: 'Gas', label: 'Gas', icon: Flame, unit: 'm³' },
  { value: 'Wärmemengenzähler', label: 'Wärmemengenzähler', icon: Thermometer, unit: 'kWh' },
  { value: 'Sonstiges', label: 'Sonstiges', icon: HelpCircle, unit: '' },
  { value: 'Heizkostenverteiler', label: 'Heizkostenverteiler (HKV)', icon: Thermometer, unit: 'Einheiten' },
];

const MEDIUM_ICONS: Record<string, React.ElementType> = {
  Strom: Zap,
  Wasser: Droplets,
  Gas: Flame,
  Wärmemengenzähler: Thermometer,
  Sonstiges: HelpCircle,
};

// Removed hardcoded AI_METER_RESULTS – now using real AI analysis

const TODAY = format(new Date(), 'dd.MM.yyyy');

interface ManualForm {
  medium: string;
  meterNumber: string;
  reading: string;
  unit: string;
  maloId: string;
  date: string;
}

const emptyForm = (): ManualForm => ({
  medium: '',
  meterNumber: '',
  reading: '',
  unit: '',
  maloId: '',
  date: TODAY,
});

const HKV_ROOMS = ['Wohnzimmer', 'Schlafzimmer', 'Kinderzimmer', 'Küche', 'Flur', 'Bad', 'Gäste-WC', 'Arbeitszimmer', 'Esszimmer', 'Sonstiges'];

const HkvRoomSection = ({ meter, onUpdate }: { meter: MeterReading; onUpdate: (readings: HkvRoomReading[]) => void }) => {
  const readings = meter.hkvRoomReadings || [];
  const [showForm, setShowForm] = useState(false);
  const [room, setRoom] = useState('');
  const [num, setNum] = useState('');
  const [val, setVal] = useState('');

  const addRoom = () => {
    if (!room || !val) return;
    const entry: HkvRoomReading = { id: crypto.randomUUID(), room, meterNumber: num, reading: val };
    onUpdate([...readings, entry]);
    setRoom(''); setNum(''); setVal('');
    setShowForm(false);
  };

  const removeRoom = (id: string) => onUpdate(readings.filter(r => r.id !== id));

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Home className="w-3.5 h-3.5" />
          Raumweise HKV-Ablesewerte
        </p>
        <button onClick={() => setShowForm(!showForm)} className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
          <Plus className="w-3 h-3" />
          Raum
        </button>
      </div>

      {readings.map(r => (
        <div key={r.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-1.5 mb-1.5 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold">{r.room}</span>
            {r.meterNumber && <span className="text-muted-foreground">Nr. {r.meterNumber}</span>}
            <span className="font-mono font-medium">{r.reading} Einheiten</span>
          </div>
          <button onClick={() => removeRoom(r.id)} className="text-destructive hover:text-destructive/80">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden mt-2">
            <Select value={room} onValueChange={setRoom}>
              <SelectTrigger className="rounded-lg h-9 bg-secondary/50 border-0 text-xs">
                <SelectValue placeholder="Raum wählen..." />
              </SelectTrigger>
              <SelectContent className="z-50 bg-card border border-border rounded-xl shadow-lg">
                {HKV_ROOMS.map(r => <SelectItem key={r} value={r} className="cursor-pointer text-xs">{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="HKV-Nr." value={num} onChange={e => setNum(e.target.value)} className="rounded-lg h-9 text-xs bg-secondary/50 border-0" />
              <Input placeholder="Ablesewert" type="number" inputMode="decimal" value={val} onChange={e => setVal(e.target.value)} className="rounded-lg h-9 text-xs bg-secondary/50 border-0" />
            </div>
            <Button onClick={addRoom} disabled={!room || !val} size="sm" className="w-full h-8 rounded-lg text-xs gap-1">
              <Plus className="w-3 h-3" />
              Raum hinzufügen
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Step8MeterScan = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('KI analysiert Zähler...');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>(emptyForm());
  const [editForm, setEditForm] = useState<ManualForm | null>(null);

  const meterCameraRef = useRef<HTMLInputElement>(null);

  const handleMeterPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setScanning(true);
    setScanMessage('KI analysiert Zähler...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'meter');

      setScanMessage('Erkenne Zählerstand...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-photo`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Keine Analysedaten erhalten');
      }

      const aiData = result.data;
      const newMeter: MeterReading = {
        id: Date.now().toString(),
        medium: aiData.medium || 'Sonstiges',
        meterNumber: aiData.meterNumber || '',
        reading: aiData.reading || '',
        unit: aiData.unit || '',
        maloId: aiData.maloId || '',
        source: 'ai',
        aiConfidence: aiData.confidence || 'medium',
      };
      updateData({ meterReadings: [...data.meterReadings, newMeter] });
      toast({
        title: 'Zähler erkannt',
        description: `${newMeter.medium} – Stand: ${newMeter.reading} ${newMeter.unit}`,
      });
    } catch (err: any) {
      console.error('Meter AI analysis failed:', err);
      toast({
        title: 'KI-Analyse fehlgeschlagen',
        description: err.message || 'Bitte erfassen Sie den Zähler manuell.',
        variant: 'destructive',
      });
      // Open manual form as fallback
      setShowManualForm(true);
      setManualForm(emptyForm());
    } finally {
      setScanning(false);
    }
  }, [data.meterReadings, updateData, toast]);

  const triggerMeterCamera = () => {
    meterCameraRef.current?.click();
  };

  const updateMeter = (id: string, field: keyof MeterReading, value: string) => {
    updateData({ meterReadings: data.meterReadings.map(m => m.id === id ? { ...m, [field]: value } : m) });
  };

  const removeMeter = (id: string) => {
    updateData({ meterReadings: data.meterReadings.filter(m => m.id !== id) });
    if (editingId === id) setEditingId(null);
  };

  const handleTypeChange = (value: string) => {
    const found = METER_TYPES.find(t => t.value === value);
    setManualForm(prev => ({ ...prev, medium: value, unit: found?.unit || '' }));
  };

  const handleAddManual = () => {
    if (!manualForm.medium || !manualForm.reading) return;
    const newMeter: MeterReading = {
      id: Date.now().toString(),
      medium: manualForm.medium,
      meterNumber: manualForm.meterNumber,
      reading: manualForm.reading,
      unit: manualForm.unit,
      maloId: manualForm.maloId,
      source: 'manual',
    };
    updateData({ meterReadings: [...data.meterReadings, newMeter] });
    setManualForm(emptyForm());
    setShowManualForm(false);
  };

  const startEdit = (meter: MeterReading) => {
    setEditingId(meter.id);
    setEditForm({
      medium: meter.medium,
      meterNumber: meter.meterNumber,
      reading: meter.reading,
      unit: meter.unit,
      maloId: meter.maloId,
      date: TODAY,
    });
  };

  const saveEdit = (id: string) => {
    if (!editForm) return;
    updateData({
      meterReadings: data.meterReadings.map(m =>
        m.id === id ? { ...m, medium: editForm.medium, meterNumber: editForm.meterNumber, reading: editForm.reading, unit: editForm.unit, maloId: editForm.maloId } : m
      ),
    });
    setEditingId(null);
    setEditForm(null);
  };

  const editTypeChange = (value: string) => {
    const found = METER_TYPES.find(t => t.value === value);
    setEditForm(prev => prev ? { ...prev, medium: value, unit: found?.unit || prev.unit } : prev);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* Hidden camera input */}
      <input
        ref={meterCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleMeterPhoto}
      />

      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        Zählererfassung
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Scannen oder manuell erfassen – alle Werte haben gleiche Protokoll-Priorität
      </motion.p>

      {/* Scan animation */}
      {scanning && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-3xl p-8 w-full max-w-md text-center mb-6">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Fotoerfassung mit KI</h3>
          <p className="text-sm text-muted-foreground">{scanMessage}</p>
        </motion.div>
      )}

      {/* Action buttons – only show when meters already exist */}
      {!scanning && data.meterReadings.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-md mb-6 grid grid-cols-2 gap-3">
          <Button onClick={triggerMeterCamera} className="h-14 rounded-2xl font-semibold gap-2" size="lg">
            <Camera className="w-5 h-5" />
            Fotoerfassung (KI)
          </Button>
          <Button
            variant="outline"
            onClick={() => { setShowManualForm(true); setManualForm(emptyForm()); }}
            className="h-14 rounded-2xl font-semibold gap-2"
            size="lg"
          >
            <PenLine className="w-5 h-5" />
            Manuell
          </Button>
        </motion.div>
      )}

      {/* Manual entry form */}
      <AnimatePresence>
        {showManualForm && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="w-full max-w-md glass-card rounded-2xl p-5 mb-6 space-y-4"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Neuer Zähler
              </h3>
              <button onClick={() => setShowManualForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Zählertyp *</Label>
              <Select value={manualForm.medium} onValueChange={handleTypeChange}>
                <SelectTrigger className="rounded-xl h-11 bg-secondary/50 border-0 focus:ring-1">
                  <SelectValue placeholder="Typ auswählen..." />
                </SelectTrigger>
                <SelectContent className="z-50 bg-card border border-border rounded-xl shadow-lg">
                  {METER_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <t.icon className="w-4 h-4 text-muted-foreground" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Zählernummer</Label>
              <Input
                placeholder="z. B. 882341"
                value={manualForm.meterNumber}
                onChange={e => setManualForm(p => ({ ...p, meterNumber: e.target.value }))}
                className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Zählerstand *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  inputMode="decimal"
                  value={manualForm.reading}
                  onChange={e => setManualForm(p => ({ ...p, reading: e.target.value }))}
                  className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Einheit</Label>
                <Input
                  placeholder="kWh / m³"
                  value={manualForm.unit}
                  onChange={e => setManualForm(p => ({ ...p, unit: e.target.value }))}
                  className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                Ablesedatum
              </Label>
              <Input
                placeholder={TODAY}
                value={manualForm.date}
                onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))}
                className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">MaLo-ID (optional)</Label>
              <Input
                placeholder="DE00..."
                value={manualForm.maloId}
                onChange={e => setManualForm(p => ({ ...p, maloId: e.target.value }))}
                className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
              />
            </div>

            <Button
              onClick={handleAddManual}
              disabled={!manualForm.medium || !manualForm.reading}
              className="w-full h-11 rounded-2xl font-semibold gap-2"
            >
              <Plus className="w-4 h-4" />
              Zähler hinzufügen
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meter list */}
      {data.meterReadings.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Erfasste Zähler ({data.meterReadings.length})</h3>
            <button
              onClick={() => { setShowManualForm(true); setManualForm(emptyForm()); }}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Zähler hinzufügen
            </button>
          </div>

          {data.meterReadings.map((meter) => {
            const Icon = MEDIUM_ICONS[meter.medium] || Gauge;
            const isEditing = editingId === meter.id;

            return (
              <motion.div key={meter.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-2xl p-4 ${meter.source === 'ai' ? 'ring-1 ring-primary/30 bg-primary/[0.03]' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-semibold">{meter.medium}</span>
                    {meter.source === 'ai' && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        meter.aiConfidence === 'high' ? 'bg-primary/15 text-primary' :
                        meter.aiConfidence === 'low' ? 'bg-amber-500/15 text-amber-600' :
                        'bg-primary/10 text-primary/80'
                      }`}>
                        KI-Vorschlag
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => isEditing ? saveEdit(meter.id) : startEdit(meter)} className="gap-1 text-xs h-7 px-2">
                      <Edit3 className="w-3 h-3" />
                      {isEditing ? 'Speichern' : 'Korrigieren'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeMeter(meter.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {isEditing && editForm ? (
                  <div className="space-y-2">
                    {/* Type selector in edit mode */}
                    <Select value={editForm.medium} onValueChange={editTypeChange}>
                      <SelectTrigger className="rounded-xl h-10 bg-secondary/50 border-0 text-sm focus:ring-1">
                        <SelectValue placeholder="Zählertyp..." />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-card border border-border rounded-xl shadow-lg">
                        {METER_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value} className="cursor-pointer">
                            <div className="flex items-center gap-2">
                              <t.icon className="w-4 h-4 text-muted-foreground" />
                              {t.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input value={editForm.meterNumber} onChange={e => setEditForm(p => p ? { ...p, meterNumber: e.target.value } : p)} placeholder="Zählernummer" className="rounded-xl text-sm h-10 bg-secondary/50 border-0" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={editForm.reading} onChange={e => setEditForm(p => p ? { ...p, reading: e.target.value } : p)} placeholder="Zählerstand" inputMode="decimal" className="rounded-xl text-sm h-10 bg-secondary/50 border-0" />
                      <Input value={editForm.unit} onChange={e => setEditForm(p => p ? { ...p, unit: e.target.value } : p)} placeholder="Einheit" className="rounded-xl text-sm h-10 bg-secondary/50 border-0" />
                    </div>
                    <Input value={editForm.maloId} onChange={e => setEditForm(p => p ? { ...p, maloId: e.target.value } : p)} placeholder="MaLo-ID" className="rounded-xl text-sm h-10 bg-secondary/50 border-0" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Zählernr.</span>
                      <p className="font-mono font-medium">{meter.meterNumber || '–'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Stand</span>
                      <p className="font-mono font-medium">{meter.reading} {meter.unit}</p>
                    </div>
                    {meter.maloId && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-xs">MaLo-ID</span>
                        <p className="font-mono text-xs truncate">{meter.maloId}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* HKV Room Readings – expandable section for Heizkostenverteiler */}
                {(meter.medium === 'Heizkostenverteiler' || meter.medium === 'Wärmemengenzähler') && !isEditing && (
                  <HkvRoomSection meter={meter} onUpdate={(readings) => {
                    updateData({
                      meterReadings: data.meterReadings.map(m =>
                        m.id === meter.id ? { ...m, hkvRoomReadings: readings } : m
                      ),
                    });
                  }} />
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Empty state: two equal options side by side */}
      {data.meterReadings.length === 0 && !scanning && !showManualForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="w-full max-w-md grid grid-cols-2 gap-3">
          {/* Left: AI photo capture */}
          <button
            onClick={triggerMeterCamera}
            className="glass-card rounded-2xl p-6 border-2 border-primary/30 flex flex-col items-center gap-3 text-foreground hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs font-semibold text-center leading-tight">Fotoerfassung<br />(mit KI)</span>
          </button>

          {/* Right: manual entry */}
          <button
            onClick={() => { setShowManualForm(true); setManualForm(emptyForm()); }}
            className="glass-card rounded-2xl p-6 border-2 border-dashed border-border/60 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-center leading-tight">Zähler manuell<br />hinzufügen</span>
          </button>
        </motion.div>
      )}

      {/* Zustand & Sicherheit */}
      {data.meterReadings.length > 0 && !scanning && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="w-full max-w-md glass-card rounded-2xl p-5 mt-6 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Zustand & Sicherheit
          </h3>

          {/* Reinigungszustand */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Trash className="w-3.5 h-3.5" />
              Reinigungszustand
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={data.cleaningBesenrein}
                onCheckedChange={(v) => updateData({ cleaningBesenrein: !!v })}
              />
              <span className="text-sm">Wohnung besenrein übergeben?</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={data.cleaningBriefkasten}
                onCheckedChange={(v) => updateData({ cleaningBriefkasten: !!v })}
              />
              <span className="text-sm">Briefkasten geleert?</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={data.cleaningKeller}
                onCheckedChange={(v) => updateData({ cleaningKeller: !!v })}
              />
              <span className="text-sm">Keller geräumt?</span>
            </label>
          </div>

          {/* Rauchwarnmelder */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Rauchwarnmelder (LBO SH)
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={data.smokeDetectorChecked}
                onCheckedChange={(v) => updateData({ smokeDetectorChecked: !!v })}
              />
              <span className="text-sm">Rauchwarnmelder in allen Schlafräumen und Fluren vorhanden und funktionsgeprüft?</span>
            </label>
            {!data.smokeDetectorChecked && (
              <p className="text-xs text-destructive ml-7">⚠ Pflichtprüfung gemäß § 49 Abs. 4 LBO Schleswig-Holstein</p>
            )}
          </div>

          {/* Schönheitsreparaturen */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5" />
              Schönheitsreparaturen
            </p>
            <div className="flex gap-2">
              <Button
                variant={data.wallsNeutralColors === true ? 'default' : 'outline'}
                size="sm"
                className="rounded-xl text-xs h-9"
                onClick={() => updateData({ wallsNeutralColors: true })}
              >
                ✓ Wände in neutralen Farben
              </Button>
              <Button
                variant={data.wallsNeutralColors === false ? 'destructive' : 'outline'}
                size="sm"
                className="rounded-xl text-xs h-9"
                onClick={() => updateData({ wallsNeutralColors: false })}
              >
                ✗ Auffällige Farben / Mängel
              </Button>
            </div>
            {data.wallsNeutralColors === false && (
              <p className="text-xs text-destructive">Hinweis: Nicht-neutrale Wandfarben können Schadensersatzansprüche begründen (BGH VIII ZR 224/07).</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Navigation */}
      {data.meterReadings.length > 0 && !scanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md mt-6">
          <Button onClick={() => goToStepById(data.handoverDirection === 'move-out' ? 'forwarding-address' : 'data-complete')} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
            <CheckCircle2 className="w-4 h-4" />
            Datenerfassung abschließen
          </Button>
        </motion.div>
      )}
    </div>
  );
};
