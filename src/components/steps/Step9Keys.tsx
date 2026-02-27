import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef } from 'react';
import { Key, Plus, Trash2, Camera, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHandover } from '@/context/HandoverContext';

const KEY_TYPES = [
  'Haus- / Wohnungstür',
  'Briefkasten',
  'Garage / Carport',
  'Keller / Boden',
  'Transponder/Chip',
  'Sonstiger...',
];

export const Step9Keys = () => {
  const { data, updateData, goToStepById } = useHandover();
  const isMoveOut = data.handoverDirection === 'move-out';
  const photoInputRef = useRef<HTMLInputElement>(null);

  const keys = data.keyEntries ?? [];
  const keyPhoto = data.keyBundlePhotoUrl ?? null;

  const [newType, setNewType] = useState('');
  const [newCustomName, setNewCustomName] = useState('');
  const [newCount, setNewCount] = useState('1');
  const [newNote, setNewNote] = useState('');

  const addKey = () => {
    if (!newType) return;
    const isCustom = newType === 'Sonstiger...';
    if (isCustom && !newCustomName.trim()) return;
    const entry = {
      id: crypto.randomUUID(),
      type: isCustom ? newCustomName.trim() : newType,
      count: parseInt(newCount) || 1,
      note: newNote,
    };
    updateData({ keyEntries: [...keys, entry] });
    setNewType('');
    setNewCustomName('');
    setNewCount('1');
    setNewNote('');
  };

  const removeKey = (id: string) => {
    updateData({ keyEntries: keys.filter((k) => k.id !== id) });
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateData({ keyBundlePhotoUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const totalKeys = keys.reduce((s, k) => s + k.count, 0);
  const showWarning = isMoveOut && totalKeys === 0;

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Key className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Schlüssel-Inventur</h2>
      </motion.div>
      {data.propertyAddress && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="text-sm text-muted-foreground text-center mb-1 flex items-center justify-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5">📍</span>
          {data.propertyAddress}
        </motion.p>
      )}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm max-w-md">
        Erfassen Sie alle übergebenen Schlüssel und Zugangsmittel.
      </motion.p>

      {/* Warning for move-out with 0 keys */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full max-w-md glass-card rounded-2xl p-4 mb-4 border border-warning/40 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">Keine Schlüssel erfasst</p>
              <p className="text-xs text-muted-foreground">
                Bei einem Auszug gefährdet die fehlende Schlüsselrückgabe die rechtliche Besitzaufgabe (§ 546 BGB).
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add key form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="w-full max-w-md glass-card rounded-2xl p-5 mb-4 space-y-3"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Schlüssel hinzufügen
        </h3>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Typ *</Label>
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="rounded-xl h-11 bg-secondary/50 border-0 focus:ring-1">
              <SelectValue placeholder="Schlüsseltyp wählen..." />
            </SelectTrigger>
            <SelectContent className="z-50 bg-card border border-border rounded-xl shadow-lg">
              {KEY_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="cursor-pointer">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AnimatePresence>
          {newType === 'Sonstiger...' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5 overflow-hidden"
            >
              <Label className="text-xs text-muted-foreground">Individuelle Bezeichnung *</Label>
              <Input
                placeholder="z. B. Fahrradkeller, Dachboden..."
                value={newCustomName}
                onChange={(e) => setNewCustomName(e.target.value)}
                className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Anzahl *</Label>
            <Input
              type="number"
              min="1"
              value={newCount}
              onChange={(e) => setNewCount(e.target.value)}
              className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notiz</Label>
            <Input
              placeholder="z. B. Sicherheitsschlüssel"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="rounded-xl h-11 bg-secondary/50 border-0 focus-visible:ring-1"
            />
          </div>
        </div>

        <Button onClick={addKey} disabled={!newType || (newType === 'Sonstiger...' && !newCustomName.trim())} className="w-full h-11 rounded-2xl font-semibold gap-2">
          <Plus className="w-4 h-4" />
          Hinzufügen
        </Button>
      </motion.div>

      {/* Key list */}
      {keys.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md space-y-2 mb-4">
          <h3 className="text-sm font-semibold">Erfasste Schlüssel ({totalKeys} Stück)</h3>
          {keys.map((k) => (
            <motion.div
              key={k.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Key className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{k.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.count}× {k.note ? `· ${k.note}` : ''}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeKey(k.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Key bundle photo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md glass-card rounded-2xl p-5 mb-4"
      >
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          Beweisfoto Schlüsselbund *
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Fotografieren Sie alle Schlüssel zusammen auf einer neutralen Unterlage.
        </p>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
        />

        {keyPhoto ? (
          <div className="relative">
            <img src={keyPhoto} alt="Schlüsselbund" className="w-full rounded-xl border border-border max-h-48 object-cover" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => photoInputRef.current?.click()}
              className="absolute bottom-2 right-2 rounded-xl text-xs h-8 gap-1 bg-background/80 backdrop-blur-sm"
            >
              <Camera className="w-3 h-3" />
              Erneut aufnehmen
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => photoInputRef.current?.click()}
            className="w-full h-24 rounded-2xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-2 hover:border-primary/60 transition-colors"
          >
            <Camera className="w-6 h-6 text-primary/60" />
            <span className="text-xs text-muted-foreground">Foto aufnehmen</span>
          </Button>
        )}
      </motion.div>

      {/* Legal disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-md glass-card rounded-2xl p-4 mb-6 border border-warning/20 bg-warning/5"
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Rechtlicher Hinweis:</span>{' '}
          Der Mieter versichert mit der Übergabe, alle in seinem Besitz befindlichen Schlüssel (inkl. Duplikate) zurückgegeben zu haben.
          Nicht zurückgegebene Schlüssel begründen Schadensersatzansprüche (§ 546 BGB).
        </p>
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="w-full max-w-md">
        <Button
          onClick={() => goToStepById('meters')}
          disabled={keys.length === 0 || !keyPhoto}
          className="w-full h-12 rounded-2xl font-semibold gap-2"
          size="lg"
        >
          <CheckCircle2 className="w-4 h-4" />
          Weiter
        </Button>
        {(keys.length === 0 || !keyPhoto) && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Bitte mindestens einen Schlüssel und ein Beweisfoto erfassen.
          </p>
        )}
      </motion.div>
    </div>
  );
};
