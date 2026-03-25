import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Landmark, BookOpen, Euro, Upload, CheckCircle2, Info, ArrowRight, Camera } from 'lucide-react';
import { useHandover } from '@/context/HandoverContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { createThumbnail } from '@/lib/imageUtils';

type DepositOption = 'cash' | 'guarantee' | 'account';

const OPTIONS: { value: DepositOption; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'cash', label: 'Barzahlung / Überweisung', icon: <Euro className="w-5 h-5" />, desc: 'Klassische Mietsicherheit per Zahlung oder Überweisung an den Vermieter' },
  { value: 'guarantee', label: 'Mietkautionsbürgschaft', icon: <Shield className="w-5 h-5" />, desc: 'Bankbürgschaft oder Kautionsversicherung als Sicherheit' },
  { value: 'account', label: 'Kautionskonto / Sparbuch', icon: <BookOpen className="w-5 h-5" />, desc: 'Verpfändetes Sparkonto oder Sparbuch zugunsten des Vermieters' },
];

export const StepDepositMoveIn = () => {
  const { data, updateData, goToStepById } = useHandover();
  const selected = data.moveInDepositType;
  const fileRef = useRef<HTMLInputElement>(null);

  const amount = data.moveInDepositAmount || data.depositAmount || '';
  const firstRate = amount ? (parseFloat(amount.replace(',', '.')) / 3).toFixed(2) : '0.00';

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>, field: 'moveInFirstRateProofUrl' | 'moveInGuaranteeCertUrl' | 'moveInPledgeDocUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const thumb = await createThumbnail(dataUrl, 400, 400, 0.8);
      updateData({ [field]: thumb });
    };
    reader.readAsDataURL(file);
  };

  const hasProof = (() => {
    if (selected === 'cash') return !!data.moveInFirstRateProofUrl;
    if (selected === 'guarantee') return !!data.moveInGuaranteeCertUrl;
    if (selected === 'account') return !!data.moveInPledgeDocUrl;
    return false;
  })();

  const canProceed = selected !== null && hasProof;

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6 w-full max-w-md">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-3">
          <Landmark className="w-3.5 h-3.5" />
          Kaution & Sicherheit
        </div>
        <h2 className="text-2xl font-bold">Kaution & Mietsicherheit</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Rechtssichere Dokumentation der Mietsicherheit
        </p>
      </motion.div>

      <div className="w-full max-w-md space-y-4">
        {/* Deposit type cards */}
        <div className="space-y-3">
          {OPTIONS.map(opt => (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateData({ moveInDepositType: opt.value })}
              className={`w-full flex items-start gap-4 rounded-xl p-4 text-left transition-all border-2 shadow-sm ${
                selected === opt.value
                  ? 'border-success bg-success/5 shadow-md'
                  : 'border-border/40 bg-card hover:bg-accent/5'
              }`}
            >
              <div className={`mt-0.5 p-2 rounded-lg ${selected === opt.value ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                {opt.icon}
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold block">{opt.label}</span>
                <span className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</span>
              </div>
              {selected === opt.value && (
                <CheckCircle2 className="w-5 h-5 text-success mt-1 shrink-0" />
              )}
            </motion.button>
          ))}
        </div>

        {/* Conditional fields */}
        <AnimatePresence mode="wait">
          {selected === 'cash' && (
            <motion.div key="cash" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
              <div className="glass-card rounded-xl p-4 space-y-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Gesamtbetrag der Kaution (€)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={e => updateData({ moveInDepositAmount: e.target.value })}
                    placeholder="z. B. 1.500,00"
                    className="mt-1 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm">Ratenzahlung gemäß § 551 BGB nutzen?</Label>
                  <Switch
                    checked={data.moveInInstallments}
                    onCheckedChange={v => updateData({ moveInInstallments: v })}
                  />
                </div>

                {data.moveInInstallments && amount && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-success/10 border border-success/20 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Betrag der 1. Rate (fällig bei Übergabe):</p>
                    <p className="text-lg font-bold text-success">{firstRate} €</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Weitere Raten: jeweils zum 2. und 3. Monat nach Einzug</p>
                  </motion.div>
                )}

                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Nachweis der {data.moveInInstallments ? '1. Rate' : 'Zahlung'} hochladen
                  </Label>
                  <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileRef}
                    onChange={e => handlePhoto(e, 'moveInFirstRateProofUrl')} />
                  {data.moveInFirstRateProofUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-success/30">
                      <img src={data.moveInFirstRateProofUrl} alt="Nachweis" className="w-full h-40 object-cover" />
                      <button onClick={() => fileRef.current?.click()} className="absolute bottom-2 right-2 bg-background/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs font-medium">
                        Ersetzen
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                      <Camera className="w-6 h-6" />
                      <span className="text-xs font-medium">Foto / Screenshot aufnehmen</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {selected === 'guarantee' && (
            <motion.div key="guarantee" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
              <div className="glass-card rounded-xl p-4 space-y-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Anbieter der Bürgschaft</Label>
                  <Input
                    value={data.moveInGuaranteeProvider}
                    onChange={e => updateData({ moveInGuaranteeProvider: e.target.value })}
                    placeholder="z. B. R+V Versicherung, Deutsche Kautionskasse"
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">Foto der Bürgschaftsurkunde aufnehmen</Label>
                  <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileRef}
                    onChange={e => handlePhoto(e, 'moveInGuaranteeCertUrl')} />
                  {data.moveInGuaranteeCertUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-success/30">
                      <img src={data.moveInGuaranteeCertUrl} alt="Bürgschaft" className="w-full h-40 object-cover" />
                      <button onClick={() => fileRef.current?.click()} className="absolute bottom-2 right-2 bg-background/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs font-medium">
                        Ersetzen
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                      <Camera className="w-6 h-6" />
                      <span className="text-xs font-medium">Bürgschaftsurkunde fotografieren</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {selected === 'account' && (
            <motion.div key="account" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
              <div className="glass-card rounded-xl p-4 space-y-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">Verpfändungserklärung / Sparbuch fotografieren</Label>
                  <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileRef}
                    onChange={e => handlePhoto(e, 'moveInPledgeDocUrl')} />
                  {data.moveInPledgeDocUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-success/30">
                      <img src={data.moveInPledgeDocUrl} alt="Sparbuch" className="w-full h-40 object-cover" />
                      <button onClick={() => fileRef.current?.click()} className="absolute bottom-2 right-2 bg-background/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs font-medium">
                        Ersetzen
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                      <Camera className="w-6 h-6" />
                      <span className="text-xs font-medium">Dokument fotografieren</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legal info box */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Rechtshinweis:</span>{' '}
            Der Vermieter kann die Schlüsselübergabe verweigern, wenn die 1. Rate oder die Bürgschaftsurkunde nicht vorliegt (§ 551 BGB). EstateTurn dokumentiert diesen Nachweis für beide Parteien.
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" className="flex-1 h-12 rounded-2xl" onClick={() => goToStepById('meters')}>
            Zurück
          </Button>
          <Button
            className="flex-1 h-12 rounded-2xl font-semibold gap-2"
            disabled={!canProceed}
            onClick={() => goToStepById('data-complete')}
          >
            Bestätigen & Weiter
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StepDepositMoveIn;
