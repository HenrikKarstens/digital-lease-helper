import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Camera, Upload, FileText, CheckCircle2, Mail, Bell,
  Zap, Flame, Droplets, Thermometer, HelpCircle, Loader2, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MeterReading } from '@/context/HandoverContext';
import { useToast } from '@/hooks/use-toast';

const MEDIUM_ICONS: Record<string, React.ElementType> = {
  Strom: Zap,
  Wasser: Droplets,
  Gas: Flame,
  Wärmemengenzähler: Thermometer,
  Sonstiges: HelpCircle,
};

function getMeterIcon(medium: string) {
  const key = Object.keys(MEDIUM_ICONS).find(k => medium.toLowerCase().includes(k.toLowerCase()));
  return key ? MEDIUM_ICONS[key] : Zap;
}

interface ProviderInfo {
  providerName: string;
  customerNumber: string;
  contractNumber: string;
}

interface ContractCancellationCardProps {
  meter: MeterReading;
  tenantEmail: string;
  tenantName: string;
  onProviderInfoSaved: (meterId: string, info: ProviderInfo) => void;
  onReminderSet: (meterId: string, enabled: boolean) => void;
}

export const ContractCancellationCard = ({
  meter,
  tenantEmail,
  tenantName,
  onProviderInfoSaved,
  onReminderSet,
}: ContractCancellationCardProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'idle' | 'upload'>('idle');
  const [scanning, setScanning] = useState(false);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo>({
    providerName: '',
    customerNumber: '',
    contractNumber: '',
  });
  const [infoSaved, setInfoSaved] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);

  const Icon = getMeterIcon(meter.medium);

  const handleFileOrPhoto = useCallback(async (file: File) => {
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'provider-document');
      formData.append('extractFields', 'providerName,customerNumber,contractNumber');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-photo`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        const extracted: ProviderInfo = {
          providerName: result.providerName || result.provider || '',
          customerNumber: result.customerNumber || result.kundennummer || '',
          contractNumber: result.contractNumber || result.vertragsnummer || '',
        };
        setProviderInfo(extracted);
        toast({
          title: '📄 Versorger-Daten erkannt',
          description: extracted.providerName
            ? `${extracted.providerName} – Kundennr. ${extracted.customerNumber || '–'}`
            : 'Bitte prüfen & ggf. ergänzen.',
        });
      } else {
        toast({
          title: 'KI-Erkennung fehlgeschlagen',
          description: 'Bitte tragen Sie die Daten manuell ein.',
          variant: 'destructive',
        });
        setManualEntry(true);
      }
    } catch {
      toast({
        title: 'Fehler',
        description: 'Bitte tragen Sie die Daten manuell ein.',
        variant: 'destructive',
      });
      setManualEntry(true);
    } finally {
      setScanning(false);
    }
  }, [toast]);

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setMode('upload');
    handleFileOrPhoto(file);
  }, [handleFileOrPhoto]);

  const handleSaveProvider = () => {
    if (!providerInfo.providerName && !providerInfo.customerNumber) {
      toast({ title: 'Bitte mindestens Versorger oder Kundennummer angeben', variant: 'destructive' });
      return;
    }
    setInfoSaved(true);
    onProviderInfoSaved(meter.id, providerInfo);
    toast({
      title: '✅ Versorger-Daten gespeichert',
      description: `${providerInfo.providerName} – bereit für Kündigung`,
    });
  };

  const handleReminderToggle = (checked: boolean) => {
    setReminderSet(checked);
    onReminderSet(meter.id, checked);
    if (checked) {
      toast({
        title: '🔔 Erinnerung aktiviert',
        description: `Kündigungs-Erinnerung wird an ${tenantEmail} gesendet.`,
      });
    }
  };

  const handleProviderFieldChange = (field: keyof ProviderInfo, value: string) => {
    setProviderInfo(prev => ({ ...prev, [field]: value }));
    if (infoSaved) setInfoSaved(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Meter header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">{meter.medium}</p>
            <p className="text-[10px] text-muted-foreground">
              {meter.meterNumber && `Nr. ${meter.meterNumber} · `}
              {meter.reading} {meter.unit}
            </p>
          </div>
        </div>
        {(infoSaved || reminderSet) && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            {infoSaved ? 'Daten erfasst' : 'Erinnerung aktiv'}
          </div>
        )}
      </div>

      {/* Two options */}
      <div className="space-y-2">
        {/* Option A: Upload/Photo */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          <p className="text-xs font-medium text-foreground">
            Option A: Versorger-Unterlagen hochladen
          </p>
          <p className="text-[10px] text-muted-foreground">
            Abrechnung, Vertrag oder Kundenschreiben – KI extrahiert Kundennummer & Versorger
          </p>

          {mode === 'idle' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-xl gap-1.5 text-xs h-9"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-3.5 h-3.5" />
                Foto
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-xl gap-1.5 text-xs h-9"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-xl gap-1.5 text-xs h-9"
                onClick={() => { setMode('upload'); setManualEntry(true); }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Manuell
              </Button>
            </div>
          )}

          {/* Scanning state */}
          {scanning && (
            <div className="flex items-center gap-2 bg-primary/5 rounded-xl p-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">KI analysiert Dokument…</span>
            </div>
          )}

          {/* Manual entry / AI results form */}
          {mode === 'upload' && !scanning && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2 bg-secondary/30 rounded-xl p-3"
            >
              {providerInfo.providerName && !manualEntry && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-primary mb-1">
                  <CheckCircle2 className="w-3 h-3" />
                  KI-Erkennung erfolgreich – bitte prüfen
                </div>
              )}
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Versorgername</label>
                <Input
                  value={providerInfo.providerName}
                  onChange={e => handleProviderFieldChange('providerName', e.target.value)}
                  placeholder="z. B. Vattenfall, E.ON"
                  className="rounded-lg h-8 text-xs bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Kundennummer</label>
                  <Input
                    value={providerInfo.customerNumber}
                    onChange={e => handleProviderFieldChange('customerNumber', e.target.value)}
                    placeholder="z. B. 12345678"
                    className="rounded-lg h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Vertragsnummer</label>
                  <Input
                    value={providerInfo.contractNumber}
                    onChange={e => handleProviderFieldChange('contractNumber', e.target.value)}
                    placeholder="optional"
                    className="rounded-lg h-8 text-xs bg-background"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full rounded-xl gap-1.5 text-xs h-8 mt-1"
                onClick={handleSaveProvider}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Daten übernehmen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-xl text-[11px]"
                onClick={() => setMode('idle')}
              >
                Andere Option auswählen
              </Button>
            </motion.div>
          )}
        </motion.div>

        {/* Divider */}
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-muted-foreground font-medium">ODER</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Option B: Email reminder */}
        <div className="flex items-start gap-3 bg-secondary/30 rounded-xl p-3">
          <Checkbox
            id={`reminder-${meter.id}`}
            checked={reminderSet}
            onCheckedChange={(checked) => handleReminderToggle(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor={`reminder-${meter.id}`} className="cursor-pointer space-y-0.5">
            <p className="text-xs font-medium">
              Per E-Mail an Kündigung erinnern
            </p>
            <p className="text-[10px] text-muted-foreground">
              Erinnerung an <span className="font-medium text-foreground">{tenantEmail || '(keine E-Mail hinterlegt)'}</span>
            </p>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
              <Mail className="w-3 h-3" />
              E-Mail-Adresse aus Ihren Vertragsdaten
            </div>
          </label>
        </div>
      </div>

      {/* Saved state: provider info */}
      {infoSaved && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-accent/10 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <FileText className="w-3.5 h-3.5" />
            Versorger-Daten erfasst
          </div>
          <p className="text-[10px] text-muted-foreground">
            {providerInfo.providerName}{providerInfo.customerNumber ? ` · Kd.-Nr. ${providerInfo.customerNumber}` : ''}
            {providerInfo.contractNumber ? ` · Vertrag ${providerInfo.contractNumber}` : ''}
          </p>
        </motion.div>
      )}

      {/* Saved state: reminder */}
      {reminderSet && !infoSaved && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-primary/10 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Bell className="w-3.5 h-3.5" />
            Erinnerung aktiviert
          </div>
          <p className="text-[10px] text-muted-foreground">
            Kündigungs-Erinnerung wird an {tenantEmail} gesendet.
          </p>
        </motion.div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleCapture}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
    </div>
  );
};
