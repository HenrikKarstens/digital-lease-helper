import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Camera, X, CheckCircle2, Crosshair, Clock, Compass,
  AlertTriangle, Euro, ChevronDown, Pencil, Trash2, Plus,
  FileText, StickyNote, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover, Finding, EntryType } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { useState, useEffect } from 'react';

// ─── Data ────────────────────────────────────────────────────────────────────

const AI_RESULTS = [
  {
    material: 'Eichenparkett',
    damageType: 'Kratzer, ca. 15cm',
    bghReference: 'BGH VIII ZR 222/15',
    timeValueDeduction: 35,
    recommendedWithholding: 150,
    description: 'Oberflächlicher Kratzer im Eichenparkett. Zeitwertberechnung nach BGH-Urteil.',
  },
  {
    material: 'Raufasertapete',
    damageType: 'Verfärbung, 20x30cm',
    bghReference: 'BGH VIII ZR 163/18',
    timeValueDeduction: 80,
    recommendedWithholding: 0,
    description: 'Normale Abnutzung. Kein Einbehalt empfohlen (Schönheitsreparaturen-Klausel unwirksam).',
  },
  {
    material: 'Fliesen (Feinsteinzeug)',
    damageType: 'Abplatzung, 3cm',
    bghReference: 'BGH VIII ZR 71/20',
    timeValueDeduction: 20,
    recommendedWithholding: 85,
    description: 'Abplatzung an einer Bodenfliese im Bad. Reparatur durch Teilersatz möglich.',
  },
];

const ROOMS_INDOOR = [
  'Flur', 'Wohnzimmer', 'Schlafzimmer', 'Kinderzimmer', 'Bad', 'Gäste-WC', 'Küche', 'Abstellraum',
];
const ROOMS_OUTDOOR = [
  'Balkon/Terrasse', 'Garten', 'Garage', 'Carport', 'Keller', 'Dachboden', 'Außenbereich',
];

const analysisMessages = [
  'Analysiere Material...',
  'Prüfe BGH-Urteile...',
  'Berechne Zeitwert...',
];

type Phase = 'list' | 'camera' | 'room-select' | 'analyzing' | 'result' | 'manual-entry' | 'edit';

// ─── RoomDropdown helper ──────────────────────────────────────────────────────

interface RoomDropdownProps {
  value: string;
  onChange: (v: string) => void;
  floorPlanRooms: { id: string; name: string }[];
}
const RoomDropdown = ({ value, onChange, floorPlanRooms }: RoomDropdownProps) => (
  <div className="relative">
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-11 rounded-xl border border-border bg-background px-3 pr-8 text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="" disabled>Raum auswählen …</option>
      {floorPlanRooms.length > 0 && (
        <optgroup label="Aus Grundriss">
          {floorPlanRooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </optgroup>
      )}
      <optgroup label="Innen">
        {ROOMS_INDOOR.filter(sr => !floorPlanRooms.some(r => r.name === sr)).map(sr => (
          <option key={sr} value={sr}>{sr}</option>
        ))}
      </optgroup>
      <optgroup label="Außen / Neben">
        {ROOMS_OUTDOOR.map(sr => <option key={sr} value={sr}>{sr}</option>)}
      </optgroup>
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const Step7Evidence = () => {
  const { evidenceTitle, evidenceSubtitle } = useTransactionLabels();
  const { data, updateData, setCurrentStep } = useHandover();

  const [phase, setPhase] = useState<Phase>('list');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [analysisStep, setAnalysisStep] = useState(0);
  const [currentResult, setCurrentResult] = useState<typeof AI_RESULTS[0] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Manual / note entry state
  const [manualDesc, setManualDesc] = useState('');
  const [manualRoom, setManualRoom] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [manualType, setManualType] = useState<EntryType>('defect');

  // ── AI analysis loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'analyzing') return;
    if (analysisStep >= analysisMessages.length) {
      const result = AI_RESULTS[data.findings.length % AI_RESULTS.length];
      setCurrentResult(result);
      setPhase('result');
      return;
    }
    const t = setTimeout(() => setAnalysisStep(s => s + 1), 1200);
    return () => clearTimeout(t);
  }, [phase, analysisStep, data.findings.length]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const resetFlow = () => {
    setPhase('list');
    setSelectedRoom('');
    setLocationDetail('');
    setCurrentResult(null);
    setAnalysisStep(0);
    setEditingId(null);
  };

  const deleteFinding = (id: string) => {
    updateData({ findings: data.findings.filter(f => f.id !== id) });
  };

  const startEdit = (f: Finding) => {
    setEditingId(f.id);
    setManualDesc(f.description);
    setManualRoom(f.room);
    setManualLocation(f.locationDetail || '');
    setManualType(f.entryType || 'defect');
    setPhase('edit');
  };

  const saveEdit = () => {
    updateData({
      findings: data.findings.map(f =>
        f.id === editingId
          ? { ...f, room: manualRoom, description: manualDesc, locationDetail: manualLocation, entryType: manualType }
          : f
      ),
    });
    resetFlow();
  };

  const saveManual = () => {
    if (!manualDesc.trim() || !manualRoom) return;
    const finding: Finding = {
      id: Date.now().toString(),
      room: manualRoom,
      pinX: 50,
      pinY: 50,
      material: '–',
      damageType: manualDesc.trim(),
      bghReference: '',
      timeValueDeduction: 0,
      recommendedWithholding: 0,
      description: manualDesc.trim(),
      timestamp: new Date().toLocaleString('de-DE'),
      locationDetail: manualLocation.trim() || undefined,
      entryType: manualType,
    };
    updateData({ findings: [...data.findings, finding] });
    setManualDesc('');
    setManualRoom('');
    setManualLocation('');
    setManualType('defect');
    setPhase('list');
  };

  const saveFinding = () => {
    if (!currentResult || !selectedRoom) return;
    const finding: Finding = {
      id: Date.now().toString(),
      room: selectedRoom,
      pinX: 50,
      pinY: 50,
      ...currentResult,
      timestamp: new Date().toLocaleString('de-DE'),
      locationDetail: locationDetail.trim() || undefined,
      entryType: currentResult.recommendedWithholding > 0 ? 'defect' : 'note',
    };
    updateData({ findings: [...data.findings, finding] });
    resetFlow();
  };

  const defects = data.findings.filter(f => f.entryType !== 'note');
  const notes = data.findings.filter(f => f.entryType === 'note');
  const totalWithholding = defects.reduce((s, f) => s + f.recommendedWithholding, 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: LIST (main view)
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'list') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
        <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold mb-1 text-center">{evidenceTitle}</motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
          className="text-muted-foreground text-center mb-6 text-sm">{evidenceSubtitle}</motion.p>

        <div className="w-full max-w-md space-y-4">

          {/* ── Action buttons ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setPhase('camera')}
              className="h-14 rounded-2xl gap-2 flex-col text-xs font-semibold"
              variant="outline"
            >
              <Camera className="w-5 h-5" />
              Foto + KI-Analyse
            </Button>
            <Button
              onClick={() => { setManualType('defect'); setPhase('manual-entry'); }}
              className="h-14 rounded-2xl gap-2 flex-col text-xs font-semibold"
              variant="outline"
            >
              <FileText className="w-5 h-5 text-amber-500" />
              Manueller Mangel
            </Button>
            <Button
              onClick={() => { setManualType('note'); setPhase('manual-entry'); }}
              className="h-14 rounded-2xl gap-2 flex-col text-xs font-semibold col-span-2"
              variant="outline"
            >
              <StickyNote className="w-4 h-4 text-primary" />
              Besonderheit / Notiz (ohne Abzug)
            </Button>
          </motion.div>

          {/* ── Defects list ── */}
          {defects.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Mängel ({defects.length})
              </h3>
              <div className="space-y-2">
                {defects.map((f, i) => (
                  <FindingCard key={f.id} f={f} onEdit={() => startEdit(f)} onDelete={() => deleteFinding(f.id)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Notes list ── */}
          {notes.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5 text-primary" /> Besonderheiten ({notes.length})
              </h3>
              <div className="space-y-2">
                {notes.map(f => (
                  <FindingCard key={f.id} f={f} onEdit={() => startEdit(f)} onDelete={() => deleteFinding(f.id)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Total ── */}
          {defects.length > 0 && (
            <motion.div
              key={totalWithholding}
              initial={{ scale: 1.02 }}
              animate={{ scale: 1 }}
              className="glass-card rounded-2xl p-4 flex items-center justify-between"
            >
              <span className="text-sm font-semibold">Geschätzter Kautionseinbehalt</span>
              <span className="text-xl font-bold text-destructive">{totalWithholding} €</span>
            </motion.div>
          )}

          {/* ── Continue ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            {data.findings.length === 0 ? (
              <Button variant="outline" onClick={() => setCurrentStep(9)} className="w-full h-12 rounded-2xl font-semibold">
                Weiter ohne Befunde →
              </Button>
            ) : (
              <Button onClick={() => setCurrentStep(9)} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
                Weiter zur Zählererfassung
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: CAMERA (Foto-First)
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'camera') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl overflow-hidden bg-foreground relative aspect-[3/4]"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/80 to-foreground flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-accent/60 rounded-xl flex items-center justify-center">
              <Crosshair className="w-8 h-8 text-accent/60" />
            </div>
          </div>
          <div className="absolute top-4 left-4 right-4 flex justify-between text-xs text-accent font-mono">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> 52.5200°N</span>
            <span className="flex items-center gap-1"><Compass className="w-3 h-3" /> NW 315°</span>
          </div>
          <div className="absolute top-10 left-4 text-xs text-accent font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />{new Date().toLocaleString('de-DE')}
          </div>
          <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-6">
            <Button variant="ghost" size="icon"
              onClick={resetFlow}
              className="text-primary-foreground/70 hover:text-primary-foreground"
            >
              <X className="w-6 h-6" />
            </Button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setPhase('room-select')}
              className="w-16 h-16 rounded-full border-4 border-accent bg-accent/20 flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-accent" />
            </motion.button>
            <div className="w-10" />
          </div>
        </motion.div>
        <p className="text-xs text-muted-foreground text-center">Foto aufnehmen – danach Raum zuordnen</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: ROOM-SELECT (after photo)
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'room-select') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md space-y-5"
        >
          <div>
            <h3 className="font-bold text-lg mb-1">In welchem Raum?</h3>
            <p className="text-sm text-muted-foreground">Ordne das Foto dem richtigen Bereich zu.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Raum *</label>
              <RoomDropdown value={selectedRoom} onChange={setSelectedRoom} floorPlanRooms={data.rooms} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Genaue Lage (optional)
              </label>
              <input
                type="text"
                value={locationDetail}
                onChange={e => setLocationDetail(e.target.value)}
                placeholder="z. B. Decke hinten rechts, Wand neben Fenster"
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPhase('camera')} className="flex-1 rounded-xl">
              ← Zurück
            </Button>
            <Button
              disabled={!selectedRoom}
              onClick={() => { setAnalysisStep(0); setPhase('analyzing'); }}
              className="flex-1 rounded-xl gap-1"
            >
              KI analysieren
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: ANALYZING
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'analyzing') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-3xl p-8 w-full max-w-md text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border-4 border-success/20 border-t-success mx-auto mb-6"
          />
          <h3 className="font-semibold text-lg mb-6">KI-Schadensanalyse</h3>
          <div className="space-y-4 text-left">
            {analysisMessages.map((msg, i) => (
              <motion.div key={msg}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i <= analysisStep ? 1 : 0.3, x: 0 }}
                className="flex items-center gap-3 text-sm"
              >
                {i < analysisStep
                  ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  : i === analysisStep
                    ? <div className="w-4 h-4 rounded-full border-2 border-success/30 border-t-success animate-spin shrink-0" />
                    : <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />
                }
                <span>{msg}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: RESULT
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'result' && currentResult) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <h3 className="font-semibold text-lg">Smart-Analyse</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">{selectedRoom}</span>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground">Erkanntes Material</p>
                <p className="font-semibold">{currentResult.material}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Schadensart</p>
                <p className="font-semibold text-destructive">{currentResult.damageType}</p>
              </div>
            </div>
            <div className="bg-secondary/60 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">BGH-Referenz</p>
              <p className="text-sm font-mono font-medium">{currentResult.bghReference}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/60 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Zeitwert-Abzug</p>
                <p className="text-lg font-bold">{currentResult.timeValueDeduction}%</p>
              </div>
              <div className="bg-primary/10 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Empfohlener Einbehalt</p>
                <div className="flex items-center gap-1">
                  <Euro className="w-4 h-4 text-primary" />
                  <p className="text-lg font-bold text-primary">{currentResult.recommendedWithholding}</p>
                </div>
              </div>
            </div>
            <div className="bg-secondary/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Bewertung</p>
              <p className="text-sm">{currentResult.description}</p>
            </div>
            {locationDetail && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> {locationDetail}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={resetFlow} className="flex-1 rounded-xl">Verwerfen</Button>
            <Button onClick={saveFinding} className="flex-1 rounded-xl gap-1">
              <CheckCircle2 className="w-4 h-4" /> Übernehmen
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE: MANUAL ENTRY / EDIT
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'manual-entry' || phase === 'edit') {
    const isEdit = phase === 'edit';
    const onSave = isEdit ? saveEdit : saveManual;
    const canSave = (isEdit ? manualRoom : manualRoom) && manualDesc.trim();

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md space-y-5"
        >
          <div>
            <h3 className="font-bold text-lg mb-1">
              {isEdit ? 'Eintrag bearbeiten' : manualType === 'note' ? 'Besonderheit / Notiz' : 'Manueller Mangel'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Raum, Beschreibung oder Typ anpassen.'
                : manualType === 'note'
                  ? 'Reiner Beweisanker ohne Kautionsabzug (z. B. Lampe demontiert).'
                  : 'Mangel ohne Foto dokumentieren.'}
            </p>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {(['defect', 'note'] as EntryType[]).map(t => (
              <button
                key={t}
                onClick={() => setManualType(t)}
                className={`flex-1 h-10 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  manualType === t
                    ? t === 'defect'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400'
                      : 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {t === 'defect' ? <><AlertTriangle className="w-3.5 h-3.5" /> Mangel</> : <><StickyNote className="w-3.5 h-3.5" /> Besonderheit</>}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Raum *</label>
              <RoomDropdown value={manualRoom} onChange={setManualRoom} floorPlanRooms={data.rooms} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Genaue Lage (optional)
              </label>
              <input
                type="text"
                value={manualLocation}
                onChange={e => setManualLocation(e.target.value)}
                placeholder="z. B. Deckenlampe demontiert, Fensterbrett links"
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Beschreibung *
              </label>
              <textarea
                value={manualDesc}
                onChange={e => setManualDesc(e.target.value)}
                placeholder="Was wurde festgestellt?"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={resetFlow} className="flex-1 rounded-xl">Abbrechen</Button>
            <Button disabled={!canSave} onClick={onSave} className="flex-1 rounded-xl gap-1">
              <CheckCircle2 className="w-4 h-4" />
              {isEdit ? 'Speichern' : 'Hinzufügen'}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};

// ─── Finding Card ─────────────────────────────────────────────────────────────

interface FindingCardProps {
  f: Finding;
  onEdit: () => void;
  onDelete: () => void;
}
const FindingCard = ({ f, onEdit, onDelete }: FindingCardProps) => {
  const isNote = f.entryType === 'note';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`glass-card rounded-xl p-3 border ${isNote ? 'border-primary/20' : 'border-amber-500/20'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isNote ? 'bg-primary' : 'bg-amber-400'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{f.room}</span>
              {f.locationDetail && (
                <span className="text-xs text-muted-foreground">· {f.locationDetail}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{f.damageType || f.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isNote && f.recommendedWithholding > 0 && (
            <span className="text-sm font-bold text-destructive mr-1">{f.recommendedWithholding} €</span>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
