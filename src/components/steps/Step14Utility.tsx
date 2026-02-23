import { motion } from 'framer-motion';
import {
  Zap, Leaf, TrendingDown, Euro, ArrowRight, FileText, CheckCircle2,
  PartyPopper, Info, Users, ExternalLink, Building2, Pencil, ShieldCheck,
  Home, Wifi
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

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export const Step14Utility = () => {
  const { data, resetData, updateData, goToStepById } = useHandover();
  const { cancellationTarget, isMoveIn, isSale } = useTransactionLabels();
  const isMoveOut = data.handoverDirection === 'move-out';
  const isLandlord = data.role === 'landlord';
  const isTenant = data.role === 'tenant';

  const [cancellation, setCancellation] = useState(false);
  const [dsgvoConsent, setDsgvoConsent] = useState(false);
  const [manualKwhEdit, setManualKwhEdit] = useState(false);
  const [manualKwh, setManualKwh] = useState<number | null>(null);
  const { toast } = useToast();

  const roomCount = data.rooms.length || 2;
  const [persons, setPersons] = useState(2);
  const stromMeter = data.meterReadings.find(m => m.medium === 'Strom');
  const plz = extractPlz(data.propertyAddress);
  const grundversorger = lookupGrundversorger(plz);

  const heuristicKwh = useMemo(() => estimateConsumption(roomCount, persons), [roomCount, persons]);
  const estimatedKwh = manualKwh ?? heuristicKwh;

  const grundversorgerJahr = grundversorger
    ? Math.round(grundversorger.grundpreis + estimatedKwh * grundversorger.pricePerKwh)
    : 0;
  const check24Jahr = Math.round(CHECK24_BEST_GRUNDPREIS + estimatedKwh * CHECK24_BEST_PRICE_PER_KWH);
  const ersparnis = grundversorgerJahr - check24Jahr;

  // Deposit amount from context
  const depositAmount = parseFloat(data.depositAmount) || 0;
  const propertyShort = data.propertyAddress
    ? data.propertyAddress.split(',')[0].trim()
    : 'Ihr Objekt';

  // Today's date as moving date (automatic handover date)
  const todayFormatted = getTodayFormatted();
  const todayISO = getTodayISO();

  // Context-aware headline & subtitle
  const headline = isMoveOut
    ? 'Dein Umzugs-Finale & Neustart-Service'
    : 'Umzugs-Vorteile & Anmelde-Service';

  const subtitle = isMoveOut
    ? (isTenant
        ? 'Sichere dir dein gratis Protokoll und ziehe mit deinem Strom/DSL einfach an die neue Adresse um.'
        : `Objekt ${propertyShort} jetzt für den Leerstand absichern (Rechtsschutz & Gebäudecheck).`)
    : 'Versorger wechseln & sparen – basierend auf Ihren Objektdaten';

  // Show Check24 tariff comparison for all users (tenants benefit from comparison on move-out too)
  const showCheck24 = true;
  // Show cancellation for rental move-out
  const showCancellation = isMoveOut && !isSale;
  // Show deposit trigger for move-out tenant
  const showDepositTrigger = isMoveOut && isTenant && depositAmount > 0;
  // Show landlord vacancy card for move-out landlord
  const showLandlordVacancy = isMoveOut && isLandlord;
  // Show move-out tenant utility transfer card
  const showMoveOutUtility = isMoveOut && isTenant;

  const buildCheck24Link = () => {
    const meterNum = stromMeter?.meterNumber || '';
    const params = new URLSearchParams({
      zipcode: plz || '25746',
      totalConsumption: String(estimatedKwh),
      affiliate_id: CHECK24_AFFILIATE_ID,
      partnerId: CHECK24_AFFILIATE_ID,
      meterNumber: meterNum,
      movingDate: todayFormatted,
    });
    return `https://www.check24.de/strom/vergleich/?${params.toString()}`;
  };

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
          {headline}
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm max-w-md">
          {subtitle}
        </motion.p>

        <div className="w-full max-w-md space-y-4">

          {/* ── Move-Out: Tenant Utility Transfer ── */}
          {showMoveOutUtility && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="glass-card rounded-2xl p-5 border-2 border-primary/20"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Strom & DSL mitnehmen</h3>
                  <p className="text-xs text-muted-foreground">An die neue Adresse umziehen</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Melde deinen bestehenden Strom- und Internetvertrag einfach auf deine neue Adresse um – oder sichere dir einen günstigeren Tarif.
              </p>
              {data.nextAddress && (
                <div className="bg-primary/5 rounded-xl p-2.5 mb-3 flex items-center gap-2">
                  <Home className="w-4 h-4 text-primary shrink-0" />
                  <div className="text-xs">
                    <span className="text-muted-foreground">Neue Adresse: </span>
                    <span className="font-medium">{data.nextAddress}</span>
                  </div>
                </div>
              )}
              <div className="bg-muted/40 rounded-xl p-2.5 mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="w-4 h-4 shrink-0" />
                Umzugsdatum: <span className="font-semibold text-foreground">{todayFormatted}</span> (Übergabetag)
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1 rounded-xl gap-1.5 text-xs h-10">
                  <a href={buildCheck24Link()} target="_blank" rel="noopener noreferrer">
                    <Zap className="w-4 h-4" />
                    Neuer Stromtarif
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl gap-1.5 text-xs h-10" disabled>
                  <Wifi className="w-4 h-4" />
                  DSL umziehen
                  <span className="text-[9px] text-muted-foreground">(bald)</span>
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Move-Out: Kautions-Trigger (Tenant) ── */}
          {showDepositTrigger && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl p-5 border-2 border-amber-400/30 bg-gradient-to-br from-amber-500/5 to-transparent"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Kautionsschutz</h3>
                  <p className="text-xs text-muted-foreground">Sofort-Auszahlung deiner Kaution</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Warte nicht auf dein Geld. Sichere dir deine Kaution von <span className="font-bold text-foreground">{depositAmount.toLocaleString('de-DE')} €</span> sofort über unseren Partner-Kautionsschutz.
              </p>
              <div className="bg-amber-500/10 rounded-xl p-3 mb-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Kautionshöhe laut Vertrag</p>
                <p className="text-xl font-bold text-amber-600">{depositAmount.toLocaleString('de-DE')} €</p>
              </div>
              <Button variant="outline" className="w-full rounded-xl gap-2 border-amber-400/50 hover:bg-amber-500/10" disabled>
                <ShieldCheck className="w-4 h-4" />
                Kaution sofort sichern
                <span className="text-[9px] text-muted-foreground">(bald verfügbar)</span>
              </Button>
            </motion.div>
          )}

          {/* ── Move-Out: Landlord Vacancy Protection ── */}
          {showLandlordVacancy && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl p-5 border-2 border-blue-400/30 bg-gradient-to-br from-blue-500/5 to-transparent"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Leerstandsschutz</h3>
                  <p className="text-xs text-muted-foreground">{propertyShort} absichern</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Schützen Sie Ihr Objekt während des Leerstands: Rechtsschutz, Gebäudecheck und Vermittlungsservice für die Neuvermietung.
              </p>
              <Button variant="outline" className="w-full rounded-xl gap-2 border-blue-400/50 hover:bg-blue-500/10" disabled>
                <Building2 className="w-4 h-4" />
                Leerstandsschutz anfragen
                <span className="text-[9px] text-muted-foreground">(bald)</span>
              </Button>
            </motion.div>
          )}

          {/* ── Move-In / Sale: Verbrauchsschätzung & Check24 ── */}
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

          {/* ── Grundversorger Vergleich ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
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

            <div className="flex items-start gap-2.5 mb-3">
              <Checkbox
                id="dsgvo-check24"
                checked={dsgvoConsent}
                onCheckedChange={(v) => setDsgvoConsent(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="dsgvo-check24" className="text-[11px] text-muted-foreground leading-tight cursor-pointer">
                Ich stimme zu, dass meine Daten (PLZ <span className="font-semibold text-foreground">{plz || '–'}</span>, geschätzter Verbrauch <span className="font-semibold text-foreground">{estimatedKwh.toLocaleString('de-DE')} kWh</span>, Zählernummer <span className="font-semibold text-foreground">{stromMeter?.meterNumber || '–'}</span>) zum Zwecke des Tarifvergleichs an Check24 übertragen werden.{' '}
                <a href="/datenschutz" className="underline text-primary">Datenschutzerklärung</a>.
              </label>
            </div>

            {dsgvoConsent ? (
              <Button
                onClick={() => {
                  updateData({ serviceCheckStatus: 'completed' });
                  toast({ title: '✅ Protokoll freigeschaltet', description: 'Vielen Dank! Ihr Protokoll ist jetzt ohne Wasserzeichen verfügbar.' });
                  window.open(buildCheck24Link(), '_blank');
                }}
                className="w-full h-12 rounded-2xl font-semibold gap-2 bg-[#00893e] hover:bg-[#006e32] text-white"
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
            )}

            <p className="text-[10px] text-muted-foreground text-center mt-2">
              PLZ {plz || '–'} · {estimatedKwh.toLocaleString('de-DE')} kWh · Zähler: {stromMeter?.meterNumber || '–'} · Umzug: {todayFormatted}
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
              Alle Schritte wurden erfolgreich durchlaufen. Ihr EstateTurn-Zertifikat ist rechtssicher erstellt.
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
