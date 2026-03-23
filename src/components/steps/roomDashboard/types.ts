export type TechCheckStatus = 'ok' | 'nv' | 'ng' | null;

export interface TechCheckValue {
  status: TechCheckStatus;
  comment?: string; // Required when status === 'ng'
}

export interface RoomConfig {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor';
  icon: string; // lucide icon key
  overviewPhotos?: { url: string; timestamp: string }[];
  /** @deprecated use overviewPhotos instead */
  overviewPhotoUrl?: string;
  overviewPhotoTimestamp?: string;
  completed: boolean;
  // Per-room condition checks (move-out only)
  cleaningDone?: boolean;
  smokeDetectorOk?: boolean;
  wallsNeutral?: boolean | null;
  // Technical function checks (3-status)
  windowsDoors?: TechCheckValue;
  sanitary?: TechCheckValue;
  electrical?: TechCheckValue;
  smokeDetector?: TechCheckValue;
  // Kitchen-specific
  oven?: TechCheckValue;
  sinkDrain?: TechCheckValue;
  // Bathroom-specific
  tilesGrout?: TechCheckValue;
  flushFittings?: TechCheckValue;

  // Legacy boolean fields (deprecated, kept for migration)
  windowsDoorsFunctional?: boolean;
  sanitaryTight?: boolean;
  electricalOk?: boolean;
  ovenFunctional?: boolean;
  sinkDrainClear?: boolean;
  tilesGroutIntact?: boolean;
  flushFittingsOk?: boolean;
}

export const DEFAULT_INDOOR_ROOMS = [
  { name: 'Flur', icon: 'DoorOpen' },
  { name: 'Wohnzimmer', icon: 'Sofa' },
  { name: 'Schlafzimmer', icon: 'Bed' },
  { name: 'Küche', icon: 'CookingPot' },
  { name: 'Bad', icon: 'Bath' },
];

export const EXTRA_INDOOR_ROOMS = [
  { name: 'Kinderzimmer', icon: 'Baby' },
  { name: 'Gäste-WC', icon: 'Bath' },
  { name: 'Abstellraum', icon: 'Archive' },
  { name: 'Arbeitszimmer', icon: 'Monitor' },
];

export const OUTDOOR_AREAS = [
  { name: 'Balkon/Terrasse', icon: 'Sun' },
  { name: 'Garten', icon: 'Trees' },
  { name: 'Garage', icon: 'Car' },
  { name: 'Keller', icon: 'ArrowDownToLine' },
  { name: 'Dachboden', icon: 'ArrowUpToLine' },
];
