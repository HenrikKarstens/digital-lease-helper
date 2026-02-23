import { motion } from 'framer-motion';
import { useState, useMemo, useCallback } from 'react';
import { CreditCard, Zap, Shield, CheckCircle2, Mail, ExternalLink, TrendingDown, Eye, FileText, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useToast } from '@/hooks/use-toast';
import { generateMasterProtocolBlob } from '@/lib/pdfGenerator';
import { SendDialog } from './SendDialog';

function extractPlz(address: string): string {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
}

function extractCity(address: string): string {
  const plzMatch = address.match(/\b\d{5}\s+([A-Za-zÄÖÜäöüß\s-]+)/);
  return plzMatch ? plzMatch[1].trim() : '';
}

const CHECK24_AFFILIATE_ID = 'ESTATETURN_PARTNER';

type UnlockMethod = 'service-check' | 'payment' | null;

export const Step12Unlock = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole } = useTransactionLabels();
  const { toast } = useToast();

  const [chosenMethod, setChosenMethod] = useState<UnlockMethod>(null);
  const [processing, setProcessing] = useState(false);
  const [dsgvoConsent, setDsgvoConsent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewViewed, setPreviewViewed] = useState(data.previewViewed ?? false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const isUnlocked = data.paymentStatus === 'paid' || data.serviceCheckStatus === 'completed';
  const plz = extractPlz(data.propertyAddress);
  const city = extractCity(data.propertyAddress) || 'Ihrem Standort';
  const stromMeter = data.meterReadings.find(m => m.medium === 'Strom');
  const estimatedKwh = 2000;
  const estimatedSavings = 187;

  const recipientList = useMemo(() => {
    const list: { name: string; email: string }[] = [];
    if (data.tenantEmail) list.push({ name: data.tenantName || clientRole, email: data.tenantEmail });
    if (data.landlordEmail) list.push({ name: data.landlordName || ownerRole, email: data.landlordEmail });
    return list;
  }, [data.tenantEmail, data.tenantName, data.landlordEmail, data.landlordName, clientRole, ownerRole]);

  // PDF Preview
  const handlePreview = useCallback(() => {
    try {
      const blob = generateMasterProtocolBlob(data);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewViewed(true);
      updateData({ previewViewed: true });
    } catch {
      toast({ title: 'Fehler', description: 'PDF konnte nicht erstellt werden.', variant: 'destructive' });
    }
  }, [data, toast, updateData]);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  const handlePrint = useCallback(() => {
    if (!previewUrl) return;
    const win = window.open(previewUrl, '_blank');
    win?.focus();
  }, [previewUrl]);

  // Check24 link builder
  const buildCheck24Link = () => {
    const params = new URLSearchParams({
      zipcode: plz || '10115',
      totalConsumption: String(estimatedKwh),
      affiliate_id: CHECK24_AFFILIATE_ID,
    });
    if (stromMeter?.meterNumber) params.set('meterNumber', stromMeter.meterNumber);
    const now = new Date();
    params.set('movingDate', `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`);
    return `https://www.check24.de/strom/vergleich/?${params.toString()}`;
  };

  // Send protocol to recipients
  const sendProtocol = (recipients: { name: string; email: string }[]) => {
    updateData({ protocolSent: true });
    const emails = recipients.map(r => r.email).join(', ');
    toast({
      title: '✅ Protokoll versendet!',
      description: `Das rechtssichere Protokoll wurde an ${emails || 'die Beteiligten'} gesendet.`,
    });
  };

  // Service-check flow: user clicks free option → opens send dialog
  const handleServiceCheckSelect = () => {
    setChosenMethod('service-check');
  };

  const handleServiceCheckConfirmSend = (recipients: { role: string; name: string; email: string }[]) => {
    setSending(true);
    setTimeout(() => {
      updateData({ serviceCheckStatus: 'completed' });
      sendProtocol(recipients);
      setSending(false);
      setSendDialogOpen(false);
      window.open(buildCheck24Link(), '_blank');
    }, 1500);
  };

  // Payment flow
  const handlePaymentSelect = () => {
    setChosenMethod('payment');
    setProcessing(true);
    setTimeout(() => {
      updateData({ paymentStatus: 'paid' });
      setProcessing(false);
      setSendDialogOpen(true);
    }, 2000);
  };

  const handlePaymentConfirmSend = (recipients: { role: string; name: string; email: string }[]) => {
    setSending(true);
    setTimeout(() => {
      sendProtocol(recipients);
      setSending(false);
      setSendDialogOpen(false);
    }, 1500);
  };

  // Already sent state
  if (data.protocolSent && isUnlocked) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md glass-card rounded-2xl p-6 text-center"
        >
          <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Erfolgreich versendet!</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Das rechtssichere Protokoll wurde an alle Beteiligten gesendet.
          </p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-6">
            <Mail className="w-3.5 h-3.5" />
            <span>{recipientList.map(r => r.email).join(', ') || 'Alle Beteiligten'}</span>
          </div>
          <Button onClick={() => goToStepById('utility')} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
            Weiter zu Umzugs-Vorteile
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">Protokoll-Vorschau</span>
              <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                VORABZUG
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5 rounded-xl">
                <Printer className="w-4 h-4" />
                Drucken
              </Button>
              <Button size="icon" variant="ghost" onClick={closePreview} className="rounded-xl">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 relative">
            <iframe src={previewUrl} className="w-full h-full border-0" title="Protokoll PDF Vorschau" />
            <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
              <div className="text-destructive/15 font-black text-2xl sm:text-4xl whitespace-nowrap select-none"
                style={{ transform: 'rotate(-35deg)', letterSpacing: '0.05em' }}>
                VORABZUG – Kein Original
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Dialog */}
      <SendDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        onConfirmSend={chosenMethod === 'service-check' ? handleServiceCheckConfirmSend : handlePaymentConfirmSend}
        sending={sending}
      />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
        <Shield className="w-5 h-5 text-primary" />
      </motion.div>

      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="text-2xl font-bold mb-2 text-center">
        Protokoll freischalten & versenden
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="text-muted-foreground text-center mb-4 text-sm max-w-sm">
        Prüfen Sie das Protokoll in der Vorschau und wählen Sie eine Freischaltungs-Option.
      </motion.p>

      {/* Preview button */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="w-full max-w-md mb-6">
        <Button
          variant={previewViewed ? 'outline' : 'default'}
          onClick={handlePreview}
          className="w-full h-12 rounded-2xl font-semibold gap-2 border-primary/30"
        >
          <Eye className="w-4 h-4" />
          {previewViewed ? 'Vorschau erneut öffnen' : 'Vorschau öffnen (Pflicht)'}
          {previewViewed && <CheckCircle2 className="w-4 h-4 text-primary" />}
        </Button>
        {!previewViewed && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Bitte öffnen Sie zuerst die Vorschau, um fortzufahren.
          </p>
        )}
      </motion.div>

      <div className={`w-full max-w-md space-y-4 transition-opacity ${previewViewed ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {/* PRIO 1: Free Service Check */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-xl">
            EMPFOHLEN
          </div>

          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">Kostenfreies Gutachten & Wechselcheck</p>
                <span className="text-sm font-bold text-primary">0 €</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Protokoll wird sofort freigeschaltet und versendet. Zusätzlich erhalten Sie einen kostenlosen Tarifvergleich.
              </p>
            </div>
          </div>

          {/* Dynamic savings */}
          <div className="bg-background/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Ersparnis-Prognose für {city}</p>
              <p className="text-base font-bold text-primary">Bis zu {estimatedSavings} € sparen</p>
              <p className="text-[11px] text-muted-foreground">
                gegenüber dem Grundversorger bei {estimatedKwh.toLocaleString('de-DE')} kWh/Jahr
              </p>
            </div>
          </div>

          {/* GDPR consent */}
          <div className="flex items-start gap-2.5">
            <Checkbox id="dsgvo-unlock" checked={dsgvoConsent} onCheckedChange={(v) => setDsgvoConsent(v === true)} className="mt-0.5" />
            <label htmlFor="dsgvo-unlock" className="text-[11px] text-muted-foreground leading-tight cursor-pointer">
              Ich stimme zu, dass meine Daten (PLZ <span className="font-semibold text-foreground">{plz || '–'}</span>, geschätzter Verbrauch <span className="font-semibold text-foreground">{estimatedKwh.toLocaleString('de-DE')} kWh</span>, Zählernummer <span className="font-semibold text-foreground">{stromMeter?.meterNumber || '–'}</span>) zum Zwecke des Tarifvergleichs an Check24 übertragen werden.{' '}
              <a href="/datenschutz" className="underline text-primary">Datenschutzerklärung</a>.
            </label>
          </div>

          <Button
            onClick={() => { handleServiceCheckSelect(); setSendDialogOpen(true); }}
            disabled={!dsgvoConsent || !previewViewed}
            className="w-full h-12 rounded-2xl font-semibold gap-2"
            size="lg"
          >
            <Zap className="w-5 h-5" />
            Kostenfreie Ersparnis & Gutachten freischalten
            <ExternalLink className="w-4 h-4" />
          </Button>
        </motion.div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium">oder</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* PRIO 2: Paid – subtle text link style */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="text-center"
        >
          <button
            onClick={handlePaymentSelect}
            disabled={processing || !previewViewed}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            <span>Einmalzahlung <strong>9,90 €</strong> – Rechtssicher versenden</span>
          </button>
        </motion.div>
      </div>

      {/* Payment processing overlay */}
      {processing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin mb-3" />
          <p className="text-sm font-medium">Zahlung wird verarbeitet…</p>
        </div>
      )}
    </div>
  );
};
