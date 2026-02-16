import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Camera, X, CheckCircle2, Crosshair, Clock, Compass, AlertTriangle, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover, Finding } from '@/context/HandoverContext';
import { useState, useEffect } from 'react';

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

type Phase = 'floorplan' | 'camera' | 'analyzing' | 'result';

const analysisMessages = [
  'Analysiere Material...',
  'Prüfe BGH-Urteile...',
  'Berechne Zeitwert...',
];

export const Step7Evidence = () => {
  const { data, updateData } = useHandover();
  const [phase, setPhase] = useState<Phase>('floorplan');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [pinPosition, setPinPosition] = useState<{ x: number; y: number } | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [currentResult, setCurrentResult] = useState<typeof AI_RESULTS[0] | null>(null);

  useEffect(() => {
    if (phase !== 'analyzing') return;
    if (analysisStep >= analysisMessages.length) {
      const result = AI_RESULTS[data.findings.length % AI_RESULTS.length];
      setCurrentResult(result);
      setPhase('result');
      return;
    }
    const timer = setTimeout(() => setAnalysisStep(s => s + 1), 1200);
    return () => clearTimeout(timer);
  }, [phase, analysisStep]);

  const handleFloorPlanClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPinPosition({ x, y });

    // Find nearest room
    let nearest = data.rooms[0]?.name || 'Unbekannt';
    let minDist = Infinity;
    data.rooms.forEach(r => {
      const dist = Math.sqrt((r.x - x) ** 2 + (r.y - y) ** 2);
      if (dist < minDist) { minDist = dist; nearest = r.name; }
    });
    setSelectedRoom(nearest);
    setTimeout(() => setPhase('camera'), 600);
  };

  const handleCapture = () => {
    setAnalysisStep(0);
    setPhase('analyzing');
  };

  const saveFinding = () => {
    if (!currentResult || !pinPosition || !selectedRoom) return;
    const finding: Finding = {
      id: Date.now().toString(),
      room: selectedRoom,
      pinX: pinPosition.x,
      pinY: pinPosition.y,
      ...currentResult,
      timestamp: new Date().toLocaleString('de-DE'),
    };
    updateData({ findings: [...data.findings, finding] });
    setPhase('floorplan');
    setPinPosition(null);
    setSelectedRoom(null);
    setCurrentResult(null);
  };

  // Floor plan view
  if (phase === 'floorplan') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
        <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
          Beweissicherung
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
          Tippen Sie auf den Grundriss, um einen Mangel zu dokumentieren
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-4 w-full max-w-md relative aspect-[4/3] bg-secondary/30 cursor-crosshair mb-6"
          onClick={handleFloorPlanClick}
        >
          {/* Grid */}
          <div className="absolute inset-4 border border-border/50 rounded-xl">
            <div className="absolute top-0 left-1/2 w-px h-full bg-border/30" />
            <div className="absolute top-1/2 left-0 w-full h-px bg-border/30" />
          </div>

          {/* Room labels */}
          {data.rooms.map(room => (
            <div
              key={room.id}
              className="absolute text-xs font-medium text-muted-foreground pointer-events-none"
              style={{ left: `${room.x}%`, top: `${room.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              {room.name}
            </div>
          ))}

          {/* Existing pins */}
          {data.findings.map(f => (
            <motion.div
              key={f.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute"
              style={{ left: `${f.pinX}%`, top: `${f.pinY}%`, transform: 'translate(-50%, -100%)' }}
            >
              <MapPin className="w-6 h-6 text-destructive drop-shadow-lg" />
            </motion.div>
          ))}

          {/* Current pin */}
          {pinPosition && (
            <motion.div
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="absolute"
              style={{ left: `${pinPosition.x}%`, top: `${pinPosition.y}%`, transform: 'translate(-50%, -100%)' }}
            >
              <MapPin className="w-8 h-8 text-primary drop-shadow-lg" />
            </motion.div>
          )}

          {/* Crosshair hint */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <Crosshair className="w-12 h-12" />
          </div>
        </motion.div>

        {/* Findings list */}
        {data.findings.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md space-y-2">
            <h3 className="text-sm font-semibold mb-2">Erfasste Befunde ({data.findings.length})</h3>
            {data.findings.map((f, i) => (
              <div key={f.id} className="glass-card rounded-xl p-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-destructive" />
                  <span className="font-medium">{f.room}</span>
                  <span className="text-muted-foreground">– {f.damageType}</span>
                </div>
                <span className="font-semibold text-destructive">{f.recommendedWithholding > 0 ? `${f.recommendedWithholding} €` : '–'}</span>
              </div>
            ))}
            <div className="glass-card rounded-xl p-3 flex items-center justify-between text-sm font-semibold border-primary/20">
              <span>Gesamt empfohlener Einbehalt</span>
              <span className="text-primary">{data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0)} €</span>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // Camera mock
  if (phase === 'camera') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl overflow-hidden bg-foreground relative aspect-[3/4]"
        >
          {/* Simulated camera view */}
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/80 to-foreground flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-accent/60 rounded-xl flex items-center justify-center">
              <Crosshair className="w-8 h-8 text-accent/60" />
            </div>
          </div>

          {/* Metadata overlay */}
          <div className="absolute top-4 left-4 right-4 flex justify-between text-xs text-accent font-mono">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>52.5200°N, 13.4050°E</span>
            </div>
            <div className="flex items-center gap-1">
              <Compass className="w-3 h-3" />
              <span>NW 315°</span>
            </div>
          </div>
          <div className="absolute top-10 left-4 text-xs text-accent font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{new Date().toLocaleString('de-DE')}</span>
          </div>

          {/* Room label */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary/80 text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
            {selectedRoom}
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setPhase('floorplan'); setPinPosition(null); }}
              className="text-primary-foreground/70 hover:text-primary-foreground"
            >
              <X className="w-6 h-6" />
            </Button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleCapture}
              className="w-16 h-16 rounded-full border-4 border-accent bg-accent/20 flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-accent" />
            </motion.button>
            <div className="w-10" /> {/* spacer */}
          </div>
        </motion.div>
      </div>
    );
  }

  // Analyzing
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
              <motion.div
                key={msg}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i <= analysisStep ? 1 : 0.3, x: 0 }}
                className="flex items-center gap-3 text-sm"
              >
                {i < analysisStep ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                ) : i === analysisStep ? (
                  <div className="w-4 h-4 rounded-full border-2 border-success/30 border-t-success animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />
                )}
                <span>{msg}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Result card
  if (phase === 'result' && currentResult) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card rounded-3xl p-6 w-full max-w-md"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <h3 className="font-semibold text-lg">Smart-Analyse</h3>
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
                <p className="text-xs text-muted-foreground">Neu für Alt</p>
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
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => { setPhase('floorplan'); setPinPosition(null); }} className="flex-1 rounded-xl">
              Verwerfen
            </Button>
            <Button onClick={saveFinding} className="flex-1 rounded-xl gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Übernehmen
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};
