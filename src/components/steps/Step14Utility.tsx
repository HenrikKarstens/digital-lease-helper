import { motion } from 'framer-motion';
import {
  Zap, Leaf, TrendingDown, Euro, ArrowRight, FileText, CheckCircle2,
  PartyPopper, Info, Users, ExternalLink, Building2, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ── PLZ → Grundversorger lookup (top cities) ──
const GRUNDVERSORGER_DB: Record<string, { name: string; pricePerKwh: number; grundpreis: number }> = {
  '10': { name: 'Vattenfall Berlin', pricePerKwh: 0.3890, grundpreis: 148 },
  '20': { name: 'Vattenfall Hamburg', pricePerKwh: 0.3750, grundpreis: 142 },
  '22': { name: 'Vattenfall Hamburg', pricePerKwh: 0.3750, grundpreis: 142 },
  '30': { name: 'enercity Hannover', pricePerKwh: 0.3680, grundpreis: 139 },
  '40': { name: 'Stadtwerke Düsseldorf', pricePerKwh: 0.3720, grundpreis: 141 },
  '50': { name: 'RheinEnergie Köln', pricePerKwh: 0.3650, grundpreis: 138 },
  '60': { name: 'Mainova Frankfurt', pricePerKwh: 0.3810, grundpreis: 145 },
  '70': { name: 'EnBW Stuttgart', pricePerKwh: 0.3790, grundpreis: 144 },
  '80': { name: 'SWM München', pricePerKwh: 0.3850, grundpreis: 147 },
  '90': { name: 'N-ERGIE Nürnberg', pricePerKwh: 0.3710, grundpreis: 140 },
  '25': { name: 'Stadtwerke Heide', pricePerKwh: 0.3620, grundpreis: 136 },
  '01': { name: 'DREWAG Dresden', pricePerKwh: 0.3580, grundpreis: 135 },
  '04': { name: 'Stadtwerke Leipzig', pricePerKwh: 0.3640, grundpreis: 137 },
};

// Check24 competitor tariff simulation (cheapest)
const CHECK24_BEST_PRICE_PER_KWH = 0.2890;
const CHECK24_BEST_GRUNDPREIS = 95;
const CHECK24_AFFILIATE_ID = 'ESTATETURN_PARTNER'; // Platzhalter für Partner-ID

function extractPlz(address: string): string {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
}

function lookupGrundversorger(plz: string) {
  if (!plz) return null;
  // Try 2-digit prefix
  const prefix2 = plz.substring(0, 2);
  if (GRUNDVERSORGER_DB[prefix2]) return GRUNDVERSORGER_DB[prefix2];
  // Fallback: generic
  return { name: 'Lokaler Grundversorger', pricePerKwh: 0.3700, grundpreis: 140 };
}

function estimateConsumption(rooms: number, persons: number): number {
  // Base by rooms
  const baseByRooms: Record<number, number> = {
    1: 1500, 2: 2000, 3: 2500, 4: 3500, 5: 4000,
  };
  const base = baseByRooms[Math.min(rooms, 5)] ?? 3500;
  // Adjust by persons
  const personFactor: Record<number, number> = {
    1: 0.8, 2: 1.0, 3: 1.2, 4: 1.4, 5: 1.6,
  };
  const factor = personFactor[Math.min(persons, 5)] ?? 1.0;
  return Math.round(base * factor);
}

export const Step14Utility = () => {
  const { data, resetData } = useHandover();
  const { cancellationTarget, isMoveIn, isSale } = useTransactionLabels();
  const showCheck24 = isMoveIn || isSale; // Check24 for move-in and sale (new occupant)
  const showCancellation = !isMoveIn && !isSale; // Cancellation only for rental move-out
  const [cancellation, setCancellation] = useState(false);
  const [dsgvoConsent, setDsgvoConsent] = useState(false);
  const [manualKwhEdit, setManualKwhEdit] = useState(false);
  const [manualKwh, setManualKwh] = useState<number | null>(null);
  const { toast } = useToast();

  // Room count from context
  const roomCount = data.rooms.length || 2;
  const [persons, setPersons] = useState(2);

  // Meter data
  const stromMeter = data.meterReadings.find(m => m.medium === 'Strom');

  // PLZ & Grundversorger
  const plz = extractPlz(data.propertyAddress);
  const grundversorger = lookupGrundversorger(plz);

  // Estimated consumption (heuristic or manual override)
  const heuristicKwh = useMemo(
    () => estimateConsumption(roomCount, persons),
    [roomCount, persons]
  );
  const estimatedKwh = manualKwh ?? heuristicKwh;

  // Price calculations
  const grundversorgerJahr = grundversorger
    ? Math.round(grundversorger.grundpreis + estimatedKwh * grundversorger.pricePerKwh)
    : 0;
  const check24Jahr = Math.round(CHECK24_BEST_GRUNDPREIS + estimatedKwh * CHECK24_BEST_PRICE_PER_KWH);
  const ersparnis = grundversorgerJahr - check24Jahr;

  // Check24 deep link with affiliate
  const buildCheck24Link = () => {
    const params = new URLSearchParams({
      zipcode: plz || '10115',
      totalConsumption: String(estimatedKwh),
      affiliate_id: CHECK24_AFFILIATE_ID,
    });
    if (stromMeter?.meterNumber) params.set('meterNumber', stromMeter.meterNumber);
    // Format moving date as DD.MM.YYYY
    const rawDate = data.contractEnd || new Date().toISOString().split('T')[0];
    const [y, m, d] = rawDate.split('-');
    const movingDate = d && m && y ? `${d}.${m}.${y}` : rawDate;
    params.set('movingDate', movingDate);
    return `https://www.check24.de/strom/vergleich/?${params.toString()}`;
  };

  const movingDateFormatted = (() => {
    const rawDate = data.contractEnd || new Date().toISOString().split('T')[0];
    const [y, m, d] = rawDate.split('-');
    return d && m && y ? `${d}.${m}.${y}` : rawDate;
  })();

  const handleCancellation = () => {
    setCancellation(true);
    toast({
      title: '📄 Kündigung vorbereitet!',
      description: 'Die Kündigung wurde als PDF-Entwurf erstellt und kann versendet werden.',
    });
  };

  return (
    <TooltipProvider>
      <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
        <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
          Utility-Switch
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
          Versorger wechseln & sparen – basierend auf Ihren Objektdaten
        </motion.p>

        <div className="w-full max-w-md space-y-4">

          {/* ── Verbrauchsschätzung (only for move-in / sale) ── */}
          {showCheck24 && (<>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
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
                  {stromMeter && (
                    <span className="block mt-1">
                      Der Zählerstand ({stromMeter.reading} kWh) dient lediglich der Schlussabrechnung mit dem Altversorger.
                    </span>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">Personenanzahl</label>
                  <span className="text-sm font-semibold">{persons} Person{persons !== 1 ? 'en' : ''}</span>
                </div>
                <Slider
                  value={[persons]}
                  onValueChange={([v]) => setPersons(v)}
                  min={1}
                  max={5}
                  step={1}
                />
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

          {/* ── Grundversorger Vergleich ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-5 border-2 border-success/30 bg-gradient-to-br from-success/5 to-transparent"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Preisvergleich</h3>
                <p className="text-xs text-muted-foreground">Check24 vs. Grundversorger</p>
              </div>
            </div>

            {/* Grundversorger info */}
            {grundversorger && (
              <div className="bg-background/60 rounded-xl p-3 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="text-xs">
                  <p className="text-muted-foreground">
                    Ihr Grundversorger{plz ? ` (PLZ ${plz})` : ''}
                  </p>
                  <p className="font-semibold">{grundversorger.name}</p>
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

            {/* Ersparnis highlight */}
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

            {/* DSGVO Consent */}
            <div className="flex items-start gap-2.5 mb-3">
              <Checkbox
                id="dsgvo-check24"
                checked={dsgvoConsent}
                onCheckedChange={(v) => setDsgvoConsent(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="dsgvo-check24" className="text-[11px] text-muted-foreground leading-tight cursor-pointer">
                Ich stimme zu, dass meine Daten (PLZ, geschätzter Verbrauch, Zählernummer) zum Zwecke des Tarifvergleichs an Check24 übertragen werden.{' '}
                <a href="/datenschutz" className="underline text-primary">Datenschutzerklärung</a>.
              </label>
            </div>

            {/* Check24 CTA */}
            {dsgvoConsent ? (
              <Button
                asChild
                className="w-full h-12 rounded-2xl font-semibold gap-2 bg-[#00893e] hover:bg-[#006e32] text-white"
                size="lg"
              >
                <a href={buildCheck24Link()} target="_blank" rel="noopener noreferrer">
                  <Zap className="w-5 h-5" />
                  Tarife vergleichen auf Check24
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            ) : (
              <Button
                disabled
                className="w-full h-12 rounded-2xl font-semibold gap-2"
                size="lg"
              >
                <Zap className="w-5 h-5" />
                Tarife vergleichen auf Check24
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}

            <p className="text-[10px] text-muted-foreground text-center mt-2">
              PLZ {plz || '–'} · {estimatedKwh.toLocaleString('de-DE')} kWh · Zähler: {stromMeter?.meterNumber || '–'} · Umzug: {movingDateFormatted}
            </p>
          </motion.div>
          </>)}

          {/* ── Kündigung for old tenant (only move-out rental) ── */}
          {showCancellation && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Kündigung für {cancellationTarget}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Automatisch generierte Kündigung des bestehenden Stromvertrags zum Auszugsdatum.
            </p>
            {!cancellation ? (
              <Button variant="outline" onClick={handleCancellation} className="w-full rounded-xl gap-2">
                <FileText className="w-4 h-4" />
                Kündigung für {cancellationTarget} vorbereiten
              </Button>
            ) : (
              <div className="flex items-center gap-2 justify-center p-3 bg-secondary/40 rounded-xl text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Kündigung vorbereitet
              </div>
            )}
          </motion.div>
          )}

          {/* ── Completion ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="glass-card rounded-2xl p-6 text-center border-2 border-primary/20"
          >
            <PartyPopper className="w-10 h-10 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-1">Übergabe abgeschlossen!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Alle 13 Schritte wurden erfolgreich durchlaufen. Ihr EstateTurn-Zertifikat ist rechtssicher erstellt.
            </p>
            <Button variant="outline" onClick={resetData} className="rounded-xl gap-2">
              Neue Übergabe starten
            </Button>
          </motion.div>
        </div>
      </div>
    </TooltipProvider>
  );
};
