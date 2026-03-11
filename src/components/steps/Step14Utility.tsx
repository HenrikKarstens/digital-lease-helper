import { motion } from 'framer-motion';
import {
  Zap, ArrowRight, FileText, CheckCircle2,
  Info, Building2, ShieldCheck,
  MapPin, Printer, X,
  AlertTriangle, Flame, Droplets
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateMasterProtocolBlob } from '@/lib/pdfGenerator';
import { ContractCancellationCard } from './ContractCancellationCard';
import { ElectricityCancellationModal } from './ElectricityCancellationModal';
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

function getMoveDateFormatted(): string {
  const d = new Date();
  // Next month 1st as default move-in date
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** Detect if heating/water are covered by landlord via Vorauszahlungen (§4/§7) */
function detectVorauszahlungen(data: { heatingCosts: string; nkAdvancePayment: string; deepLegalClauses: any[] }): { heatingViaLandlord: boolean; waterViaLandlord: boolean } {
  const hasHeatingVorauszahlung = parseFloat(data.heatingCosts) > 0;
  const hasNkVorauszahlung = parseFloat(data.nkAdvancePayment) > 0;

  // Check deep clauses for §4 / §7 mentioning Vorauszahlungen
  const clauseTexts = (data.deepLegalClauses || []).map(c =>
    `${c.paragraphRef} ${c.title} ${c.originalText}`.toLowerCase()
  );
  const mentionsVorauszahlung = clauseTexts.some(t =>
    (t.includes('§ 4') || t.includes('§ 7') || t.includes('§4') || t.includes('§7')) &&
    (t.includes('vorauszahlung') || t.includes('nebenkosten') || t.includes('betriebskosten'))
  );

  return {
    heatingViaLandlord: hasHeatingVorauszahlung || mentionsVorauszahlung,
    waterViaLandlord: hasNkVorauszahlung || mentionsVorauszahlung,
  };
}

export const Step14Utility = () => {
  const { data, updateData, resetData, goToStepById } = useHandover();
  const { cancellationTarget, isSale, ownerRole, clientRole } = useTransactionLabels();
  const isMoveOut = data.handoverDirection === 'move-out';

  const [providerInfoMap, setProviderInfoMap] = useState<Record<string, any>>({});
  const [reminderMap, setReminderMap] = useState<Record<string, boolean>>({});
  const [expandedCancellation, setExpandedCancellation] = useState<Record<string, boolean>>({});
  const [dsgvoConsent, setDsgvoConsent] = useState(false);
  const [manualKwhEdit, setManualKwhEdit] = useState(false);
  const [manualKwh, setManualKwh] = useState<number | null>(null);
  const [tenantRefusesAddress] = useState(data.tenantRefusesNewAddress ?? false);
  // Forwarding address fields (read-only, used for Check24 link)
  const streetNew = data.nextAddress?.split(',')[0]?.trim() || '';
  const plzCityNew = data.nextAddress?.split(',')[1]?.trim() || '';
  const [cancellationModalMeter, setCancellationModalMeter] = useState<typeof data.meterReadings[0] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewViewed, setPreviewViewed] = useState(data.previewViewed ?? false);
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const nextAddress = [streetNew, plzCityNew].filter(Boolean).join(', ');

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
  const moveDateFormatted = getMoveDateFormatted();
  const tenantName = data.tenantName || 'Mieter';
  const landlordName = data.landlordName || 'Vermieter';

  const isUnlocked = data.paymentStatus === 'paid' || data.serviceCheckStatus === 'completed';

  // Dynamic contract detection
  const { heatingViaLandlord, waterViaLandlord } = useMemo(
    () => detectVorauszahlungen(data),
    [data.heatingCosts, data.nkAdvancePayment, data.deepLegalClauses]
  );

  // Meters that need self-cancellation (only Strom if heating/water via landlord)
  const selfCancelMeters = useMemo(() => {
    return data.meterReadings.filter(m => {
      const medium = m.medium.toLowerCase();
      if ((medium.includes('heiz') || medium.includes('gas') || medium.includes('fernwärme') || medium.includes('wärme')) && heatingViaLandlord) return false;
      if (medium.includes('wasser') && waterViaLandlord) return false;
      return true;
    });
  }, [data.meterReadings, heatingViaLandlord, waterViaLandlord]);

  const landlordManagedMeters = useMemo(() => {
    return data.meterReadings.filter(m => {
      const medium = m.medium.toLowerCase();
      if ((medium.includes('heiz') || medium.includes('gas') || medium.includes('fernwärme') || medium.includes('wärme')) && heatingViaLandlord) return true;
      if (medium.includes('wasser') && waterViaLandlord) return true;
      return false;
    });
  }, [data.meterReadings, heatingViaLandlord, waterViaLandlord]);

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

  const newPlz = extractPlz(plzCityNew);
  const newCity = extractCity(plzCityNew);

  const buildCheck24Link = () => {
    const targetPlz = newPlz || plz || '25746';
    const targetCity = newCity || city;
    const params = new URLSearchParams({
      zipcode: targetPlz,
      totalConsumption: String(estimatedKwh),
      affiliate_id: CHECK24_AFFILIATE_ID,
      partnerId: CHECK24_AFFILIATE_ID,
      meterNumber: stromMeter?.meterNumber || '',
      movingDate: moveDateFormatted,
    });
    if (targetCity) params.set('city', targetCity);
    if (maloId) params.set('maloId', maloId);
    if (data.tenantName) params.set('billing_name', data.tenantName);
    if (data.tenantEmail) params.set('customer_email', data.tenantEmail);
    if (data.tenantBirthday) params.set('birthdate', data.tenantBirthday);
    if (nextAddress) params.set('billing_address', nextAddress);
    if (streetNew) params.set('delivery_street', streetNew);
    if (plzCityNew) params.set('delivery_zipcode_city', plzCityNew);
    return `https://www.check24.de/strom/vergleich/?${params.toString()}`;
  };

  const handleProviderInfoSaved = useCallback((meterId: string, info: any) => {
    setProviderInfoMap(prev => ({ ...prev, [meterId]: info }));
  }, []);

  const handleReminderSet = useCallback((meterId: string, enabled: boolean) => {
    setReminderMap(prev => ({ ...prev, [meterId]: enabled }));
  }, []);

  const allMetersHandled = selfCancelMeters.length > 0 && selfCancelMeters.every(
    m => providerInfoMap[m.id] || reminderMap[m.id]
  );

  // PDF Preview
  const handlePreview = useCallback(() => {
    try {
      updateData({ nextAddress });
      const blob = generateMasterProtocolBlob(data);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
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


  // For move-out: if already sent, skip to unlock
  useEffect(() => {
    if (isMoveOut && data.protocolSent && isUnlocked) {
      goToStepById('unlock');
    }
  }, [isMoveOut, data.protocolSent, isUnlocked, goToStepById]);

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
            Versorger-Management
          </div>
          <h2 className="text-2xl font-bold font-heading">
            Versorger-Bewertung
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Zähler-Kündigung & neuer Tarif
          </p>
        </motion.div>

        <div className="w-full max-w-md space-y-4">

          {/* ── Zähler-Übersicht: Unified card ── */}
          {data.meterReadings.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
              className="glass-card-premium rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Versorger-Bewertung je Zähler</h3>
                  <p className="text-xs text-muted-foreground">Automatische Analyse auf Basis Ihres Mietvertrags</p>
                </div>
              </div>

              <div className="space-y-3">
                {data.meterReadings.map(m => {
                  const medium = m.medium.toLowerCase();
                  const isLandlordManaged =
                    ((medium.includes('heiz') || medium.includes('gas') || medium.includes('fernwärme') || medium.includes('wärme')) && heatingViaLandlord) ||
                    (medium.includes('wasser') && waterViaLandlord);

                  const icon = medium.includes('strom')
                    ? <Zap className="w-4 h-4 text-amber-500" />
                    : (medium.includes('heiz') || medium.includes('gas') || medium.includes('fernwärme') || medium.includes('wärme'))
                      ? <Flame className="w-4 h-4 text-orange-500" />
                      : <Droplets className="w-4 h-4 text-blue-500" />;

                  const isExpanded = expandedCancellation[m.id] ?? false;
                  const isHandled = providerInfoMap[m.id] || reminderMap[m.id];

                  return (
                    <div key={m.id} className="rounded-xl border border-border bg-card overflow-hidden">
                      {/* Meter row */}
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {icon}
                          <div>
                            <span className="text-xs font-semibold">{m.medium}</span>
                            <div className="flex items-center gap-1.5">
                              {m.meterNumber && <span className="text-[10px] text-muted-foreground">Nr. {m.meterNumber}</span>}
                              {m.maloId && <span className="text-[10px] text-muted-foreground">· MaLo {m.maloId}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-bold text-primary">{m.reading} {m.unit}</span>
                          {isLandlordManaged ? (
                            <span className="text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5" />
                              Keine Eigenkündigung
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Eigenkündigung nötig
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Landlord-managed info */}
                      {isLandlordManaged && (
                        <div className="px-3 pb-3">
                          <div className="bg-blue-500/5 rounded-lg p-2.5 flex items-start gap-2 text-[10px] text-muted-foreground">
                            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <span>
                              Wird über {landlordName} per Vorauszahlung abgerechnet (§§ 4, 7).
                              {m.medium.toLowerCase().includes('heiz') || m.medium.toLowerCase().includes('gas')
                                ? data.heatingCosts ? ` Heizung: ${data.heatingCosts} €/Monat` : ''
                                : data.nkAdvancePayment ? ` NK: ${data.nkAdvancePayment} €/Monat` : ''
                              }
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Self-cancellation action */}
                      {!isLandlordManaged && data.role !== 'landlord' && (
                        <div className="px-3 pb-3">
                          {!isExpanded && !isHandled && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full rounded-xl gap-2 text-xs h-9 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                              onClick={() => setExpandedCancellation(prev => ({ ...prev, [m.id]: true }))}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Eigenkündigung durchführen
                            </Button>
                          )}

                          {isExpanded && !isHandled && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                              <ContractCancellationCard
                                meter={m}
                                tenantEmail={data.tenantEmail || ''}
                                tenantName={data.tenantName || 'Mieter'}
                                onProviderInfoSaved={handleProviderInfoSaved}
                                onReminderSet={handleReminderSet}
                              />
                            </motion.div>
                          )}

                          {isHandled && (
                            <div className="bg-accent/10 rounded-lg p-2.5 flex items-center gap-2 text-[10px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                              <span className="font-medium text-accent">
                                {providerInfoMap[m.id] ? `${providerInfoMap[m.id].providerName || 'Versorger'} – Daten erfasst` : 'Erinnerung aktiviert'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary when all handled */}
              {selfCancelMeters.length > 0 && allMetersHandled && (
                <div className="bg-accent/10 rounded-xl p-3 flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span className="font-medium text-accent">Alle Versorger-Verträge bearbeitet</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Move-Out: Weiter zum Abschluss ── */}
          {isMoveOut && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="pt-2">
              <Button
                onClick={() => goToStepById('unlock')}
                className="w-full h-12 rounded-2xl font-semibold gap-2"
                size="lg"
              >
                <ArrowRight className="w-4 h-4" />
                Weiter zum Abschluss des Protokolls
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
