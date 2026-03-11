import { motion } from 'framer-motion';
import { useState, useMemo, useCallback } from 'react';
import {
  CreditCard, Shield, CheckCircle2, Mail, FileText, Eye, Printer, X,
  PartyPopper, MapPin, Users, Key, Camera, Wrench, ArrowRight,
  AlertTriangle, Zap, Building2, Flame, Droplets
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useToast } from '@/hooks/use-toast';
import { generateMasterProtocolBlob } from '@/lib/pdfGenerator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const Step12Unlock = () => {
  const { data, updateData, resetData } = useHandover();
  const { ownerRole, clientRole } = useTransactionLabels();
  const { toast } = useToast();

  const [processing, setProcessing] = useState(false);
  const [dsgvoConsent, setDsgvoConsent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewViewed, setPreviewViewed] = useState(data.previewViewed ?? false);

  const isUnlocked = data.paymentStatus === 'paid' || data.serviceCheckStatus === 'completed';

  const recipientList = useMemo(() => {
    const list: { name: string; email: string }[] = [];
    if (data.tenantEmail) list.push({ name: data.tenantName || clientRole, email: data.tenantEmail });
    if (data.landlordEmail) list.push({ name: data.landlordName || ownerRole, email: data.landlordEmail });
    return list;
  }, [data.tenantEmail, data.tenantName, data.landlordEmail, data.landlordName, clientRole, ownerRole]);

  // Summary stats
  const findingsCount = data.findings.length;
  const defectsCount = data.findings.filter(f => f.entryType !== 'note').length;
  const metersCount = data.meterReadings.length;
  const keysCount = data.keyEntries.reduce((sum, k) => sum + k.count, 0);
  const participantsCount = data.participants.filter(p => p.present).length;
  const hasDeposit = !!data.depositAmount;
  const criticalClauses = data.deepLegalClauses.filter(c => c.status === 'KRITISCH' || c.status === 'UNWIRKSAM').length;
  const defectPhotos = data.findings.filter(f => f.entryType !== 'note' && f.photoUrl).length;

  // PDF Preview
  const handlePreview = useCallback(() => {
    try {
      const blob = generateMasterProtocolBlob(data);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          window.open(dataUrl, '_blank');
        } else {
          setPreviewUrl(dataUrl);
        }
        setPreviewViewed(true);
        updateData({ previewViewed: true });
      };
      reader.readAsDataURL(blob);
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

  const sendProtocol = (recipients: { name: string; email: string }[]) => {
    updateData({ protocolSent: true });
    const emails = recipients.map(r => r.email).join(', ');
    toast({
      title: '✅ Protokoll versendet!',
      description: `Das rechtssichere Protokoll wurde an ${emails || 'die Beteiligten'} gesendet.`,
    });
  };

  // Payment flow
  const handlePayment = () => {
    setProcessing(true);
    setTimeout(() => {
      updateData({ paymentStatus: 'paid' });
      setProcessing(false);
      sendProtocol(recipientList);
    }, 2000);
  };

  // Free: Handwerker leads via DSGVO
  const handleHandwerkerLeads = () => {
    setProcessing(true);
    // Open MyHammer or similar
    const myHammerUrl = 'https://www.myhammer.de/';
    window.open(myHammerUrl, '_blank');
    setTimeout(() => {
      updateData({ serviceCheckStatus: 'completed' });
      setProcessing(false);
      sendProtocol(recipientList);
    }, 1500);
  };

  // Completed state
  if (data.protocolSent && isUnlocked) {
    return (
      <TooltipProvider>
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass-card rounded-2xl p-6 text-center"
          >
            <PartyPopper className="w-14 h-14 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Übergabe abgeschlossen!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Das rechtssichere Protokoll wurde an alle Beteiligten gesendet.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-6">
              <Mail className="w-3.5 h-3.5" />
              <span>{recipientList.map(r => r.email).join(', ') || 'Alle Beteiligten'}</span>
            </div>
            <Button variant="outline" onClick={resetData} className="rounded-xl gap-2">
              Neue Übergabe starten
            </Button>
          </motion.div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
        {/* PDF Preview Modal */}
        {previewUrl && (
          <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">Protokoll-Vorschau</span>
                <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">VORABZUG</span>
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

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
          <Shield className="w-5 h-5 text-primary" />
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="text-2xl font-bold mb-2 text-center">
          Protokoll-Zusammenfassung
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-muted-foreground text-center mb-6 text-sm max-w-sm">
          Alle Daten erfasst – prüfen Sie die Zusammenfassung und schalten Sie das Protokoll frei.
        </motion.p>

        <div className="w-full max-w-md space-y-4">

          {/* ── Summary Card ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="glass-card rounded-2xl p-5 space-y-3"
          >
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Kurzzusammenfassung
            </h3>

            {/* Property */}
            {data.propertyAddress && (
              <div className="flex items-center gap-2 bg-secondary/30 rounded-xl px-3 py-2">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-medium">{data.propertyAddress}</span>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-secondary/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold">{participantsCount} Teilnehmer</p>
                  <p className="text-[10px] text-muted-foreground">anwesend</p>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold">{findingsCount} Einträge</p>
                  <p className="text-[10px] text-muted-foreground">{defectsCount} Mängel</p>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold">{metersCount} Zähler</p>
                  <p className="text-[10px] text-muted-foreground">dokumentiert</p>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold">{keysCount} Schlüssel</p>
                  <p className="text-[10px] text-muted-foreground">übergeben</p>
                </div>
              </div>
            </div>

            {/* Deposit */}
            {hasDeposit && (
              <div className="flex items-center gap-2 bg-primary/5 rounded-xl px-3 py-2">
                <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs">Kaution: <span className="font-semibold">{data.depositAmount} €</span></span>
              </div>
            )}

            {/* Critical clauses warning */}
            {criticalClauses > 0 && (
              <div className="flex items-center gap-2 bg-destructive/10 rounded-xl px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                <span className="text-xs text-destructive font-medium">{criticalClauses} kritische Vertragsklausel{criticalClauses > 1 ? 'n' : ''} erkannt</span>
              </div>
            )}
          </motion.div>

          {/* Preview button */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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

          {/* ── Unlock Options (only after preview) ── */}
          <div className={`space-y-3 transition-opacity ${previewViewed ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>

            {/* Option 1: Handwerker Leads (kostenlos mit DSGVO) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border-2 border-accent/30 hover:border-accent/60 bg-accent/5 p-4 transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">Kostenlos freischalten</p>
                    <span className="text-sm font-bold text-accent-foreground">0 €</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {defectsCount > 0
                      ? `${defectsCount} Mängel erkannt – erhalte unverbindliche Handwerkerangebote zur Behebung und schalte das Protokoll sofort kostenlos frei.`
                      : 'Erhalte unverbindliche Handwerkerangebote und schalte das Protokoll sofort kostenlos frei.'}
                  </p>
                </div>
              </div>

              {/* Data that will be shared */}
              {defectsCount > 0 && (
                <div className="bg-secondary/30 rounded-xl p-3 mb-3 space-y-2">
                  <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    Folgende Daten werden übermittelt:
                  </p>
                  <ul className="text-[11px] text-muted-foreground space-y-1 pl-5 list-disc">
                    <li>Kontaktdaten: <span className="font-medium text-foreground">{data.tenantName || 'Name'}</span>, <span className="font-medium text-foreground">{data.tenantEmail || 'E-Mail'}</span>{data.tenantPhone ? <>, <span className="font-medium text-foreground">{data.tenantPhone}</span></> : ''}</li>
                    <li>Objektadresse: <span className="font-medium text-foreground">{data.propertyAddress || '–'}</span></li>
                    <li>{defectsCount} dokumentierte Mängel inkl. Beschreibung, Raum &amp; Schadensart</li>
                    {defectPhotos > 0 && (
                      <li className="flex items-center gap-1">
                        <Camera className="w-3 h-3 shrink-0" />
                        <span>{defectPhotos} Beweisfoto{defectPhotos > 1 ? 's' : ''} aus der Mängelerfassung</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* DSGVO Consent */}
              <div className="flex items-start gap-2.5 mb-3 bg-background/60 rounded-xl p-3">
                <Checkbox
                  id="dsgvo-handwerker"
                  checked={dsgvoConsent}
                  onCheckedChange={(v) => setDsgvoConsent(v === true)}
                  className="mt-0.5"
                />
                <label htmlFor="dsgvo-handwerker" className="text-[11px] text-muted-foreground leading-tight cursor-pointer">
                  Ich stimme gemäß Art. 6 Abs. 1 lit. a DSGVO zu, dass meine Kontaktdaten ({data.tenantName || 'Name'}, {data.tenantEmail || 'E-Mail'}), die Objektadresse, die dokumentierten Mängel sowie die zugehörigen Beweisfotos an ausgewählte Handwerksbetriebe zur unverbindlichen Angebotserstellung weitergegeben werden. Die Einwilligung kann jederzeit widerrufen werden.{' '}
                  <a href="/datenschutz" className="underline text-primary">Datenschutzerklärung</a>.
                </label>
              </div>

              <Button
                onClick={handleHandwerkerLeads}
                disabled={!dsgvoConsent || processing}
                className="w-full h-11 rounded-2xl font-semibold gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Wrench className="w-4 h-4" />
                Handwerkerangebote anfordern & freischalten
              </Button>
            </motion.div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">oder</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Option 2: Payment 9,90€ */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              onClick={handlePayment}
              disabled={processing}
              className="w-full rounded-2xl border-2 border-primary/20 hover:border-primary/50 p-4 text-left transition-all hover:shadow-md group disabled:opacity-50"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">Direkt freischalten</p>
                    <span className="text-lg font-bold text-primary">9,90 €</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sofortige Freischaltung des vollständigen Protokolls ohne Wasserzeichen. Rechtssicher & druckfertig.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
              </div>
            </motion.button>
          </div>
        </div>

        {/* Payment processing overlay */}
        {processing && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin mb-3" />
            <p className="text-sm font-medium">Wird verarbeitet…</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default Step12Unlock;
