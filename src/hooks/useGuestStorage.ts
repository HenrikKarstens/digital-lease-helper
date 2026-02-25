import { HandoverData } from '@/context/HandoverContext';

const GUEST_PROJECT_KEY = 'estateturn_guest_project';
const GUEST_STEP_KEY = 'estateturn_guest_step';

/** Strip large base64 data before persisting to stay within ~5 MB quota */
const stripBase64 = (data: HandoverData): Record<string, unknown> => ({
  ...data,
  keyBundlePhotoUrl: data.keyBundlePhotoUrl?.startsWith('data:') ? null : data.keyBundlePhotoUrl,
  floorPlanUrl: data.floorPlanUrl?.startsWith('data:') ? null : data.floorPlanUrl,
  attendancePhotoUrl: data.attendancePhotoUrl?.startsWith('data:') ? null : data.attendancePhotoUrl,
  signatureLandlord: data.signatureLandlord?.startsWith('data:') ? null : data.signatureLandlord,
  signatureTenant: data.signatureTenant?.startsWith('data:') ? null : data.signatureTenant,
  findings: data.findings.map(f => ({
    ...f,
    photoUrl: f.photoUrl?.startsWith('data:') ? null : f.photoUrl,
  })),
  meterReadings: data.meterReadings.map(m => ({
    ...m,
    photoUrl: m.photoUrl?.startsWith('data:') ? null : m.photoUrl,
  })),
  capturedDocuments: data.capturedDocuments.map(d => ({
    ...d,
    pages: d.pages.map(p => ({
      ...p,
      dataUrl: p.dataUrl?.startsWith('data:') ? null : p.dataUrl,
    })),
  })),
});

export const saveGuestProject = (data: HandoverData, step: number) => {
  try {
    localStorage.setItem(GUEST_PROJECT_KEY, JSON.stringify(stripBase64(data)));
    localStorage.setItem(GUEST_STEP_KEY, String(step));
  } catch (e) {
    // If still over quota, clear old data and retry once
    try {
      localStorage.removeItem(GUEST_PROJECT_KEY);
      localStorage.setItem(GUEST_PROJECT_KEY, JSON.stringify(stripBase64(data)));
      localStorage.setItem(GUEST_STEP_KEY, String(step));
    } catch {
      console.warn('localStorage quota exceeded, could not save guest project');
    }
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
