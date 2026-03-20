import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, Camera,
  DoorOpen, Sofa, Bed, CookingPot, Bath, Baby, Archive, Monitor,
  Sun, Trees, Car, ArrowDownToLine, ArrowUpToLine, Home
} from 'lucide-react';
import type { RoomConfig } from './types';
import type { Finding } from '@/context/HandoverContext';

const ICON_MAP: Record<string, React.ElementType> = {
  DoorOpen, Sofa, Bed, CookingPot, Bath, Baby, Archive, Monitor,
  Sun, Trees, Car, ArrowDownToLine, ArrowUpToLine, Home,
};

interface RoomTileProps {
  room: RoomConfig;
  findings: Finding[];
  onClick: () => void;
  index: number;
}

export const RoomTile = memo(({ room, findings, onClick, index }: RoomTileProps) => {
  const Icon = ICON_MAP[room.icon] || Home;
  const defectCount = findings.filter(f => f.room === room.name && f.entryType !== 'note').length;
  const noteCount = findings.filter(f => f.room === room.name && f.entryType === 'note').length;
  const totalFindings = findings.filter(f => f.room === room.name).length;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={`relative glass-card rounded-2xl p-4 text-left transition-all hover:shadow-md active:scale-[0.98] ${
        room.completed
          ? 'border-success/40 bg-success/5'
          : 'border-border/50'
      }`}
    >
      {/* Status badge */}
      <div className="absolute top-2.5 right-2.5">
        {room.completed ? (
          <CheckCircle2 className="w-5 h-5 text-success" />
        ) : room.overviewPhotoUrl ? (
          <div className="w-2 h-2 rounded-full bg-amber-400" />
        ) : null}
      </div>

      {/* Overview photo thumbnail or icon */}
      {(room.overviewPhotos?.length || room.overviewPhotoUrl) ? (
        <div className="relative w-10 h-10 rounded-xl overflow-hidden mb-2 border border-border/30">
          <img src={room.overviewPhotos?.[0]?.url || room.overviewPhotoUrl} alt={room.name} className="w-full h-full object-cover" />
          {(room.overviewPhotos?.length || 0) > 1 && (
            <span className="absolute bottom-0 right-0 text-[8px] font-bold bg-background/80 px-1 rounded-tl-md">{room.overviewPhotos!.length}</span>
          )}
        </div>
      ) : (
        <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center mb-2">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      )}

      <p className="text-sm font-semibold truncate">{room.name}</p>

      {/* Stats row */}
      <div className="flex items-center gap-2 mt-1.5">
        {defectCount > 0 && (
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" /> {defectCount}
          </span>
        )}
        {noteCount > 0 && (
          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
            {noteCount} Notiz{noteCount > 1 ? 'en' : ''}
          </span>
        )}
        {totalFindings === 0 && !room.completed && (
          <span className="text-[10px] text-muted-foreground">Offen</span>
        )}
        {room.completed && totalFindings === 0 && (
          <span className="text-[10px] text-success font-medium">Keine Befunde</span>
        )}
      </div>
    </motion.button>
  );
});
RoomTile.displayName = 'RoomTile';
