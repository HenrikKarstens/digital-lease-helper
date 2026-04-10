import { motion } from 'framer-motion';
import { useState, useCallback } from 'react';
import { CheckCircle2, MapPin, Key, Gauge, Users, Camera, FileText, Eye, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useToast } from '@/hooks/use-toast';
import { generateMasterProtocolBlob } from '@/lib/pdfGenerator';
import { PdfPreviewModal } from '@/components/pdf/PdfPreviewModal';

export const Step10DataComplete = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { ownerRole, clientRole } = useTransactionLabels();
  const { toast } = useToast();
   const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const address = data.propertyAddress || 'Ihr Objekt';
  const addressShort = address;

  const landlordName = data.landlordName || ownerRole;
  const tenantName = data.tenantName || clientRole;

  const keyCount = data.keyEntries.reduce((s, k) => s + k.count, 0);
  const meterTypes = data.meterReadings.map(m => m.medium).filter(Boolean);
  const uniqueMeters = [...new Set(meterTypes)];
  const participantCount = data.participants.filter(p => p.present).length;

  const handlePreview = useCallback(async () => {
    try {
      setPreviewBlob(generateMasterProtocolBlob(data));
      updateData({ previewViewed: true });
    } catch (e) {
      toast({ title: 'Fehler', description: 'PDF konnte nicht erstellt werden.', variant: 'destructive' });
    }
  }, [data, toast, updateData]);

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

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
      <PdfPreviewModal
        pdfBlob={previewBlob}
        title="Protokoll-Vorschau"
        badgeText="VORABZUG"
        watermarkText="VORABZUG – Kein Original"
        onPrint={handlePrint}
        onClose={closePreview}
      />

      {/* Success icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"
      >
        <CheckCircle2 className="w-9 h-9 text-primary" />
      </motion.div>

      <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="text-2xl font-bold text-center mb-1"
      >
        Daten vollständig erfasst
      </motion.h2>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="flex items-center gap-1.5 text-muted-foreground text-sm mb-6"
      >
        <MapPin className="w-4 h-4" />
        <span>{addressShort}</span>
      </motion.div>

      {/* Dynamic summary card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="w-full max-w-md glass-card rounded-2xl p-5 mb-6"
      >
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Zusammenfassung
        </h3>

        {/* Participants */}
        <div className="bg-secondary/30 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Teilnehmer ({participantCount} anwesend)</p>
            </div>
          </div>
          <div className="ml-[42px] space-y-1 text-sm">
            <p><span className="text-muted-foreground">Mieter:</span> <span className="font-medium">{tenantName}</span></p>
            <p><span className="text-muted-foreground">Vermieter:</span> <span className="font-medium">{landlordName}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Keys */}
          <div className="bg-secondary/30 rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Key className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Schlüssel</p>
              <p className="text-sm font-semibold">{keyCount} Stück</p>
            </div>
          </div>

          {/* Meters */}
          <div className="bg-secondary/30 rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Gauge className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Zähler</p>
              <p className="text-sm font-semibold">{uniqueMeters.length > 0 ? uniqueMeters.join(', ') : `${data.meterReadings.length} erfasst`}</p>
            </div>
          </div>

          {/* Findings */}
          <div className="bg-secondary/30 rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Befunde</p>
              <p className="text-sm font-semibold">{data.findings.length} dokumentiert</p>
            </div>
          </div>

          {/* Signatures */}
          <div className="bg-secondary/30 rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unterschriften</p>
              <p className="text-sm font-semibold">{(data.signatureLandlord ? 1 : 0) + (data.signatureTenant ? 1 : 0)}/2</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="text-xs text-muted-foreground text-center max-w-sm mb-4"
      >
        Prüfen Sie das Protokoll in der Vorschau (mit Wasserzeichen). Im nächsten Schritt können Sie es freischalten und versenden.
      </motion.p>

      {/* Preview / Download actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
        className="w-full max-w-md mb-4"
      >
        <Button variant="outline" onClick={handlePreview} className="w-full h-12 rounded-2xl font-semibold gap-2 border-primary/30">
          <Eye className="w-4 h-4" />
          Vorschau öffnen
        </Button>
      </motion.div>

      {!data.previewViewed && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-xs text-muted-foreground text-center mb-4"
        >
          Bitte öffnen Sie zuerst die Vorschau, um fortzufahren.
        </motion.p>
      )}

      {/* Continue – only after preview */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="w-full max-w-md"
      >
        <Button
          onClick={() => goToStepById('unlock')}
          disabled={!data.previewViewed}
          className="w-full h-14 rounded-2xl text-base font-semibold gap-2"
          size="lg"
        >
          <ArrowRight className="w-5 h-5" />
          Übergabe finalisieren
        </Button>
      </motion.div>
    </div>
  );
};
