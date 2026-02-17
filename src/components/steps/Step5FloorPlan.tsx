import { motion } from 'framer-motion';
import { Upload, Plus, X, ArrowRight, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHandover } from '@/context/HandoverContext';
import { useState, useRef } from 'react';

const DEFAULT_ROOMS = [
  { id: '1', name: 'Wohnzimmer', x: 25, y: 30 },
  { id: '2', name: 'Schlafzimmer', x: 65, y: 25 },
  { id: '3', name: 'Küche', x: 25, y: 65 },
  { id: '4', name: 'Bad', x: 65, y: 65 },
  { id: '5', name: 'Flur', x: 45, y: 48 },
];

export const Step5FloorPlan = () => {
  const { data, updateData, setCurrentStep } = useHandover();
  const [hasUploaded, setHasUploaded] = useState(!!data.floorPlanUrl);
  const [newRoom, setNewRoom] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateData({ floorPlanUrl: url, rooms: DEFAULT_ROOMS });
      setHasUploaded(true);
    }
  };

  const handleUseMock = () => {
    updateData({ floorPlanUrl: 'mock', rooms: DEFAULT_ROOMS });
    setHasUploaded(true);
  };

  const addRoom = () => {
    if (!newRoom.trim()) return;
    const room = {
      id: Date.now().toString(),
      name: newRoom.trim(),
      x: Math.random() * 60 + 20,
      y: Math.random() * 60 + 20,
    };
    updateData({ rooms: [...(data.rooms || []), room] });
    setNewRoom('');
  };

  const removeRoom = (id: string) => {
    updateData({ rooms: data.rooms.filter(r => r.id !== id) });
  };

  if (!hasUploaded) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
        <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
          Grundriss-Setup
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-8 text-sm">
          Laden Sie einen Grundriss hoch oder nutzen Sie den Beispiel-Grundriss
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-md space-y-4"
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            className="glass-card rounded-2xl p-10 w-full border-2 border-dashed border-primary/30 hover:border-primary/50 transition-colors flex flex-col items-center gap-3"
          >
            <Upload className="w-10 h-10 text-primary/60" />
            <span className="text-sm font-medium">Grundriss hochladen</span>
            <span className="text-xs text-muted-foreground">JPG, PNG oder PDF</span>
          </button>

          <Button variant="outline" onClick={handleUseMock} className="w-full rounded-2xl h-12 gap-2">
            <Grid3X3 className="w-4 h-4" />
            Beispiel-Grundriss verwenden
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-6 text-center">
        Grundriss & Räume
      </motion.h2>

      {/* Mock floor plan */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-4 w-full max-w-md mb-6 relative aspect-[4/3] bg-secondary/30"
      >
        {/* Grid lines */}
        <div className="absolute inset-4 border border-border/50 rounded-xl">
          <div className="absolute top-0 left-1/2 w-px h-full bg-border/30" />
          <div className="absolute top-1/2 left-0 w-full h-px bg-border/30" />
        </div>
        {/* Room labels */}
        {data.rooms.map(room => (
          <div
            key={room.id}
            className="absolute flex items-center gap-1 bg-primary/10 rounded-lg px-2 py-1 text-xs font-medium"
            style={{ left: `${room.x}%`, top: `${room.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {room.name}
          </div>
        ))}
      </motion.div>

      {/* Room list */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="w-full max-w-md space-y-3">
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
          {data.rooms.map(room => (
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
