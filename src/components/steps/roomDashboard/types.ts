export interface RoomConfig {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor';
  icon: string; // lucide icon key
  overviewPhotoUrl?: string;
  overviewPhotoTimestamp?: string;
  completed: boolean;
  // Per-room condition checks (move-out only)
  cleaningDone?: boolean;
  smokeDetectorOk?: boolean;
  wallsNeutral?: boolean | null;
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
