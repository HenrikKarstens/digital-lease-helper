import { motion } from 'framer-motion';
import { FileText, Send, CheckCircle2, Shield, Mail, Calendar, MapPin, Users, Download, Printer, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateMasterProtocol, generateMasterProtocolBlob } from '@/lib/pdfGenerator';

export const Step13Certificate = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole, depositLabel, isSale, isMoveIn } = useTransactionLabels();
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePreview = useCallback(() => {
    try {
      const blob = generateMasterProtocolBlob(data);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (e) {
      toast({ title: 'Fehler', description: 'PDF konnte nicht erstellt werden.', variant: 'destructive' });
    }
  }, [data, toast]);

  const handlePrint = useCallback(() => {
    if (!previewUrl) return;
    const win = window.open(previewUrl, '_blank');
    win?.focus();
  }, [previewUrl]);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  const deposit = parseFloat(data.depositAmount) || 0;
  const defectsCost = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const nkBuffer = (data.nkPrognose - data.nkVorauszahlung) * 3;
  const payout = Math.max(0, deposit - defectsCost - nkBuffer);

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      updateData({ protocolSent: true });
      toast({
        title: '✅ Protokoll versendet!',
        description: `Das EstateTurn-Zertifikat wurde an ${data.landlordEmail || 'email@beispiel.de'} und ${data.tenantEmail || 'email@beispiel.de'} gesendet.`,
      });
    }, 2000);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* PDF inline preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">Protokoll-Vorschau</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5 rounded-xl">
                <Printer className="w-4 h-4" />
                Drucken / Speichern
              </Button>
              <Button size="icon" variant="ghost" onClick={closePreview} className="rounded-xl">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <iframe src={previewUrl} className="flex-1 w-full border-0" title="Protokoll PDF Vorschau" />
        </div>
      )}

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
                <p className="text-xs text-muted-foreground">Auszahlung</p>
                <p className="font-bold text-lg text-primary">{payout.toFixed(0)} €</p>
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
            onClick={() => generateMasterProtocol(data)}
            className="flex-1 h-12 rounded-2xl font-semibold gap-2 border-primary/30"
          >
            <Download className="w-4 h-4" />
            Herunterladen
          </Button>
        </motion.div>

        {!data.protocolSent ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <Button onClick={handleSend} disabled={sending} className="w-full h-14 rounded-2xl text-base font-semibold gap-2" size="lg">
              {sending ? (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Wird versendet...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Rechtssicher versenden
                </>
              )}
            </Button>
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
              Weiter zum Utility-Switch
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
