import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Shield, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface GeoPermissionGuardProps {
  open: boolean;
  propertyAddress: string;
  onGranted: () => void;
  onDenied: () => void;
}

export const GeoPermissionGuard = ({ open, propertyAddress, onGranted, onDenied }: GeoPermissionGuardProps) => {
  const [showDsgvo, setShowDsgvo] = useState(false);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border"
        >
          {/* Header */}
          <div className="bg-primary/5 px-6 pt-6 pb-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Rechtssicherheit aktivieren</h3>
              <p className="text-xs text-muted-foreground">Manipulationssichere Beweissicherung</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {!showDsgvo ? (
              <>
                <div className="flex items-start gap-3 bg-secondary/40 rounded-2xl p-4">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground leading-relaxed">
                    Um dieses Protokoll für die <span className="font-semibold">{propertyAddress || 'Immobilie'}</span> manipulationssicher
                    zu versiegeln, erfassen wir bei jedem Foto automatisch den exakten <span className="font-semibold">GPS-Standort</span> und <span className="font-semibold">Zeitstempel</span>.
                  </p>
                </div>

                <div className="text-xs text-muted-foreground space-y-1.5 px-1">
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    Jedes Foto wird mit GPS-Koordinaten verknüpft
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    Geofencing verifiziert die Aufnahme am Objekt (100m Radius)
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    Zeitstempel und Koordinaten fließen in die SHA-256 Versiegelung ein
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button onClick={onGranted} className="w-full h-12 rounded-2xl font-semibold gap-2 text-sm">
                    <MapPin className="w-4 h-4" />
                    Standort freigeben
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowDsgvo(true)}
                    className="w-full h-10 rounded-xl text-xs text-muted-foreground gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Mehr Infos (DSGVO)
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-secondary/40 rounded-2xl p-4 space-y-3 max-h-[50vh] overflow-y-auto">
                  <h4 className="font-semibold text-sm text-foreground">Datenschutzhinweis (DSGVO)</h4>
                  <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                    <p><span className="font-semibold text-foreground">Verantwortlicher:</span> EstateTurn GmbH</p>
                    <p><span className="font-semibold text-foreground">Zweck:</span> Die GPS-Koordinaten und Zeitstempel werden ausschließlich zur forensischen Beweissicherung im Rahmen der Wohnungsübergabe erhoben (Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse).</p>
                    <p><span className="font-semibold text-foreground">Datenumfang:</span> Breitengrad, Längengrad, Genauigkeit (in Metern), Zeitstempel (ISO 8601). Es werden keine Bewegungsprofile erstellt.</p>
                    <p><span className="font-semibold text-foreground">Speicherung:</span> Die Geodaten werden lokal auf Ihrem Gerät gespeichert und nur in das PDF-Protokoll eingebettet. Eine serverseitige Speicherung erfolgt nur bei expliziter Projektanlage.</p>
                    <p><span className="font-semibold text-foreground">Löschung:</span> Mit Löschung des Projekts werden alle Geodaten unwiderruflich gelöscht.</p>
                    <p><span className="font-semibold text-foreground">Widerruf:</span> Sie können die Standortfreigabe jederzeit in Ihren Browsereinstellungen widerrufen. Dies schränkt die Beweiskraft des Protokolls ein.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <Button onClick={onGranted} className="w-full h-12 rounded-2xl font-semibold gap-2 text-sm">
                    <MapPin className="w-4 h-4" />
                    Standort freigeben
                  </Button>
                  <Button variant="ghost" onClick={() => setShowDsgvo(false)} className="w-full h-10 rounded-xl text-xs text-muted-foreground">
                    ← Zurück
                  </Button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
