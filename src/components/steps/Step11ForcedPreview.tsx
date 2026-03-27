import { motion } from 'framer-motion';
import { FileText, CheckCircle2, Shield, Mail, Calendar, MapPin, Users, Download, Printer, X, Eye, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateMasterProtocol, generateMasterProtocolBlob } from '@/lib/pdfGenerator';

export const Step11ForcedPreview = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole, isSale, isMoveIn } = useTransactionLabels();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePreview = useCallback(() => {
    try {
      // Revoke previous URL if any
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const blob = generateMasterProtocolBlob(data);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      updateData({ previewViewed: true });
    } catch (e) {
      toast({ title: 'Fehler', description: 'PDF konnte nicht erstellt werden.', variant: 'destructive' });
    }
  }, [data, toast, updateData, previewUrl]);

  const handleDownload = useCallback(() => {
    generateMasterProtocol(data);
    updateData({ previewViewed: true });
  }, [data, updateData]);

  const handlePrint = useCallback(() => {
    if (!previewUrl) return;
    const win = window.open(previewUrl, '_blank');
    win?.focus();
  }, [previewUrl]);

  const closePreview = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  const deposit = parseFloat(data.depositAmount) || 0;
  const defectsCost = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const nkBuffer = (data.nkPrognose - data.nkVorauszahlung) * 3;
  const saldo = deposit - defectsCost - nkBuffer;
  const payout = Math.max(0, saldo);
  const restforderung = saldo < 0 ? Math.abs(saldo) : 0;

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* PDF inline preview modal */}
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
                Drucken / Speichern
              </Button>
              <Button size="icon" variant="ghost" onClick={closePreview} className="rounded-xl">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 relative">
            <iframe src={previewUrl} className="w-full h-full border-0" title="Protokoll PDF Vorschau" />
            {/* Diagonal watermark overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
              <div
                className="text-destructive/15 font-black text-2xl sm:text-4xl whitespace-nowrap select-none"
                style={{
                  transform: 'rotate(-35deg)',
                  letterSpacing: '0.05em',
                  textShadow: '0 0 20px hsl(var(--destructive) / 0.1)',
                }}
              >
                VORABZUG – Kein Original
              </div>
            </div>
          </div>
        </div>
      )}

      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        EstateTurn-Zertifikat
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        Prüfen Sie Ihr Protokoll vor der Freischaltung
      </motion.p>

      <div className="w-full max-w-md space-y-4">
        {/* Certificate card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-5 border-2 border-primary/20"
        >
          <div className="text-center mb-4 pb-4 border-b border-border/30">
            <FileText className="w-8 h-8 text-primary mx-auto mb-2" />
            <h3 className="text-lg font-bold">{isSale ? 'Übergabeprotokoll (Kauf)' : isMoveIn ? 'Einzugsprotokoll & Zustandsbericht' : 'Übergabeprotokoll'}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              ID: ET-{Date.now().toString(36).toUpperCase()}
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-destructive/10 text-destructive px-3 py-1 rounded-full font-medium">
              <Lock className="w-3 h-3" />
              Vorabzug – Freischaltung erforderlich
            </div>
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

        {/* Preview / Download actions */}
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
            onClick={handleDownload}
            className="flex-1 h-12 rounded-2xl font-semibold gap-2 border-primary/30"
          >
            <Download className="w-4 h-4" />
            Herunterladen
          </Button>
        </motion.div>

        {!data.previewViewed && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="text-xs text-muted-foreground text-center"
          >
            Bitte öffnen Sie zuerst die Vorschau oder laden Sie das Dokument herunter, um fortzufahren.
          </motion.p>
        )}

        {/* Continue button – only after preview */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Button
            onClick={() => goToStepById('unlock')}
            disabled={!data.previewViewed}
            className="w-full h-14 rounded-2xl text-base font-semibold gap-2"
            size="lg"
          >
            <ArrowRight className="w-5 h-5" />
            Weiter zur Freischaltung
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
