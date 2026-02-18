import { HandoverData } from '@/context/HandoverContext';

const GUEST_PROJECT_KEY = 'estateturn_guest_project';
const GUEST_STEP_KEY = 'estateturn_guest_step';

export const saveGuestProject = (data: HandoverData, step: number) => {
  try {
    localStorage.setItem(GUEST_PROJECT_KEY, JSON.stringify(data));
    localStorage.setItem(GUEST_STEP_KEY, String(step));
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
};

export const loadGuestProject = (): { data: Partial<HandoverData>; step: number } | null => {
  try {
    const raw = localStorage.getItem(GUEST_PROJECT_KEY);
    const step = localStorage.getItem(GUEST_STEP_KEY);
    if (!raw) return null;
    return { data: JSON.parse(raw), step: Number(step) || 0 };
  } catch (e) {
    console.warn('Failed to parse guest project:', e);
    return null;
  }
};

export const clearGuestProject = () => {
  localStorage.removeItem(GUEST_PROJECT_KEY);
  localStorage.removeItem(GUEST_STEP_KEY);
};

export const getGuestProjectData = (): HandoverData | null => {
  try {
    const raw = localStorage.getItem(GUEST_PROJECT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
