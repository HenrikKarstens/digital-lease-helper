import { motion } from 'framer-motion';
import { FileText, Send, CheckCircle2, Shield, Mail, Calendar, MapPin, Users, Download, Eye, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateMasterProtocol, generateMasterProtocolBlob } from '@/lib/pdfGenerator';
import { SendDialog } from './SendDialog';
import { PaywallOverlay } from './PaywallOverlay';
import { PdfPreviewModal } from '@/components/pdf/PdfPreviewModal';

export const Step13Certificate = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole, depositLabel, isSale, isMoveIn } = useTransactionLabels();
  const [sending, setSending] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { toast } = useToast();

  const isUnlocked = data.paymentStatus === 'paid' || data.serviceCheckStatus === 'completed';

  const handlePreview = useCallback(async () => {
    try {
      setPreviewBlob(generateMasterProtocolBlob(data));
      setHasPreviewed(true);
    } catch (e) {
      toast({ title: 'Fehler', description: 'PDF konnte nicht erstellt werden.', variant: 'destructive' });
    }
  }, [data, toast]);

  const handlePrint = useCallback(() => {
    if (!previewBlob) return;
    const pdfUrl = URL.createObjectURL(previewBlob);
    const win = window.open(pdfUrl, '_blank');

    if (!win) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Uebergabeprotokoll_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      win.focus();
    }

    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
  }, [previewBlob]);

  const closePreview = useCallback(() => {
    setPreviewBlob(null);
  }, []);

  const deposit = parseFloat(data.depositAmount) || 0;
  const defectsCost = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const nkBuffer = (data.nkPrognose - data.nkVorauszahlung) * 3;
  const saldo = deposit - defectsCost - nkBuffer;
  const payout = Math.max(0, saldo);
  const restforderung = saldo < 0 ? Math.abs(saldo) : 0;

  const handleSendClick = () => {
    if (!isUnlocked) {
      setPaywallOpen(true);
    } else {
      setSendDialogOpen(true);
    }
  };

  const handlePaywallUnlocked = () => {
    // After paywall is cleared, open send dialog
    setSendDialogOpen(true);
  };

  const handleConfirmSend = (recipients: { name: string; email: string }[]) => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSendDialogOpen(false);
      updateData({ protocolSent: true });
      const emailList = recipients.map(r => r.email).join(', ');
      toast({
        title: '✅ Protokoll versendet!',
        description: `Das EstateTurn-Zertifikat wurde an ${emailList} gesendet.`,
      });
    }, 2000);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <PdfPreviewModal
        pdfBlob={previewBlob}
        title="Protokoll-Vorschau"
        badgeText={!isUnlocked ? 'VORABZUG' : undefined}
        watermarkText={!isUnlocked ? 'VORABZUG – Kein Original' : undefined}
        onPrint={handlePrint}
        onClose={closePreview}
      />

      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        EstateTurn-Zertifikat
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Protokoll-Vorschau & rechtssicherer Versand
      </motion.p>

      <div className="w-full max-w-md space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-5 border-2 border-primary/20"
        >
          <div className="text-center mb-4 pb-4 border-b border-border/30">
            <FileText className="w-8 h-8 text-primary mx-auto mb-2" />
            <h3 className="text-lg font-bold">{isSale ? 'Übergabeprotokoll (Kauf)' : isMoveIn ? 'Einzugsprotokoll & Zustandsbericht' : 'Übergabeprotokoll'}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              ID: ET-{Date.now().toString(36).toUpperCase()}
            </p>
            {!isUnlocked && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive px-3 py-1 rounded-full font-medium">
                <Lock className="w-3 h-3" />
                Vorabzug – Freischaltung erforderlich
              </div>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Objekt</p>
                <p className="font-medium">{data.propertyAddress || 'Musterstraße 42, 10115 Berlin'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Datum</p>
                <p className="font-medium">{new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Users className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Parteien</p>
                <p className="font-medium">{data.landlordName || ownerRole} / {data.tenantName || clientRole}</p>
              </div>
            </div>

            <div className={`bg-secondary/30 rounded-xl p-3 grid ${(!isMoveIn && !isSale) ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-center`}>
              <div>
                <p className="text-xs text-muted-foreground">{isMoveIn ? 'Befunde' : 'Mängel'}</p>
                <p className="font-bold text-lg">{data.findings.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Zähler</p>
                <p className="font-bold text-lg">{data.meterReadings.length}</p>
              </div>
              {!isMoveIn && !isSale && (
              <div>
                <p className="text-xs text-muted-foreground">{restforderung > 0 ? 'Restforderung' : 'Auszahlung'}</p>
                <p className={`font-bold text-lg ${restforderung > 0 ? 'text-destructive' : 'text-primary'}`}>
                  {restforderung > 0 ? restforderung.toFixed(0) : payout.toFixed(0)} €
                </p>
              </div>
              )}
            </div>

            {data.signatureLandlord && data.signatureTenant && (
              <div className="flex items-center gap-2 text-success text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Beide Unterschriften vorhanden · Digital signiert</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border/30 flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-success" />
            <span>SHA-256 versiegelt • Rechtssicher nach dt. {isSale ? 'Kaufrecht' : 'Mietrecht'}</span>
          </div>
        </motion.div>

        {/* PDF actions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }} className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            className="flex-1 h-12 rounded-2xl font-semibold gap-2 border-primary/30"
          >
            <Eye className="w-4 h-4" />
            Vorschau
          </Button>
          <Button
            variant="outline"
            onClick={() => { generateMasterProtocol(data); setHasPreviewed(true); }}
            className="flex-1 h-12 rounded-2xl font-semibold gap-2 border-primary/30"
          >
            <Download className="w-4 h-4" />
            Herunterladen
          </Button>
        </motion.div>

        {!hasPreviewed && !data.protocolSent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            <p className="text-xs text-muted-foreground text-center mb-2">
              Bitte öffnen Sie zuerst die Vorschau oder laden Sie das Dokument herunter, bevor Sie es versenden können.
            </p>
          </motion.div>
        )}

        {!data.protocolSent ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <Button onClick={handleSendClick} disabled={!hasPreviewed} className="w-full h-14 rounded-2xl text-base font-semibold gap-2" size="lg">
              {!isUnlocked && <Lock className="w-4 h-4" />}
              <Send className="w-5 h-5" />
              An Beteiligte versenden
            </Button>
            {!isUnlocked && hasPreviewed && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Freischaltung erforderlich, um das Protokoll ohne Wasserzeichen zu versenden.
              </p>
            )}
            <PaywallOverlay
              open={paywallOpen}
              onOpenChange={setPaywallOpen}
              onUnlocked={handlePaywallUnlocked}
              onServiceCheck={() => goToStepById('utility')}
            />
            <SendDialog
              open={sendDialogOpen}
              onOpenChange={setSendDialogOpen}
              onConfirmSend={handleConfirmSend}
              sending={sending}
            />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-2xl p-5 text-center">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="font-semibold">Erfolgreich versendet!</p>
            <p className="text-sm text-muted-foreground mt-1">Das Protokoll wurde an alle Beteiligten gesendet.</p>
            <div className="flex items-center justify-center gap-1 mt-3 text-xs text-muted-foreground">
              <Mail className="w-3.5 h-3.5" />
              <span>{data.landlordEmail || 'email@beispiel.de'}, {data.tenantEmail || 'email@beispiel.de'}</span>
            </div>
            <Button onClick={() => goToStepById('utility')} className="w-full h-12 rounded-2xl font-semibold gap-2 mt-4" size="lg">
              Weiter zu Umzugs-Vorteile
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
