import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid, Plus, CheckCircle2, ArrowRight, AlertTriangle, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { RoomTile } from './roomDashboard/RoomTile';
import { RoomDetailSheet } from './roomDashboard/RoomDetailSheet';
import {
  RoomConfig, DEFAULT_INDOOR_ROOMS, EXTRA_INDOOR_ROOMS, OUTDOOR_AREAS
} from './roomDashboard/types';

export const StepRoomDashboard = () => {
  const { data, updateData, goToStepById } = useHandover();
  const { isMoveIn } = useTransactionLabels();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // ── Initialize rooms from contract data (roomCount) ──
  const rooms: RoomConfig[] = useMemo(() => {
    if (data.rooms && data.rooms.length > 0) {
      // If rooms already exist in context (with the new shape), use them
      return (data as any).__roomConfigs || getInitialRooms(data.roomCount);
    }
    return getInitialRooms(data.roomCount);
  }, []);

  const [roomConfigs, setRoomConfigs] = useState<RoomConfig[]>(() => {
    // Try to restore from handover data
    const stored = (data as any).__roomConfigs as RoomConfig[] | undefined;
    if (stored && stored.length > 0) return stored;
    return getInitialRooms(data.roomCount);
  });

  // Persist room configs to handover data
  const updateRooms = useCallback((newRooms: RoomConfig[]) => {
    setRoomConfigs(newRooms);
    updateData({ __roomConfigs: newRooms } as any);
  }, [updateData]);

  const activeRoom = roomConfigs.find(r => r.id === activeRoomId);

  const completedCount = roomConfigs.filter(r => r.completed).length;
  const totalDefects = data.findings.filter(f => f.entryType !== 'note').length;
  const totalWithholding = data.findings.filter(f => f.entryType !== 'note').reduce((s, f) => s + f.recommendedWithholding, 0);
  const allCompleted = roomConfigs.length > 0 && completedCount === roomConfigs.length;

  // Existing room names to prevent duplicates
  const existingNames = new Set(roomConfigs.map(r => r.name));

  const addRoom = useCallback((name: string, type: 'indoor' | 'outdoor', icon: string) => {
    if (existingNames.has(name)) return;
    const newRoom: RoomConfig = {
      id: `room-${Date.now()}`,
      name, type, icon,
      completed: false,
    };
    updateRooms([...roomConfigs, newRoom]);
    setShowAddMenu(false);
  }, [roomConfigs, existingNames, updateRooms]);

  const removeRoom = useCallback((id: string) => {
    updateRooms(roomConfigs.filter(r => r.id !== id));
  }, [roomConfigs, updateRooms]);

  const handleRoomUpdate = useCallback((roomId: string, patch: Partial<RoomConfig>) => {
    updateRooms(roomConfigs.map(r => r.id === roomId ? { ...r, ...patch } : r));
  }, [roomConfigs, updateRooms]);

  const handleRoomComplete = useCallback((roomId: string) => {
    updateRooms(roomConfigs.map(r => r.id === roomId ? { ...r, completed: true } : r));
    setActiveRoomId(null);
  }, [roomConfigs, updateRooms]);

  // ═══ ACTIVE ROOM DETAIL ═══
  if (activeRoom) {
    return (
      <RoomDetailSheet
        room={activeRoom}
        onClose={() => setActiveRoomId(null)}
        onUpdate={(patch) => handleRoomUpdate(activeRoom.id, patch)}
        onComplete={() => handleRoomComplete(activeRoom.id)}
      />
    );
  }

  // ═══ MAIN DASHBOARD ═══
  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <LayoutGrid className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Mission Control</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {isMoveIn ? 'Dokumentieren Sie den Zustand jedes Raums.' : 'Begehung: Prüfen und dokumentieren Sie jeden Raum.'}
        </p>
      </motion.div>

      {/* Progress bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="w-full max-w-md mb-6">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">{completedCount} von {roomConfigs.length} Räumen</span>
          {totalDefects > 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {totalDefects} Mängel
              {!isMoveIn && totalWithholding > 0 && ` · ${totalWithholding} €`}
            </span>
          )}
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-success rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${roomConfigs.length > 0 ? (completedCount / roomConfigs.length) * 100 : 0}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>

      {/* Room grid */}
      <div className="w-full max-w-md grid grid-cols-2 gap-3 mb-6">
        {roomConfigs.map((room, i) => (
          <RoomTile
            key={room.id}
            room={room}
            findings={data.findings}
            onClick={() => setActiveRoomId(room.id)}
            index={i}
          />
        ))}

        {/* Add room button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: roomConfigs.length * 0.04 }}
          onClick={() => setShowAddMenu(true)}
          className="glass-card rounded-2xl p-4 border-dashed border-2 border-border/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors min-h-[100px]"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs font-medium">Raum hinzufügen</span>
        </motion.button>
      </div>

      {/* Add room overlay */}
      <AnimatePresence>
        {showAddMenu && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
            onClick={() => setShowAddMenu(false)}
          >
            <motion.div
              initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
              onClick={e => e.stopPropagation()}
              className="bg-card w-full max-w-md rounded-t-3xl p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Raum / Bereich hinzufügen</h3>
                <button onClick={() => setShowAddMenu(false)} className="p-1 rounded-lg hover:bg-secondary/60"><X className="w-5 h-5" /></button>
              </div>

              {/* Indoor */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Innenräume</p>
                <div className="grid grid-cols-2 gap-2">
                  {[...DEFAULT_INDOOR_ROOMS, ...EXTRA_INDOOR_ROOMS]
                    .filter(r => !existingNames.has(r.name))
                    .map(r => (
                      <Button key={r.name} variant="outline" size="sm" className="rounded-xl text-xs justify-start h-9"
                        onClick={() => addRoom(r.name, 'indoor', r.icon)}>
                        <Plus className="w-3 h-3 mr-1.5" /> {r.name}
                      </Button>
                    ))}
                </div>
              </div>

              {/* Outdoor */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Außenbereiche</p>
                <div className="grid grid-cols-2 gap-2">
                  {OUTDOOR_AREAS.filter(r => !existingNames.has(r.name)).map(r => (
                    <Button key={r.name} variant="outline" size="sm" className="rounded-xl text-xs justify-start h-9"
                      onClick={() => addRoom(r.name, 'outdoor', r.icon)}>
                      <Plus className="w-3 h-3 mr-1.5" /> {r.name}
                    </Button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="w-full max-w-md">
        {allCompleted ? (
          <Button onClick={() => goToStepById('keys')} className="w-full h-12 rounded-2xl font-semibold gap-2" size="lg">
            Weiter zur Schlüssel-Inventur <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="outline" onClick={() => goToStepById('keys')}
            className="w-full h-12 rounded-2xl font-semibold text-muted-foreground">
            {completedCount === 0 ? 'Überspringen' : `Weiter (${roomConfigs.length - completedCount} offen)`}
          </Button>
        )}
      </motion.div>
    </div>
  );
};

// ── Helper: generate initial rooms from roomCount ──
function getInitialRooms(roomCountStr: string): RoomConfig[] {
  const count = parseInt(roomCountStr) || 2;
  const rooms: RoomConfig[] = [];

  // Always add Flur
  rooms.push({ id: 'room-flur', name: 'Flur', type: 'indoor', icon: 'DoorOpen', completed: false });

  // Add rooms based on count
  const availableRooms = [
    { name: 'Wohnzimmer', icon: 'Sofa' },
    { name: 'Schlafzimmer', icon: 'Bed' },
    { name: 'Küche', icon: 'CookingPot' },
    { name: 'Bad', icon: 'Bath' },
    { name: 'Kinderzimmer', icon: 'Baby' },
    { name: 'Arbeitszimmer', icon: 'Monitor' },
    { name: 'Gäste-WC', icon: 'Bath' },
  ];

  // count represents number of living rooms (Zimmer), add kitchen + bath automatically
  for (let i = 0; i < Math.min(count, availableRooms.length); i++) {
    rooms.push({
      id: `room-${availableRooms[i].name.toLowerCase()}`,
      name: availableRooms[i].name,
      type: 'indoor',
      icon: availableRooms[i].icon,
      completed: false,
    });
  }

  // If count is small (2 rooms), ensure Küche + Bad are included
  if (count <= 2) {
    if (!rooms.find(r => r.name === 'Küche')) {
      rooms.push({ id: 'room-küche', name: 'Küche', type: 'indoor', icon: 'CookingPot', completed: false });
    }
    if (!rooms.find(r => r.name === 'Bad')) {
      rooms.push({ id: 'room-bad', name: 'Bad', type: 'indoor', icon: 'Bath', completed: false });
    }
  }

  return rooms;
}

export default StepRoomDashboard;
