import { motion } from 'framer-motion';
import { Home, Info, AlertTriangle, ArrowRight } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useState, useEffect } from 'react';

export const StepForwardingAddress = () => {
  const { data, updateData, goToStepById } = useHandover();

  const [tenantNameLocal, setTenantNameLocal] = useState(data.tenantName || '');
  const [streetNew, setStreetNew] = useState(data.nextAddress?.split(',')[0]?.trim() || '');
  const [plzCityNew, setPlzCityNew] = useState(data.nextAddress?.split(',')[1]?.trim() || '');
  const [tenantRefusesAddress, setTenantRefusesAddress] = useState(data.tenantRefusesNewAddress ?? false);
  const [showAddressWarning, setShowAddressWarning] = useState(false);

  const nextAddress = [streetNew, plzCityNew].filter(Boolean).join(', ');

  // Sync to context
  useEffect(() => {
    if (nextAddress !== data.nextAddress) {
      updateData({ nextAddress });
    }
  }, [nextAddress]);

  useEffect(() => {
    if (tenantNameLocal && tenantNameLocal !== data.tenantName) {
      updateData({ tenantName: tenantNameLocal });
    }
  }, [tenantNameLocal]);

  const handleContinue = () => {
    if (!nextAddress && !tenantRefusesAddress) {
      setShowAddressWarning(true);
      return;
    }
    updateData({ nextAddress, tenantRefusesNewAddress: tenantRefusesAddress });
    goToStepById('utility');
  };

  const handleAddressRefusalConfirm = () => {
    setTenantRefusesAddress(true);
    setShowAddressWarning(false);
    updateData({ nextAddress: '', tenantRefusesNewAddress: true });
    goToStepById('utility');
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-3">
          <Home className="w-3.5 h-3.5" />
          Nachsendeadresse
        </div>
        <h2 className="text-2xl font-bold font-heading">
          Neue Anschrift des Mieters
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Zustelladresse für Betriebskostenabrechnung & Kautionsrückzahlung
        </p>
      </motion.div>

      <div className="w-full max-w-md space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card-premium rounded-2xl p-5 space-y-4"
        >
          {/* Legal context */}
          <div className="bg-primary/5 rounded-xl p-3 space-y-2 text-[10px] text-muted-foreground">
            <div className="flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p>
                  <strong className="text-foreground">§ 259 BGB – Rechenschaftspflicht:</strong> Der Mieter ist verpflichtet, nach Beendigung des Mietverhältnisses eine zustellfähige Anschrift mitzuteilen (Betriebskostenabrechnung, Kautionsrückzahlung).
                </p>
                <p>
                  <strong className="text-foreground">§ 242 BGB – Treu und Glauben:</strong> Die Verweigerung einer Zustelladresse kann als treuwidrig gewertet werden.
                </p>
                <p>
                  <strong className="text-foreground">BGH VIII ZR 291/16:</strong> Ohne zustellfähige Adresse ist der Vermieter berechtigt, die Kaution bis zur Klärung zurückzubehalten.
                </p>
              </div>
            </div>
          </div>

          {!tenantRefusesAddress ? (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">Name des Mieters</label>
                <Input
                  value={tenantNameLocal}
                  onChange={e => setTenantNameLocal(e.target.value)}
                  placeholder="Name des Mieters"
                  className="rounded-xl h-9 text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Aus Vertragsdaten übernommen – änderbar</p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">Neue Straße & Hausnummer</label>
                <Input
                  value={streetNew}
                  onChange={e => setStreetNew(e.target.value)}
                  placeholder="z. B. Musterstraße 12"
                  className="rounded-xl h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">PLZ & Ort</label>
                <Input
                  value={plzCityNew}
                  onChange={e => setPlzCityNew(e.target.value)}
                  placeholder="z. B. 10115 Berlin"
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              {/* Refusal option */}
              <div className="flex items-start gap-3 bg-secondary/30 rounded-xl p-3 mt-2">
                <Checkbox
                  id="refuse-address"
                  checked={tenantRefusesAddress}
                  onCheckedChange={(checked) => {
                    const val = checked === true;
                    setTenantRefusesAddress(val);
                    if (val) {
                      updateData({ tenantRefusesNewAddress: true, nextAddress: '' });
                      setStreetNew('');
                      setPlzCityNew('');
                    } else {
                      updateData({ tenantRefusesNewAddress: false });
                    }
                  }}
                  className="mt-0.5"
                />
                <label htmlFor="refuse-address" className="cursor-pointer space-y-0.5">
                  <p className="text-xs font-medium">Mieter gibt neue Adresse nicht an</p>
                  <p className="text-[10px] text-muted-foreground">
                    Wird im Protokoll dokumentiert – Zurückbehaltungsrecht des Vermieters greift (§ 273 BGB)
                  </p>
                </label>
              </div>
            </div>
          ) : (
            <div className="bg-warning/10 rounded-xl p-3 border border-warning/20 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-warning">
                <AlertTriangle className="w-4 h-4" />
                Adressverweigerung dokumentiert
              </div>
              <p className="text-[10px] text-muted-foreground">
                Der Mieter hat die Angabe einer neuen Zustelladresse verweigert. Dies wird im Übergabeprotokoll festgehalten. Dem Vermieter stehen erweiterte Zurückbehaltungsrechte an der Kaution zu (BGH VIII ZR 291/16).
              </p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs h-8"
                onClick={() => {
                  setTenantRefusesAddress(false);
                  updateData({ tenantRefusesNewAddress: false });
                }}
              >
                Doch Adresse eingeben
              </Button>
            </div>
          )}
        </motion.div>

        {/* Continue button */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="pt-2">
          <Button
            onClick={handleContinue}
            className="w-full h-12 rounded-2xl font-semibold gap-2"
            size="lg"
          >
            <ArrowRight className="w-4 h-4" />
            Weiter zur Versorger-Bewertung
          </Button>
        </motion.div>
      </div>

      {/* Address warning AlertDialog */}
      <AlertDialog open={showAddressWarning} onOpenChange={setShowAddressWarning}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              Keine Nachsendeadresse hinterlegt
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Der Mieter hat keine neue Zustelladresse angegeben.</strong> Dies hat erhebliche rechtliche Konsequenzen:
                </p>
                <ul className="list-disc pl-4 space-y-1.5 text-xs">
                  <li>
                    <strong>§ 259 BGB (Rechenschaftspflicht):</strong> Der Mieter ist nach Beendigung des Mietverhältnisses verpflichtet, eine zustellfähige Anschrift mitzuteilen.
                  </li>
                  <li>
                    <strong>§ 242 BGB (Treu und Glauben):</strong> Die Verweigerung verstößt gegen den Grundsatz von Treu und Glauben.
                  </li>
                  <li>
                    <strong>BGH VIII ZR 291/16:</strong> Der Vermieter ist berechtigt, die Kaution bis zur Klärung zurückzubehalten.
                  </li>
                  <li>
                    <strong>Zustellungsfiktion (§ 132 BGB):</strong> Ohne bekannte Adresse kann die Betriebskostenabrechnung nicht wirksam zugestellt werden.
                  </li>
                </ul>
                <p className="text-xs font-medium text-foreground bg-warning/10 rounded-lg p-2.5 border border-warning/20">
                  ⚠️ Bei Verweigerung wird dies im Übergabeprotokoll dokumentiert. Dem Vermieter stehen erweiterte Zurückbehaltungsrechte an der Kaution zu.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Zurück – Adresse eingeben</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAddressRefusalConfirm}
              className="rounded-xl bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Trotzdem fortfahren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StepForwardingAddress;
