import { motion } from 'framer-motion';
import {
  Zap, Leaf, TrendingDown, Euro, ArrowRight, FileText, CheckCircle2,
  PartyPopper, Info, Users, ExternalLink, Building2, Pencil, ShieldCheck,
  Home, Wifi, MapPin, Mail, Eye, Printer, X, CreditCard, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateMasterProtocolBlob } from '@/lib/pdfGenerator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ── PLZ → Grundversorger lookup ──
const GRUNDVERSORGER_DB: Record<string, { name: string; tarif: string; pricePerKwh: number; grundpreis: number }> = {
  '10': { name: 'Vattenfall Berlin', tarif: 'Basis', pricePerKwh: 0.3890, grundpreis: 148 },
  '20': { name: 'Vattenfall Hamburg', tarif: 'Basis', pricePerKwh: 0.3750, grundpreis: 142 },
  '22': { name: 'Vattenfall Hamburg', tarif: 'Basis', pricePerKwh: 0.3750, grundpreis: 142 },
  '30': { name: 'enercity Hannover', tarif: 'Basis', pricePerKwh: 0.3680, grundpreis: 139 },
  '40': { name: 'Stadtwerke Düsseldorf', tarif: 'Basis', pricePerKwh: 0.3720, grundpreis: 141 },
  '50': { name: 'RheinEnergie Köln', tarif: 'Basis', pricePerKwh: 0.3650, grundpreis: 138 },
  '60': { name: 'Mainova Frankfurt', tarif: 'Basis', pricePerKwh: 0.3810, grundpreis: 145 },
  '70': { name: 'EnBW Stuttgart', tarif: 'Basis', pricePerKwh: 0.3790, grundpreis: 144 },
  '80': { name: 'SWM München', tarif: 'Basis', pricePerKwh: 0.3850, grundpreis: 147 },
  '90': { name: 'N-ERGIE Nürnberg', tarif: 'Basis', pricePerKwh: 0.3710, grundpreis: 140 },
  '25': { name: 'Stadtwerke Heide', tarif: 'Basis', pricePerKwh: 0.3620, grundpreis: 136 },
  '01': { name: 'DREWAG Dresden', tarif: 'Basis', pricePerKwh: 0.3580, grundpreis: 135 },
  '04': { name: 'Stadtwerke Leipzig', tarif: 'Basis', pricePerKwh: 0.3640, grundpreis: 137 },
};

const CHECK24_BEST_PRICE_PER_KWH = 0.2890;
const CHECK24_BEST_GRUNDPREIS = 95;
const CHECK24_AFFILIATE_ID = 'ESTATETURN_PARTNER';

function extractPlz(address: string): string {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
}
function extractCity(address: string): string {
  const match = address.match(/\b\d{5}\s+([A-Za-zÄÖÜäöüß\s-]+)/);
  return match ? match[1].trim() : '';
}

function lookupGrundversorger(plz: string) {
  if (!plz) return null;
  const prefix2 = plz.substring(0, 2);
  if (GRUNDVERSORGER_DB[prefix2]) return GRUNDVERSORGER_DB[prefix2];
  return { name: 'Lokaler Grundversorger', tarif: 'Basis', pricePerKwh: 0.3700, grundpreis: 140 };
}

function estimateConsumption(rooms: number, persons: number): number {
  const baseByRooms: Record<number, number> = { 1: 1500, 2: 2000, 3: 2500, 4: 3500, 5: 4000 };
  const base = baseByRooms[Math.min(rooms, 5)] ?? 3500;
  const personFactor: Record<number, number> = { 1: 0.8, 2: 1.0, 3: 1.2, 4: 1.4, 5: 1.6 };
  const factor = personFactor[Math.min(persons, 5)] ?? 1.0;
  return Math.round(base * factor);
}

function getTodayFormatted(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
}

export const Step14Utility = () => {
  const { data, updateData, resetData, goToStepById } = useHandover();
  const { cancellationTarget, isSale, ownerRole, clientRole } = useTransactionLabels();
  const isMoveOut = data.handoverDirection === 'move-out';
  const isTenant = data.role === 'tenant';

  const [cancellation, setCancellation] = useState(false);
  const [dsgvoConsent, setDsgvoConsent] = useState(false);
  const [manualKwhEdit, setManualKwhEdit] = useState(false);
  const [manualKwh, setManualKwh] = useState<number | null>(null);
  const [nextAddress, setNextAddress] = useState(data.nextAddress || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewViewed, setPreviewViewed] = useState(data.previewViewed ?? false);
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const roomCount = data.rooms.length || 2;
  const [persons, setPersons] = useState(2);
  const stromMeter = data.meterReadings.find(m => m.medium === 'Strom');
  const plz = extractPlz(data.propertyAddress);
  const city = extractCity(data.propertyAddress) || 'Heide';
  const grundversorger = lookupGrundversorger(plz);
  const maloId = stromMeter?.maloId || '';

  const heuristicKwh = useMemo(() => estimateConsumption(roomCount, persons), [roomCount, persons]);
  const estimatedKwh = manualKwh ?? heuristicKwh;

  const grundversorgerJahr = grundversorger
    ? Math.round(grundversorger.grundpreis + estimatedKwh * grundversorger.pricePerKwh)
    : 0;
  const check24Jahr = Math.round(CHECK24_BEST_GRUNDPREIS + estimatedKwh * CHECK24_BEST_PRICE_PER_KWH);
  const ersparnis = grundversorgerJahr - check24Jahr;

  const todayFormatted = getTodayFormatted();
  const tenantName = data.tenantName || 'Mieter';
  const landlordName = data.landlordName || 'Vermieter';

  const isUnlocked = data.paymentStatus === 'paid' || data.serviceCheckStatus === 'completed';

  const recipientList = useMemo(() => {
    const list: { name: string; email: string }[] = [];
    if (data.tenantEmail) list.push({ name: data.tenantName || clientRole, email: data.tenantEmail });
    if (data.landlordEmail) list.push({ name: data.landlordName || ownerRole, email: data.landlordEmail });
    return list;
  }, [data.tenantEmail, data.tenantName, data.landlordEmail, data.landlordName, clientRole, ownerRole]);

  // Sync nextAddress to context
  useEffect(() => {
    if (nextAddress !== data.nextAddress) {
      updateData({ nextAddress });
    }
  }, [nextAddress]);

  const buildCheck24Link = () => {
    const params = new URLSearchParams({
      zipcode: plz || '25746',
      totalConsumption: String(estimatedKwh),
      affiliate_id: CHECK24_AFFILIATE_ID,
      partnerId: CHECK24_AFFILIATE_ID,
      meterNumber: stromMeter?.meterNumber || '',
      movingDate: todayFormatted,
    });
    if (city) params.set('city', city);
    if (maloId) params.set('maloId', maloId);
    if (data.tenantName) params.set('billing_name', data.tenantName);
    if (data.tenantEmail) params.set('customer_email', data.tenantEmail);
    if (data.tenantBirthday) params.set('birthdate', data.tenantBirthday);
    const billingAddr = data.nextAddress || data.propertyAddress;
    if (billingAddr) params.set('billing_address', billingAddr);
    return `https://www.check24.de/strom/vergleich/?${params.toString()}`;
  };

  const handleCancellation = () => {
    setCancellation(true);
    toast({
      title: '📄 Kündigung vorbereitet!',
      description: `Die Kündigung für ${cancellationTarget} wurde als PDF-Entwurf erstellt.`,
    });
  };

  // PDF Preview
  const handlePreview = useCallback(() => {
    try {
      updateData({ nextAddress });
      const blob = generateMasterProtocolBlob(data);
      const url = URL.createObjectURL(blob);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.open(url, '_blank');
        setPreviewViewed(true);
        updateData({ previewViewed: true });
        return;
      }
      setPreviewUrl(url);
      setPreviewViewed(true);
      updateData({ previewViewed: true });
    } catch {
      toast({ title: 'Fehler', description: 'PDF konnte nicht erstellt werden.', variant: 'destructive' });
    }
  }, [data, toast, updateData, nextAddress]);

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

  const handleServiceCheck = () => {
    const check24Url = buildCheck24Link();
    const check24Window = window.open(check24Url, '_blank');
    if (!check24Window) {
      window.location.href = check24Url;
      return;
    }
    setSending(true);
    setTimeout(() => {
      updateData({ serviceCheckStatus: 'completed', nextAddress });
      sendProtocol(recipientList);
      setSending(false);
    }, 1500);
  };

  const handlePaymentSelect = () => {
    setProcessing(true);
    setTimeout(() => {
      updateData({ paymentStatus: 'paid', nextAddress });
      setProcessing(false);
      sendProtocol(recipientList);
    }, 2000);
  };

  const handleContinue = () => {
    updateData({ nextAddress });
    goToStepById('unlock');
  };

  // For move-out: if already sent, show completion screen
  if (isMoveOut && data.protocolSent && isUnlocked) {
    return (
      <TooltipProvider>
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md glass-card-premium rounded-2xl p-6 text-center"
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
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-3">
            <MapPin className="w-3.5 h-3.5" />
            {isMoveOut ? 'Abschluss & Versorger-Service' : 'Versorger-Service & Adresse'}
          </div>
          <h2 className="text-2xl font-bold font-heading">
            {isMoveOut ? 'Übergabe abschließen' : 'Umzug abschließen'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isMoveOut
              ? 'Nachsendeadresse, Versorger & Protokoll-Versand'
              : 'Nachsendeadresse, Versorgerkündigung & neuer Tarif'}
          </p>
        </motion.div>

        <div className="w-full max-w-md space-y-4">

          {/* ── 1. Nachsendeadresse ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="glass-card-premium rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Home className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Neue Adresse von {tenantName}</h3>
                <p className="text-xs text-muted-foreground">Wird für Kautionsrückzahlung & Nachsendung übernommen</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Straße & Hausnummer, PLZ Ort</label>
              <Input
                value={nextAddress}
                onChange={e => setNextAddress(e.target.value)}
                placeholder="z. B. Musterstraße 12, 20095 Hamburg"
                className="rounded-xl bg-secondary/50 border-0 h-10 text-sm"
              />
            </div>

            {nextAddress && (
              <div className="bg-accent/10 rounded-xl p-3 flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-accent">Adresse übernommen</p>
                  <p className="text-muted-foreground mt-0.5">
                    Diese Adresse wird automatisch als Rücksendeadresse für die Kautionsrückzahlung im Zertifikat verwendet.
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* ── 2. Zähler-Zusammenfassung ── */}
          {data.meterReadings.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass-card-premium rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Erfasste Zählerstände</h3>
              </div>
              <div className="space-y-2">
                {data.meterReadings.map(m => (
                  <div key={m.id} className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{m.medium}</span>
                      {m.meterNumber && <span className="text-[10px] text-muted-foreground">Nr. {m.meterNumber}</span>}
                    </div>
                    <span className="text-sm font-bold text-primary">{m.reading} {m.unit}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl gap-1.5 text-xs h-10"
                  onClick={handleCancellation}
                  disabled={cancellation}
                >
                  <FileText className="w-4 h-4" />
                  {cancellation ? 'Vorbereitet ✓' : 'Kündigungsschreiben'}
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl gap-1.5 text-xs h-10" disabled>
                  <ExternalLink className="w-4 h-4" />
                  Online abmelden
                  <span className="text-[9px] text-muted-foreground">(bald)</span>
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── 3. Smart-Switch: Check24 Lead ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="glass-card-premium rounded-2xl p-5 border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Strom am alten Standort {city} abgemeldet</h3>
                <p className="text-xs text-muted-foreground">Zählerstand dokumentiert & verifiziert</p>
              </div>
            </div>

            <div className="bg-accent/10 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
              <span className="font-medium">Jetzt Strom für dein neues Zuhause sichern und bis zu <span className="text-accent font-bold">50 € Bonus</span> erhalten</span>
            </div>

            {/* Verbrauchsschätzung */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <label className="text-xs text-muted-foreground">Personenanzahl</label>
                </div>
                <span className="text-sm font-semibold">{persons}</span>
              </div>
              <Slider value={[persons]} onValueChange={([v]) => setPersons(v)} min={1} max={5} step={1} />

              <div className="bg-primary/10 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Jahresverbrauch</span>
                {manualKwhEdit ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="w-20 h-7 text-right text-sm font-bold"
                      value={manualKwh ?? heuristicKwh}
                      onChange={(e) => setManualKwh(Number(e.target.value) || null)}
                      onBlur={() => setManualKwhEdit(false)}
                      autoFocus
                    />
                    <span className="text-sm font-bold text-primary">kWh</span>
                  </div>
                ) : (
                  <button onClick={() => setManualKwhEdit(true)} className="flex items-center gap-1 group cursor-pointer">
                    <span className="text-lg font-bold text-primary">{estimatedKwh.toLocaleString('de-DE')} kWh</span>
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>

            {/* Tarifvergleich */}
            {grundversorger && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-secondary/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Grundversorger</p>
                  <p className="text-lg font-bold text-destructive">{grundversorgerJahr.toLocaleString('de-DE')} €<span className="text-xs font-normal text-muted-foreground">/J.</span></p>
                  <p className="text-[10px] text-muted-foreground">{grundversorger.name}</p>
                </div>
                <div className="bg-accent/10 rounded-xl p-3">
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-accent" />
                    <p className="text-xs text-muted-foreground">Check24 ab</p>
                  </div>
                  <p className="text-lg font-bold text-accent">{check24Jahr.toLocaleString('de-DE')} €<span className="text-xs font-normal text-muted-foreground">/J.</span></p>
                </div>
              </div>
            )}

            <div className="bg-accent/15 rounded-xl p-3 mb-4 text-center">
              <span className="text-xs text-muted-foreground">Jährliche Ersparnis</span>
              <p className="text-2xl font-bold text-accent">bis zu {ersparnis} €</p>
            </div>

            {/* DSGVO + CTA */}
            <div className="flex items-start gap-2.5 mb-3">
              <Checkbox
                id="dsgvo-check24"
                checked={dsgvoConsent}
                onCheckedChange={(v) => setDsgvoConsent(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="dsgvo-check24" className="text-[11px] text-muted-foreground leading-tight cursor-pointer">
                Ich stimme zu, dass meine Daten (PLZ {plz || '–'}, {estimatedKwh.toLocaleString('de-DE')} kWh, Zähler {stromMeter?.meterNumber || '–'}) zum Tarifvergleich an Check24 übertragen werden.
              </label>
            </div>

            {isMoveOut ? (
              /* Move-out: Check24 triggers protocol send */
              dsgvoConsent ? (
                <Button
                  onClick={handleServiceCheck}
                  disabled={sending}
                  className="w-full h-12 rounded-2xl font-semibold gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  size="lg"
                >
                  {sending ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" />
                      Wird verarbeitet…
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Tarifvergleich & kostenloses Protokoll
                      <ExternalLink className="w-4 h-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button disabled className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
                  <Zap className="w-5 h-5" />
                  Tarifvergleich & kostenloses Protokoll
                </Button>
              )
            ) : (
              /* Non-move-out: simple CTA */
              dsgvoConsent ? (
                <Button
                  onClick={() => {
                    updateData({ serviceCheckStatus: 'completed' });
                    toast({ title: '✅ Protokoll freigeschaltet', description: 'Ihr Protokoll ist jetzt ohne Wasserzeichen verfügbar.' });
                    window.open(buildCheck24Link(), '_blank');
                  }}
                  className="w-full h-12 rounded-2xl font-semibold gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  size="lg"
                >
                  <Zap className="w-5 h-5" />
                  Tarifvergleich & kostenloses Protokoll
                  <ExternalLink className="w-4 h-4" />
                </Button>
              ) : (
                <Button disabled className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
                  <Zap className="w-5 h-5" />
                  Tarifvergleich & kostenloses Protokoll
                </Button>
              )
            )}
          </motion.div>

          {/* ── Move-Out: PDF Preview & Protocol Send ── */}
          {isMoveOut && (
            <>
              {/* Preview Button */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Button
                  variant={previewViewed ? 'outline' : 'default'}
                  onClick={handlePreview}
                  className="w-full h-12 rounded-2xl font-semibold gap-2 border-primary/30"
                >
                  <Eye className="w-4 h-4" />
                  {previewViewed ? 'Vorschau erneut öffnen' : 'Protokoll-Vorschau öffnen (Pflicht)'}
                  {previewViewed && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </Button>
                {!previewViewed && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Bitte öffnen Sie zuerst die Vorschau, um fortzufahren.
                  </p>
                )}
              </motion.div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium">oder</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Payment fallback */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
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
            </>
          )}

          {/* ── Non-Move-Out: simple continue ── */}
          {!isMoveOut && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="pt-2">
              <Button onClick={handleContinue} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
                <ArrowRight className="w-4 h-4" />
                Weiter zur Freischaltung
              </Button>
            </motion.div>
          )}
        </div>

        {/* Payment processing overlay */}
        {processing && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin mb-3" />
            <p className="text-sm font-medium">Zahlung wird verarbeitet…</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default Step14Utility;
