import { motion } from 'framer-motion';
import { useState, useMemo, useCallback } from 'react';
import {
  CreditCard, Zap, Shield, CheckCircle2, Mail, ExternalLink, TrendingDown,
  Eye, FileText, Printer, X, Users, Euro, Leaf, Building2, Pencil, Info,
  PartyPopper
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
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
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}.${m}.${y}`;
}

export const Step12Unlock = () => {
  const { data, updateData, resetData } = useHandover();
  const { ownerRole, clientRole } = useTransactionLabels();
  const { toast } = useToast();

  const [processing, setProcessing] = useState(false);
  const [dsgvoConsent, setDsgvoConsent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewViewed, setPreviewViewed] = useState(data.previewViewed ?? false);
  const [sending, setSending] = useState(false);
  const [persons, setPersons] = useState(2);
  const [manualKwhEdit, setManualKwhEdit] = useState(false);
  const [manualKwh, setManualKwh] = useState<number | null>(null);

  const isUnlocked = data.paymentStatus === 'paid' || data.serviceCheckStatus === 'completed';
  const plz = extractPlz(data.propertyAddress);
  const grundversorger = lookupGrundversorger(plz);
  const stromMeter = data.meterReadings.find(m => m.medium === 'Strom');
  const roomCount = data.rooms.length || 2;
  const todayFormatted = getTodayFormatted();

  const heuristicKwh = useMemo(() => estimateConsumption(roomCount, persons), [roomCount, persons]);
  const estimatedKwh = manualKwh ?? heuristicKwh;

  const grundversorgerJahr = grundversorger
    ? Math.round(grundversorger.grundpreis + estimatedKwh * grundversorger.pricePerKwh)
    : 0;
  const check24Jahr = Math.round(CHECK24_BEST_GRUNDPREIS + estimatedKwh * CHECK24_BEST_PRICE_PER_KWH);
  const ersparnis = grundversorgerJahr - check24Jahr;

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
      zipcode: plz || '25746',
      totalConsumption: String(estimatedKwh),
      affiliate_id: CHECK24_AFFILIATE_ID,
      partnerId: CHECK24_AFFILIATE_ID,
      movingDate: todayFormatted,
    });
    if (stromMeter?.meterNumber) params.set('meterNumber', stromMeter.meterNumber);
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

  // Service-check flow: direct send + redirect
  const handleServiceCheck = () => {
    // Open Check24 immediately on user gesture to avoid mobile popup blockers
    const check24Url = buildCheck24Link();
    const check24Window = window.open(check24Url, '_blank');
    
    // If popup was blocked, fall back to direct navigation
    if (!check24Window) {
      window.location.href = check24Url;
      return;
    }

    setSending(true);
    setTimeout(() => {
      updateData({ serviceCheckStatus: 'completed' });
      sendProtocol(recipientList);
      setSending(false);
    }, 1500);
  };

  // Payment flow
  const handlePaymentSelect = () => {
    setProcessing(true);
    setTimeout(() => {
      updateData({ paymentStatus: 'paid' });
      setProcessing(false);
      sendProtocol(recipientList);
    }, 2000);
  };

  // Already sent state
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

          {/* ── Verbrauchsschätzung ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm">Verbrauchsschätzung</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="ml-auto">
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[260px] text-xs">
                  Schätzung basiert auf {roomCount} Zimmer{roomCount !== 1 ? 'n' : ''} / {persons} Person{persons !== 1 ? 'en' : ''}.
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">Personenanzahl</label>
                  <span className="text-sm font-semibold">{persons} Person{persons !== 1 ? 'en' : ''}</span>
                </div>
                <Slider value={[persons]} onValueChange={([v]) => setPersons(v)} min={1} max={5} step={1} />
              </div>

              <div className="bg-primary/10 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Prognostizierter Jahresverbrauch</span>
                {manualKwhEdit ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="w-24 h-8 text-right text-sm font-bold"
                      value={manualKwh ?? heuristicKwh}
                      onChange={(e) => setManualKwh(Number(e.target.value) || null)}
                      onBlur={() => setManualKwhEdit(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setManualKwhEdit(false)}
                      autoFocus
                    />
                    <span className="text-sm font-bold text-primary">kWh</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setManualKwhEdit(true)}
                    className="flex items-center gap-1.5 group cursor-pointer"
                    title="Klicken zum manuellen Überschreiben"
                  >
                    <span className="text-lg font-bold text-primary">{estimatedKwh.toLocaleString('de-DE')} kWh</span>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
              {manualKwh !== null && (
                <button
                  onClick={() => { setManualKwh(null); setManualKwhEdit(false); }}
                  className="text-[10px] text-primary underline cursor-pointer"
                >
                  Zurück zur Schätzung ({heuristicKwh.toLocaleString('de-DE')} kWh)
                </button>
              )}
            </div>
          </motion.div>

          {/* ── Tarifvergleich & kostenfreies Gutachten ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="glass-card rounded-2xl p-5 border-2 border-success/30 bg-gradient-to-br from-success/5 to-transparent"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Tarifvergleich & kostenfreies Gutachten</h3>
                <p className="text-xs text-muted-foreground">Check24 vs. Grundversorger</p>
              </div>
            </div>

            {grundversorger && (
              <div className="bg-background/60 rounded-xl p-3 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="text-xs">
                  <p className="text-muted-foreground">Ihr Grundversorger{plz ? ` (PLZ ${plz})` : ''}</p>
                  <p className="font-semibold">{grundversorger.name} – {grundversorger.tarif}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-background/60 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Grundversorger</p>
                <p className="text-lg font-bold text-destructive">{grundversorgerJahr.toLocaleString('de-DE')} €<span className="text-xs font-normal text-muted-foreground">/Jahr</span></p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{(grundversorger?.pricePerKwh ?? 0).toFixed(2).replace('.', ',')} ct/kWh</p>
              </div>
              <div className="bg-success/10 rounded-xl p-3">
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4 text-success" />
                  <p className="text-xs text-muted-foreground">Check24 ab</p>
                </div>
                <p className="text-lg font-bold text-success">{check24Jahr.toLocaleString('de-DE')} €<span className="text-xs font-normal text-muted-foreground">/Jahr</span></p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{CHECK24_BEST_PRICE_PER_KWH.toFixed(2).replace('.', ',')} ct/kWh</p>
              </div>
            </div>

            <div className="bg-success/15 rounded-xl p-3 mb-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Euro className="w-4 h-4 text-success" />
                <span className="text-xs text-muted-foreground">Ihre jährliche Ersparnis</span>
              </div>
              <p className="text-2xl font-bold text-success">bis zu {ersparnis} €</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                gegenüber {grundversorger?.name || 'Grundversorger'}
              </p>
            </div>

            {/* DSGVO consent */}
            <div className="flex items-start gap-2.5 mb-3">
              <Checkbox
                id="dsgvo-unlock"
                checked={dsgvoConsent}
                onCheckedChange={(v) => setDsgvoConsent(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="dsgvo-unlock" className="text-[11px] text-muted-foreground leading-tight cursor-pointer">
                Ich stimme zu, dass meine Daten (PLZ <span className="font-semibold text-foreground">{plz || '–'}</span>, geschätzter Verbrauch <span className="font-semibold text-foreground">{estimatedKwh.toLocaleString('de-DE')} kWh</span>, Zählernummer <span className="font-semibold text-foreground">{stromMeter?.meterNumber || '–'}</span>) zum Zwecke des Tarifvergleichs an Check24 übertragen werden.{' '}
                <a href="/datenschutz" className="underline text-primary">Datenschutzerklärung</a>.
              </label>
            </div>

            {/* Main CTA */}
            {dsgvoConsent ? (
              <Button
                onClick={handleServiceCheck}
                disabled={sending}
                className="w-full h-12 rounded-2xl font-semibold gap-2 bg-[#00893e] hover:bg-[#006e32] text-white"
                size="lg"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
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
            )}

            <p className="text-[10px] text-muted-foreground text-center mt-2">
              PLZ {plz || '–'} · {estimatedKwh.toLocaleString('de-DE')} kWh · Zähler: {stromMeter?.meterNumber || '–'} · Umzug: {todayFormatted}
            </p>
          </motion.div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">oder</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Payment fallback */}
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
    </TooltipProvider>
  );
};
