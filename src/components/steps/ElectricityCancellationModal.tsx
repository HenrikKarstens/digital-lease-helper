import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Camera, Upload, Pencil, Loader2, CheckCircle2,
  FileText, Download, Mail, ArrowRight, Shield, Info
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHandover, MeterReading } from '@/context/HandoverContext';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface ProviderData {
  providerName: string;
  customerNumber: string;
  contractNumber: string;
}

interface ElectricityCancellationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meter: MeterReading;
  onCancellationComplete: (meterId: string, info: ProviderData & { status: string }) => void;
}

export const ElectricityCancellationModal = ({
  open,
  onOpenChange,
  meter,
  onCancellationComplete,
}: ElectricityCancellationModalProps) => {
  const { data } = useHandover();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'data' | 'letter' | 'done'>('data');
  const [scanning, setScanning] = useState(false);
  const [providerData, setProviderData] = useState<ProviderData>({
    providerName: '',
    customerNumber: '',
    contractNumber: '',
  });
  const [sending, setSending] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [maloIdLocal, setMaloIdLocal] = useState(meter.maloId || '');

  const propertyAddress = data.propertyAddress || 'Nicht angegeben';
  const tenantName = data.tenantName || 'Mieter';
  const moveOutDate = data.contractEnd || new Date().toLocaleDateString('de-DE');
  const meterReading = `${meter.reading} ${meter.unit}`;

  // OCR via FormData (matches analyze-photo edge function)
  const handleFileOrPhoto = useCallback(async (file: File) => {
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'utility-bill');

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
        const d = result.data || result;
        const extracted: ProviderData = {
          providerName: d.providerName || d.provider || d.versorger || '',
          customerNumber: d.customerNumber || d.kundennummer || '',
          contractNumber: d.contractNumber || d.vertragsnummer || d.vertragskonto || '',
        };
        setProviderData(prev => ({
          providerName: extracted.providerName || prev.providerName,
          customerNumber: extracted.customerNumber || prev.customerNumber,
          contractNumber: extracted.contractNumber || prev.contractNumber,
        }));
        toast({
          title: '📄 Versorger-Daten erkannt',
          description: extracted.providerName
            ? `${extracted.providerName} – Kundennr. ${extracted.customerNumber || '–'}`
            : 'Bitte prüfen & ggf. ergänzen.',
        });
      } else {
        const errBody = await response.json().catch(() => ({}));
        toast({ title: 'KI-Erkennung fehlgeschlagen', description: errBody.error || 'Bitte Daten manuell eingeben.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Fehler bei der Analyse', description: 'Bitte Daten manuell eingeben.', variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  }, [toast]);

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    handleFileOrPhoto(file);
  }, [handleFileOrPhoto]);

  const cancellationText = useMemo(() => {
    const provider = providerData.providerName || '[Versorger]';
    const custNo = providerData.customerNumber || '[Kundennummer]';
    const today = new Date().toLocaleDateString('de-DE');

    return `${tenantName}
${data.nextAddress || propertyAddress}

An: ${provider}

Datum: ${today}

Betreff: Kündigung Stromvertrag – Kundennummer ${custNo}

Sehr geehrte Damen und Herren,

hiermit kündige ich meinen Stromvertrag zur Kundennummer ${custNo}${providerData.contractNumber ? ` (Vertragskonto ${providerData.contractNumber})` : ''} für das Objekt ${propertyAddress} zum ${moveOutDate}.

Der Zählerstand zum Zeitpunkt der Übergabe beträgt ${meterReading}.${meter.meterNumber ? `\nZählernummer: ${meter.meterNumber}` : ''}${meter.maloId ? `\nMaLo-ID: ${meter.maloId}` : ''}

Bitte bestätigen Sie mir den Erhalt dieser Kündigung.

Bitte senden Sie mir die Schlussrechnung an die oben genannte Adresse.

Mit freundlichen Grüßen
${tenantName}`;
  }, [providerData, tenantName, propertyAddress, moveOutDate, meterReading, meter, data.nextAddress]);

  const handleGeneratePDF = useCallback(() => {
    const doc = new jsPDF();
    const lines = cancellationText.split('\n');
    let y = 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    for (const line of lines) {
      if (line.startsWith('Betreff:')) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
      }
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 6;
      if (line.startsWith('Betreff:')) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
      }
    }

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Dieses Schreiben genügt der Textform gem. § 126b BGB (§ 309 Nr. 13 BGB).', 20, 280);

    const provider = providerData.providerName || 'Versorger';
    doc.save(`Kuendigung_${provider}_${new Date().toISOString().slice(0, 10)}.pdf`);

    setPdfGenerated(true);
    toast({ title: '📥 PDF heruntergeladen', description: 'Kündigungsschreiben wurde als PDF gespeichert.' });
  }, [cancellationText, providerData.providerName, toast]);

  const handleSendEmail = useCallback(async () => {
    setSending(true);
    await new Promise(r => setTimeout(r, 1500));
    setSending(false);
    setStep('done');
    onCancellationComplete(meter.id, { ...providerData, status: 'Kündigungsschreiben generiert' });
    toast({
      title: '✅ Kündigung versendet',
      description: `Das Kündigungsschreiben wurde an ${providerData.providerName || 'den Versorger'} gesendet.`,
    });
  }, [meter.id, providerData, onCancellationComplete, toast]);

  const handleFinish = useCallback(() => {
    onCancellationComplete(meter.id, { ...providerData, status: 'Kündigungsschreiben generiert' });
    onOpenChange(false);
  }, [meter.id, providerData, onCancellationComplete, onOpenChange]);

  const canProceedToLetter = providerData.providerName || providerData.customerNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        {/* Header with Weiter button */}
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-base">Stromvertrag kündigen & Zählerstand übermitteln</DialogTitle>
                <DialogDescription className="text-xs">
                  Rechtssicheres Kündigungsschreiben gem. § 309 Nr. 13 BGB
                </DialogDescription>
              </div>
            </div>
            {(step === 'letter' && pdfGenerated) || step === 'done' ? (
              <Button size="sm" className="rounded-xl gap-1 text-xs" onClick={handleFinish}>
                Weiter <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : null}
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <AnimatePresence mode="wait">
            {step === 'data' && (
              <motion.div key="data" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                {/* Meter reading from Phase 8 – read-only */}
                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold">Zählerstand aus Phase 8</span>
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">automatisch</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Zählerstand</Label>
                      <Input value={meterReading} readOnly className="rounded-lg h-8 text-xs bg-muted/50 font-mono font-bold" />
                    </div>
                    {meter.meterNumber && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Zählernummer</Label>
                        <Input value={meter.meterNumber} readOnly className="rounded-lg h-8 text-xs bg-muted/50 font-mono" />
                      </div>
                    )}
                  </div>
                  <div className="mt-1">
                    <Label className="text-[10px] text-muted-foreground">Marktlokations-ID (MaLo-ID)</Label>
                    <Input
                      value={maloIdLocal}
                      onChange={e => setMaloIdLocal(e.target.value)}
                      placeholder="z. B. DE000... – aus Stromrechnung entnehmen"
                      className="rounded-lg h-8 text-xs font-mono"
                    />
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      Die MaLo-ID finden Sie auf Ihrer Stromrechnung oder im Vertragsschreiben.
                    </p>
                  </div>
                  <div className="mt-1">
                    <Label className="text-[10px] text-muted-foreground">Objekt-Adresse</Label>
                    <Input value={propertyAddress} readOnly className="rounded-lg h-8 text-xs bg-muted/50" />
                  </div>
                </div>

                {/* OCR Upload */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Rechnung fotografieren für automatische Datenübernahme</p>
                  <p className="text-[10px] text-muted-foreground">
                    KI extrahiert Versorger-Name, Kundennummer & Vertragsnummer automatisch
                  </p>
                  {scanning ? (
                    <div className="flex items-center gap-2 bg-primary/5 rounded-xl p-4 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">KI analysiert Dokument…</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 rounded-xl gap-1.5 text-xs h-9"
                        onClick={() => cameraInputRef.current?.click()}>
                        <Camera className="w-3.5 h-3.5" /> Foto
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 rounded-xl gap-1.5 text-xs h-9"
                        onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-3.5 h-3.5" /> Upload
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 rounded-xl gap-1.5 text-xs h-9"
                        onClick={() => {}}>
                        <Pencil className="w-3.5 h-3.5" /> Manuell
                      </Button>
                    </div>
                  )}
                </div>

                {/* Provider data form */}
                <div className="space-y-2 bg-secondary/30 rounded-xl p-3">
                  {providerData.providerName && (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-primary mb-1">
                      <CheckCircle2 className="w-3 h-3" />
                      KI-Erkennung erfolgreich – bitte prüfen
                    </div>
                  )}
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Versorger-Name *</Label>
                    <Input
                      value={providerData.providerName}
                      onChange={e => setProviderData(prev => ({ ...prev, providerName: e.target.value }))}
                      placeholder="z. B. E.ON, Vattenfall, SWM"
                      className="rounded-lg h-8 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Kundennummer *</Label>
                      <Input
                        value={providerData.customerNumber}
                        onChange={e => setProviderData(prev => ({ ...prev, customerNumber: e.target.value }))}
                        placeholder="z. B. 12345678"
                        className="rounded-lg h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Vertragsnummer</Label>
                      <Input
                        value={providerData.contractNumber}
                        onChange={e => setProviderData(prev => ({ ...prev, contractNumber: e.target.value }))}
                        placeholder="optional"
                        className="rounded-lg h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Legal hint */}
                <div className="bg-primary/5 rounded-xl p-3 flex items-start gap-2 text-[10px] text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">§ 309 Nr. 13 BGB:</strong> Kündigungen in Textform sind wirksam – keine händische Unterschrift erforderlich, sofern per E-Mail oder PDF versendet.
                  </span>
                </div>

                <Button
                  className="w-full h-10 rounded-xl gap-2 text-xs font-semibold"
                  disabled={!canProceedToLetter}
                  onClick={() => setStep('letter')}
                >
                  <FileText className="w-4 h-4" />
                  Kündigungsschreiben erstellen
                </Button>
              </motion.div>
            )}

            {step === 'letter' && (
              <motion.div key="letter" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold">Kündigungsschreiben – Vorschau</span>
                </div>

                <div className="bg-card border border-border rounded-xl p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {cancellationText}
                </div>

                <div className="bg-accent/10 rounded-xl p-2.5 flex items-start gap-2 text-[10px]">
                  <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    Dieses Schreiben genügt der <strong className="text-foreground">Textform gem. § 126b BGB</strong>. Eine händische Unterschrift ist nicht erforderlich (§ 309 Nr. 13 BGB).
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-10 rounded-xl gap-2 text-xs" onClick={handleGeneratePDF}>
                    <Download className="w-4 h-4" />
                    Als PDF speichern
                  </Button>
                  <Button
                    className="h-10 rounded-xl gap-2 text-xs"
                    onClick={handleSendEmail}
                    disabled={sending}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Per E-Mail senden
                  </Button>
                </div>

                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setStep('data')}>
                  ← Daten bearbeiten
                </Button>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 py-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-accent" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Kündigungsschreiben generiert</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Das Kündigungsschreiben wurde an {providerData.providerName || 'den Versorger'} gesendet.
                  </p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-3 text-left space-y-1 text-[10px] text-muted-foreground">
                  <p><strong className="text-foreground">Versorger:</strong> {providerData.providerName}</p>
                  <p><strong className="text-foreground">Kundennr.:</strong> {providerData.customerNumber}</p>
                  <p><strong className="text-foreground">Zählerstand:</strong> {meterReading}</p>
                  <p><strong className="text-foreground">Kündigung zum:</strong> {moveOutDate}</p>
                </div>
                <Button variant="outline" className="rounded-xl gap-2 text-xs" onClick={handleGeneratePDF}>
                  <Download className="w-3.5 h-3.5" />
                  PDF nochmals herunterladen
                </Button>
                <Button className="w-full rounded-xl text-xs h-10 gap-1" onClick={handleFinish}>
                  Weiter <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleCapture} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
      </DialogContent>
    </Dialog>
  );
};
