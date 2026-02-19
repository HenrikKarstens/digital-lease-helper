import { motion } from 'framer-motion';
import { Upload, Plus, X, ArrowRight, Grid3X3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useState, useRef, useCallback, useEffect } from 'react';

// ── AI-suggested floor plans based on room count ──────────────────────────
const suggestRooms = (contractText: string): KonvaRoom[] => {
  const match = contractText.match(/(\d+)\s*[Zz]immer/);
  const roomCount = match ? parseInt(match[1]) : 3;

  const layouts: Record<number, KonvaRoom[]> = {
    1: [
      { id: '1', name: 'Wohnzimmer/Schlafzimmer', x: 20, y: 20, w: 200, h: 160 },
      { id: '2', name: 'Küche', x: 20, y: 200, w: 90, h: 80 },
      { id: '3', name: 'Bad', x: 130, y: 200, w: 90, h: 80 },
    ],
    2: [
      { id: '1', name: 'Wohnzimmer', x: 20, y: 20, w: 200, h: 130 },
      { id: '2', name: 'Schlafzimmer', x: 20, y: 170, w: 120, h: 110 },
      { id: '3', name: 'Küche', x: 160, y: 170, w: 80, h: 110 },
      { id: '4', name: 'Bad', x: 20, y: 300, w: 100, h: 80 },
    ],
    3: [
      { id: '1', name: 'Wohnzimmer', x: 20, y: 20, w: 200, h: 140 },
      { id: '2', name: 'Schlafzimmer 1', x: 20, y: 180, w: 95, h: 110 },
      { id: '3', name: 'Schlafzimmer 2', x: 130, y: 180, w: 90, h: 110 },
      { id: '4', name: 'Küche', x: 20, y: 310, w: 90, h: 80 },
      { id: '5', name: 'Bad', x: 130, y: 310, w: 90, h: 80 },
    ],
    4: [
      { id: '1', name: 'Wohnzimmer', x: 20, y: 20, w: 200, h: 130 },
      { id: '2', name: 'Schlafzimmer 1', x: 20, y: 170, w: 95, h: 100 },
      { id: '3', name: 'Schlafzimmer 2', x: 130, y: 170, w: 90, h: 100 },
      { id: '4', name: 'Kinderzimmer', x: 20, y: 290, w: 95, h: 90 },
      { id: '5', name: 'Küche', x: 130, y: 290, w: 90, h: 90 },
      { id: '6', name: 'Bad', x: 20, y: 400, w: 90, h: 70 },
    ],
  };

  return layouts[Math.min(roomCount, 4)] || layouts[3];
};

const ROOM_COLORS = [
  'hsl(220,70%,55%)', 'hsl(160,60%,45%)', 'hsl(35,80%,50%)',
  'hsl(280,60%,55%)', 'hsl(10,70%,50%)', 'hsl(200,65%,50%)', 'hsl(120,50%,45%)'
];

interface KonvaRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const STAGE_W = 300;
const STAGE_H = 420;

// ── SVG-based interactive floor plan editor ───────────────────────────────
const FloorPlanEditor = ({ rooms, onChange }: { rooms: KonvaRoom[]; onChange: (rooms: KonvaRoom[]) => void }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getSVGPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * STAGE_W,
      y: ((clientY - rect.top) / rect.height) * STAGE_H,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    const { x, y } = getSVGPoint(e);
    const room = rooms.find(r => r.id === id);
    if (!room) return;
    setSelected(id);
    setDragging({ id, startX: x, startY: y, origX: room.x, origY: room.y });
  };

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return;
    e.preventDefault();
    const { x, y } = getSVGPoint(e);
    const dx = x - dragging.startX;
    const dy = y - dragging.startY;
    onChange(rooms.map(r => r.id === dragging.id
      ? { ...r, x: Math.max(0, Math.min(STAGE_W - r.w, dragging.origX + dx)), y: Math.max(0, Math.min(STAGE_H - r.h, dragging.origY + dy)) }
      : r
    ));
  }, [dragging, rooms, onChange]);

  const handlePointerUp = () => setDragging(null);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      className="w-full rounded-xl touch-none select-none"
      style={{ height: STAGE_H, maxHeight: STAGE_H }}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      onClick={() => setSelected(null)}
    >
      {/* Grid background */}
      <defs>
        <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M 22 0 L 0 0 0 22" fill="none" stroke="hsl(var(--muted-foreground)/0.08)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={STAGE_W} height={STAGE_H} fill="url(#grid)" />

      {rooms.map((room, idx) => {
        const color = ROOM_COLORS[idx % ROOM_COLORS.length];
        const isSelected = selected === room.id;
        return (
          <g
            key={room.id}
            transform={`translate(${room.x}, ${room.y})`}
            onMouseDown={e => handlePointerDown(e, room.id)}
            onTouchStart={e => handlePointerDown(e, room.id)}
            style={{ cursor: 'grab' }}
            onClick={e => { e.stopPropagation(); setSelected(isSelected ? null : room.id); }}
          >
            <rect
              width={room.w}
              height={room.h}
              rx={8}
              fill={color}
              fillOpacity={isSelected ? 0.3 : 0.15}
              stroke={color}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <foreignObject x={4} y={room.h / 2 - 14} width={room.w - 8} height={28}>
              <div
                style={{ fontSize: 10, fontWeight: 600, color, textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2 }}
              >
                {room.name}
              </div>
            </foreignObject>
            {isSelected && (
              <circle cx={room.w / 2} cy={room.h - 10} r={4} fill={color} opacity={0.8} />
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ── Main Component ────────────────────────────────────────────────────────
export const Step5FloorPlan = () => {
  const { data, updateData, setCurrentStep } = useHandover();
  const [hasUploaded, setHasUploaded] = useState(!!data.floorPlanUrl);
  const [svgRooms, setSvgRooms] = useState<KonvaRoom[]>([]);
  const [newRoom, setNewRoom] = useState('');
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const aiRooms = useCallback(() => {
    const hint = `${data.propertyAddress} ${data.coldRent}`;
    return suggestRooms(hint);
  }, [data.propertyAddress, data.coldRent]);

  const syncRoomsToContext = (rooms: KonvaRoom[]) => {
    updateData({
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        x: Math.round((r.x / STAGE_W) * 100),
        y: Math.round((r.y / STAGE_H) * 100),
      }))
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateData({ floorPlanUrl: url });
      const suggested = aiRooms();
      setSvgRooms(suggested);
      syncRoomsToContext(suggested);
      setHasUploaded(true);
    }
  };

  const handleUseMock = () => {
    updateData({ floorPlanUrl: 'mock' });
    const suggested = aiRooms();
    setSvgRooms(suggested);
    syncRoomsToContext(suggested);
    setShowAiSuggestion(true);
    setHasUploaded(true);
  };

  const handleUseAiSuggestion = () => {
    const suggested = aiRooms();
    setSvgRooms(suggested);
    syncRoomsToContext(suggested);
    setShowAiSuggestion(true);
    setHasUploaded(true);
    updateData({ floorPlanUrl: 'ai-generated' });
  };

  const handleRoomsChange = (rooms: KonvaRoom[]) => {
    setSvgRooms(rooms);
    syncRoomsToContext(rooms);
  };

  const addRoom = () => {
    if (!newRoom.trim()) return;
    const room: KonvaRoom = {
      id: Date.now().toString(),
      name: newRoom.trim(),
      x: 20 + Math.random() * 100,
      y: 20 + Math.random() * 100,
      w: 100,
      h: 80,
    };
    const next = [...svgRooms, room];
    setSvgRooms(next);
    syncRoomsToContext(next);
    setNewRoom('');
  };

  const removeRoom = (id: string) => {
    const next = svgRooms.filter(r => r.id !== id);
    setSvgRooms(next);
    syncRoomsToContext(next);
  };

  // ── Upload screen ─────────────────────────────────────────────────────
  if (!hasUploaded) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
        <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
          Grundriss-Setup
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-8 text-sm">
          KI schlägt passenden Grundriss vor oder laden Sie Ihren hoch
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-md space-y-4">
          <button
            onClick={handleUseAiSuggestion}
            className="glass-card rounded-2xl p-5 w-full border-2 border-primary/30 hover:border-primary/60 transition-colors flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">KI-Vorschlag generieren</h4>
              <p className="text-xs text-muted-foreground">Passender Grundriss aus Vertragsdaten</p>
            </div>
          </button>

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            className="glass-card rounded-2xl p-5 w-full border-2 border-dashed border-border hover:border-primary/40 transition-colors flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-semibold">Grundriss hochladen</h4>
              <p className="text-xs text-muted-foreground">Foto oder PDF des Grundrisses</p>
            </div>
          </button>

          <Button variant="outline" onClick={handleUseMock} className="w-full rounded-2xl h-12 gap-2">
            <Grid3X3 className="w-4 h-4" />
            Beispiel-Grundriss verwenden
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Editor screen ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center px-4 py-8 pb-24">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-1 text-center">
        Grundriss & Räume
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-xs text-muted-foreground text-center mb-5">
        Tippen & ziehen Sie Räume, um den Grundriss anzupassen
      </motion.p>

      {showAiSuggestion && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mb-4 px-4 py-2.5 rounded-2xl bg-primary/10 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-primary font-medium">KI hat einen Grundriss aus Ihren Vertragsdaten vorgeschlagen</p>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
        className="glass-card rounded-2xl p-3 w-full max-w-md mb-5 overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        <FloorPlanEditor rooms={svgRooms} onChange={handleRoomsChange} />
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="w-full max-w-md space-y-3">
        <div className="flex gap-2">
          <Input
            value={newRoom}
            onChange={e => setNewRoom(e.target.value)}
            placeholder="Neuen Raum hinzufügen..."
            className="rounded-xl bg-secondary/50 border-0"
            onKeyDown={e => e.key === 'Enter' && addRoom()}
          />
          <Button onClick={addRoom} size="icon" className="rounded-xl shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {svgRooms.map(room => (
            <span key={room.id} className="inline-flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5 text-xs font-medium">
              {room.name}
              <button onClick={() => removeRoom(room.id)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <Button onClick={() => setCurrentStep(7)} className="w-full h-13 rounded-2xl text-base font-semibold gap-2 mt-4" size="lg">
          Weiter
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>
    </div>
  );
};
