import { motion } from 'framer-motion';
import { ShieldCheck, Trash, Paintbrush, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useHandover } from '@/context/HandoverContext';

export const StepConditionCheck = () => {
  const { data, updateData, goToStepById } = useHandover();

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8 min-h-[60vh]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
        <h1 className="text-2xl font-bold">Zustand & Sicherheit</h1>
        <p className="text-sm text-muted-foreground">Dokumentieren Sie den Übergabezustand der Wohnung.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="w-full max-w-md glass-card rounded-2xl p-5 space-y-5">
        {/* Reinigungszustand */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Trash className="w-3.5 h-3.5" />
            Reinigungszustand
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox checked={data.cleaningBesenrein} onCheckedChange={(v) => updateData({ cleaningBesenrein: !!v })} />
            <span className="text-sm">Wohnung besenrein übergeben?</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox checked={data.cleaningBriefkasten} onCheckedChange={(v) => updateData({ cleaningBriefkasten: !!v })} />
            <span className="text-sm">Briefkasten geleert?</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox checked={data.cleaningKeller} onCheckedChange={(v) => updateData({ cleaningKeller: !!v })} />
            <span className="text-sm">Keller geräumt?</span>
          </label>
        </div>

        {/* Rauchwarnmelder */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Rauchwarnmelder (LBO SH)
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox checked={data.smokeDetectorChecked} onCheckedChange={(v) => updateData({ smokeDetectorChecked: !!v })} />
            <span className="text-sm">Rauchwarnmelder in allen Schlafräumen und Fluren vorhanden und funktionsgeprüft?</span>
          </label>
          {!data.smokeDetectorChecked && (
            <p className="text-xs text-destructive ml-7">⚠ Pflichtprüfung gemäß § 49 Abs. 4 LBO Schleswig-Holstein</p>
          )}
        </div>

        {/* Schönheitsreparaturen */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Paintbrush className="w-3.5 h-3.5" />
            Schönheitsreparaturen
          </p>
          <div className="flex gap-2">
            <Button
              variant={data.wallsNeutralColors === true ? 'default' : 'outline'}
              size="sm"
              className="rounded-xl text-xs h-9"
              onClick={() => updateData({ wallsNeutralColors: true })}
            >
              ✓ Wände in neutralen Farben
            </Button>
            <Button
              variant={data.wallsNeutralColors === false ? 'destructive' : 'outline'}
              size="sm"
              className="rounded-xl text-xs h-9"
              onClick={() => updateData({ wallsNeutralColors: false })}
            >
              ✗ Auffällige Farben / Mängel
            </Button>
          </div>
          {data.wallsNeutralColors === false && (
            <p className="text-xs text-destructive">Hinweis: Nicht-neutrale Wandfarben können Schadensersatzansprüche begründen (BGH VIII ZR 224/07).</p>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="w-full max-w-md">
        <Button onClick={() => goToStepById('evidence')} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
          <CheckCircle2 className="w-4 h-4" />
          Weiter zur Beweissicherung
        </Button>
      </motion.div>
    </div>
  );
};

export default StepConditionCheck;
