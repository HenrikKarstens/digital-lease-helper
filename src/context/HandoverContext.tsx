import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { getFilteredSteps as getFilteredStepsImported } from '@/hooks/useStepConfig';
import { idbPutMany, idbGetMany, idbClearAll } from '@/lib/indexedDbStorage';

export interface Participant {
  id: string;
  name: string;
  role: string;
  email?: string;
  present: boolean;
  signature?: string | null;
}

export type LegalClassification = 'Gebrauchsspur' | 'Schaden' | 'Normalverschleiß' | 'Vertragswidriger Schaden';
export type RemediationOption = 'self' | 'notice';

export type EntryType = 'defect' | 'note';

export interface PhotoGeoMeta {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  verified: boolean;
  distanceMeters: number | null;
}

export interface Finding {
  id: string;
  room: string;
  pinX: number;
  pinY: number;
  photoUrl?: string;
  photoGeo?: PhotoGeoMeta;
  sha256Hash?: string;
  material: string;
  damageType: string;
  bghReference: string;
  timeValueDeduction: number;
  recommendedWithholding: number;
  description: string;
  timestamp: string;
  locationDetail?: string;
  entryType?: EntryType; // 'defect' = Mangel (with cost), 'note' = Besonderheit (no cost)
  // Remediation fields
  legalClassification?: LegalClassification;
  remediationOption?: RemediationOption;
  remediationParty?: string;
  remediationDeadline?: string;
}

export interface MeterReading {
  id: string;
  medium: string;
  meterNumber: string;
  reading: string;
  unit: string;
  maloId: string;
  photoUrl?: string;
  photoGeo?: PhotoGeoMeta;
  sha256Hash?: string;
  source?: 'ai' | 'manual';
  aiConfidence?: 'high' | 'medium' | 'low';
  hkvRoomReadings?: HkvRoomReading[];
}

export interface DocumentPage {
  id: string;
  dataUrl: string;
  mimeType: string;
}

export interface CapturedDocument {
  id: string;
  type: 'main-contract' | 'amendment' | 'handover-protocol' | 'utility-bill';
  pages: DocumentPage[];
  analyzed: boolean;
  analysisSummary?: string;
}

export type DepositType = 'cash' | 'guarantee' | 'pledged-account';

export interface DeepClause {
  paragraphRef: string;
  title: string;
  originalText: string;
  status: 'SICHER' | 'KRITISCH' | 'UNWIRKSAM';
  legalBasis: string;
  reasoning: string;
  riskLevel: number;
  category: 'miete' | 'kaution' | 'nebenkosten' | 'reparaturen' | 'renovierung' | 'kuendigung' | 'nutzung' | 'sonstiges';
  isHandwritten?: boolean;
  handwrittenNote?: string;
  visuallyStricken?: boolean;
  strikeNote?: string;
  pageIndex?: number;
  detailLoaded?: boolean;
}

export interface DeltaComparison {
  room: string;
  element: string;
  moveInCondition: string;
  moveOutCondition: string;
  delta: 'unchanged' | 'new_damage' | 'pre_existing' | 'improved';
  liability: 'tenant' | 'none' | 'landlord';
  reasoning: string;
  severity: number;
}

export interface DeltaCheckResult {
  comparisons: DeltaComparison[];
  summary: {
    totalItems: number;
    preExisting: number;
    newDamages: number;
    unchanged: number;
    tenantLiabilityEstimate: string;
  };
}

export interface HkvRoomReading {
  id: string;
  room: string;
  meterNumber: string;
  reading: string;
}

export interface CancellationReminder {
  meterId: string;
  medium: string;
  recipientEmail: string;
  recipientName: string;
  scheduledAt: string;
  reminderSentAt?: string;
  followUpSentAt?: string;
  status: 'scheduled' | 'sent' | 'follow-up-sent';
}

export interface KeyEntry {
  id: string;
  type: string;
  count: number;
  note: string;
  condition: 'gut' | 'beschädigt' | 'fehlt' | '';
}

export interface HandoverData {
  // Step 1a/1b
  transactionType: 'rental' | 'sale' | null;
  handoverDirection: 'move-in' | 'move-out' | null;
  role: 'landlord' | 'tenant' | null;
  // Step 3-4 (document wizard)
  capturedDocuments: CapturedDocument[];
  // Step 3-4 (extracted data)
  propertyAddress: string;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  landlordBirthday: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantBirthday: string;
  priorAddress: string;
  nextAddress: string;
  depositAmount: string;
  contractStart: string;
  contractEnd: string;
  contractDuration: string;
  contractType: 'unbefristet' | 'befristet' | '';
  contractSigningDate: string;
  amendmentDate: string;
  coldRent: string;
  nkAdvancePayment: string;
  heatingCosts: string;
  totalRent: string;
  roomCount: string;
  preDamages: string;
  // AI analysis results
  depositLegalCheck: string;
  depositLegalStatus: 'safe' | 'warning' | 'invalid' | '';
  smallRepairAnalysis: string;
  smallRepairStatus: 'safe' | 'warning' | 'invalid' | '';
  endRenovationAnalysis: string;
  endRenovationStatus: 'safe' | 'warning' | 'invalid' | '';
  renovationClauseAnalysis: string;
  // Source references from contract paragraphs
  depositSourceRef: string;
  smallRepairSourceRef: string;
  endRenovationSourceRef: string;
  // Stricken clauses (user-marked as struck-through)
  strickenClauses: string[];
  // Deep paragraph analysis
  deepLegalClauses: DeepClause[];
  deepAnalysisComplete: boolean;
  // Delta-Check (move-in vs move-out)
  deltaCheckResult: DeltaCheckResult | null;
  // Step 5
  floorPlanUrl: string | null;
  rooms: { id: string; name: string; x: number; y: number }[];
  // Step 6
  participants: Participant[];
  attendancePhotoUrl: string | null;
  attendancePhotoGeo: PhotoGeoMeta | null;
  attendancePhotoHash: string | null;
  // Step 7
  findings: Finding[];
  // Step 8
  meterReadings: MeterReading[];
  // Step 9 – Schlüssel
  keyEntries: KeyEntry[];
  keyBundlePhotoUrl: string | null;
  keyBundlePhotoGeo: PhotoGeoMeta | null;
  keyBundlePhotoHash: string | null;
  // Step 9
  signatureLandlord: string | null;
  signatureTenant: string | null;
  // Step 10
  nkVorauszahlung: number;
  nkPrognose: number;
  nkRisiko: 'niedrig' | 'mittel' | 'hoch';
  // Step 12 – Kautionsart, Zinsberechnung & Zahlungsanweisung
  depositType: DepositType;
  depositPaymentMode: 'single' | 'installments';
  depositInstallmentDates: [string, string, string];
  guaranteeNumber: string;
  pledgedAccountBalance: string;
  depositPaymentDate: string;
  depositInterestRate: number;
  payeeIban: string;
  payeeBic: string;
  payeeBankName: string;
  payeeAccountHolder: string;
  ibanDeferred: boolean;
  // Step 10 – Anschlussvermietung
  immediateReletting: boolean;
  relettingDate: string;
  // Step 13
  protocolSent: boolean;
  previewViewed: boolean;
  // Paywall
  paymentStatus: 'unpaid' | 'paid';
  serviceCheckStatus: 'none' | 'completed';
  // Kautions-Schiedsrichter: beiderseitiges Anerkenntnis
  depositAgreementReached: boolean;
  depositAgreementTimestamp: string;
  tenantRefusesNewAddress: boolean;
  // Cancellation reminders (Phase 11)
  cancellationReminders: CancellationReminder[];
  // Condition checks (Phase 8 extension)
  cleaningBesenrein: boolean;
  cleaningBriefkasten: boolean;
  cleaningKeller: boolean;
  smokeDetectorChecked: boolean;
  wallsNeutralColors: boolean | null;
  geoPermissionDenied: boolean;
  geoPermissionGranted: boolean;
  // Move-in deposit (Phase 8 Einzug)
  moveInDepositType: 'cash' | 'guarantee' | 'account' | null;
  moveInDepositAmount: string;
  moveInInstallments: boolean;
  moveInFirstRateProofUrl: string | null;
  moveInGuaranteeProvider: string;
  moveInGuaranteeCertUrl: string | null;
  moveInPledgeDocUrl: string | null;
}

const STORAGE_KEY = 'estateturn_draft';

const defaultData: HandoverData = {
  transactionType: 'rental',
  handoverDirection: null,
  role: null,
  capturedDocuments: [],
  propertyAddress: '',
  landlordName: '',
  landlordEmail: '',
  landlordPhone: '',
  landlordBirthday: '',
  tenantName: '',
  tenantEmail: '',
  tenantPhone: '',
  tenantBirthday: '',
  priorAddress: '',
  nextAddress: '',
  depositAmount: '',
  coldRent: '',
  nkAdvancePayment: '',
  heatingCosts: '',
  totalRent: '',
  roomCount: '',
  contractDuration: '',
  contractType: '',
  contractSigningDate: '',
  amendmentDate: '',
  preDamages: '',
  contractStart: '',
  contractEnd: '',
  depositLegalCheck: '',
  depositLegalStatus: '',
  smallRepairAnalysis: '',
  smallRepairStatus: '',
  endRenovationAnalysis: '',
  endRenovationStatus: '',
  renovationClauseAnalysis: '',
  depositSourceRef: '',
  smallRepairSourceRef: '',
  endRenovationSourceRef: '',
  strickenClauses: [],
  deepLegalClauses: [],
  deepAnalysisComplete: false,
  deltaCheckResult: null,
  floorPlanUrl: null,
  rooms: [],
  participants: [],
  attendancePhotoUrl: null,
  attendancePhotoGeo: null,
  attendancePhotoHash: null,
  findings: [],
  meterReadings: [],
  keyEntries: [],
  keyBundlePhotoUrl: null,
  keyBundlePhotoGeo: null,
  keyBundlePhotoHash: null,
  signatureLandlord: null,
  signatureTenant: null,
  nkVorauszahlung: 150,
  nkPrognose: 210,
  nkRisiko: 'hoch',
  depositType: 'cash',
  depositPaymentMode: 'single',
  depositInstallmentDates: ['', '', ''],
  guaranteeNumber: '',
  pledgedAccountBalance: '',
  depositPaymentDate: '',
  depositInterestRate: 0.5,
  payeeIban: '',
  payeeBic: '',
  payeeBankName: '',
  payeeAccountHolder: '',
  ibanDeferred: false,
  immediateReletting: false,
  relettingDate: '',
  protocolSent: false,
  previewViewed: false,
  paymentStatus: 'unpaid',
  serviceCheckStatus: 'none',
  depositAgreementReached: false,
  depositAgreementTimestamp: '',
  cancellationReminders: [],
  tenantRefusesNewAddress: false,
  cleaningBesenrein: false,
  cleaningBriefkasten: false,
  cleaningKeller: false,
  smokeDetectorChecked: false,
  wallsNeutralColors: null,
  geoPermissionDenied: false,
  geoPermissionGranted: false,
  moveInDepositType: null,
  moveInDepositAmount: '',
  moveInInstallments: false,
  moveInFirstRateProofUrl: null,
  moveInGuaranteeProvider: '',
  moveInGuaranteeCertUrl: null,
  moveInPledgeDocUrl: null,
};

interface HandoverContextType {
  data: HandoverData;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  goToStepById: (stepId: string) => void;
  updateData: (partial: Partial<HandoverData>) => void;
  resetData: () => void;
  loadProject: (savedData: Partial<HandoverData>, step: number) => void;
}

const HandoverContext = createContext<HandoverContextType | undefined>(undefined);

/** Collect all base64 data URLs from HandoverData into key-value pairs for IndexedDB */
function collectBlobs(data: HandoverData): [string, string | null][] {
  const entries: [string, string | null][] = [];
  // Top-level photo fields
  const photoFields: (keyof HandoverData)[] = [
    'keyBundlePhotoUrl', 'floorPlanUrl', 'attendancePhotoUrl',
    'signatureLandlord', 'signatureTenant',
  ];
  for (const field of photoFields) {
    const val = data[field] as string | null;
    entries.push([`photo:${field}`, val?.startsWith('data:') ? val : null]);
  }
  // Finding photos
  data.findings.forEach((f, i) => {
    entries.push([`photo:finding:${f.id}`, f.photoUrl?.startsWith('data:') ? f.photoUrl : null]);
  });
  // Meter reading photos
  data.meterReadings.forEach((m) => {
    entries.push([`photo:meter:${m.id}`, m.photoUrl?.startsWith('data:') ? m.photoUrl : null]);
  });
  // Document pages
  data.capturedDocuments.forEach((d) => {
    d.pages.forEach((p) => {
      entries.push([`photo:doc:${d.id}:${p.id}`, p.dataUrl?.startsWith('data:') ? p.dataUrl : null]);
    });
  });
  return entries;
}

/** Restore base64 blobs from IndexedDB into HandoverData */
async function restoreBlobs(data: HandoverData): Promise<HandoverData> {
  const keys: string[] = [];
  const photoFields: (keyof HandoverData)[] = [
    'keyBundlePhotoUrl', 'floorPlanUrl', 'attendancePhotoUrl',
    'signatureLandlord', 'signatureTenant',
  ];
  for (const field of photoFields) keys.push(`photo:${field}`);
  data.findings.forEach(f => keys.push(`photo:finding:${f.id}`));
  data.meterReadings.forEach(m => keys.push(`photo:meter:${m.id}`));
  data.capturedDocuments.forEach(d => d.pages.forEach(p => keys.push(`photo:doc:${d.id}:${p.id}`)));

  if (keys.length === 0) return data;
  const blobs = await idbGetMany(keys);

  const restored = { ...data };
  for (const field of photoFields) {
    const val = blobs[`photo:${field}`];
    if (val) (restored as any)[field] = val;
  }
  restored.findings = data.findings.map(f => ({
    ...f,
    photoUrl: blobs[`photo:finding:${f.id}`] || f.photoUrl,
  }));
  restored.meterReadings = data.meterReadings.map(m => ({
    ...m,
    photoUrl: blobs[`photo:meter:${m.id}`] || m.photoUrl,
  }));
  restored.capturedDocuments = data.capturedDocuments.map(d => ({
    ...d,
    pages: d.pages.map(p => ({
      ...p,
      dataUrl: blobs[`photo:doc:${d.id}:${p.id}`] || p.dataUrl,
    })),
  }));
  return restored;
}

export const HandoverProvider = ({ children }: { children: ReactNode }) => {
  // Restore from localStorage on mount (without blobs – those come from IndexedDB)
  const [data, setData] = useState<HandoverData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultData, ...parsed.data };
      }
    } catch {}
    return defaultData;
  });
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).step || 0;
    } catch {}
    return 0;
  });

  const idbRestoreDone = useRef(false);

  // Restore blobs from IndexedDB on mount (one-time)
  useEffect(() => {
    if (idbRestoreDone.current) return;
    idbRestoreDone.current = true;
    restoreBlobs(data).then(restored => {
      // Only update if something actually changed
      if (JSON.stringify(restored) !== JSON.stringify(data)) {
        setData(restored);
      }
    }).catch(e => console.warn('[IDB] restore failed:', e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: localStorage gets stripped metadata, IndexedDB gets the blobs
  useEffect(() => {
    try {
      // Strip base64 data URLs from localStorage to stay within ~5 MB quota
      const stripped = {
        ...data,
        keyBundlePhotoUrl: data.keyBundlePhotoUrl?.startsWith('data:') ? '__photo_captured__' : data.keyBundlePhotoUrl,
        floorPlanUrl: data.floorPlanUrl?.startsWith('data:') ? '__photo_captured__' : data.floorPlanUrl,
        attendancePhotoUrl: data.attendancePhotoUrl?.startsWith('data:') ? '__photo_captured__' : data.attendancePhotoUrl,
        signatureLandlord: data.signatureLandlord?.startsWith('data:') ? '__sig_captured__' : data.signatureLandlord,
        signatureTenant: data.signatureTenant?.startsWith('data:') ? '__sig_captured__' : data.signatureTenant,
        findings: data.findings.map(f => ({
          ...f,
          photoUrl: f.photoUrl?.startsWith('data:') ? '__photo_captured__' : f.photoUrl,
        })),
        meterReadings: data.meterReadings.map(m => ({
          ...m,
          photoUrl: m.photoUrl?.startsWith('data:') ? '__photo_captured__' : m.photoUrl,
        })),
        capturedDocuments: data.capturedDocuments.map(d => ({
          ...d,
          pages: d.pages.map(p => ({
            ...p,
            dataUrl: p.dataUrl?.startsWith('data:') ? '__photo_captured__' : p.dataUrl,
          })),
        })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: stripped, step: currentStep }));
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }

    // Save blobs to IndexedDB (async, non-blocking)
    const blobs = collectBlobs(data);
    const nonNullBlobs = blobs.filter(([, v]) => v !== null);
    if (nonNullBlobs.length > 0) {
      idbPutMany(blobs).catch(e => console.warn('[IDB] save failed:', e));
    }
  }, [data, currentStep]);

  const updateData = useCallback((partial: Partial<HandoverData>) => {
    setData(prev => ({ ...prev, ...partial }));
  }, []);

  const resetData = useCallback(() => {
    setData(defaultData);
    setCurrentStep(0);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    idbClearAll().catch(e => console.warn('[IDB] clear failed:', e));
  }, []);

  const loadProject = useCallback((savedData: Partial<HandoverData>, step: number) => {
    setData({ ...defaultData, ...savedData });
    setCurrentStep(step);
  }, []);

  // Navigate by step ID using the filtered step config
  // If the target step is filtered out, advance to the next available step in the master order
  const goToStepById = useCallback((stepId: string) => {
    const steps = getFilteredStepsImported(data.transactionType, data.handoverDirection);
    const idx = steps.findIndex((s: { id: string }) => s.id === stepId);
    if (idx >= 0) {
      setCurrentStep(idx);
    } else {
      const MASTER_ORDER = [
        'hero', 'role', 'direction', 'data-check',
        'participants', 'room-dashboard', 'keys', 'meters', 'forwarding-address', 'deposit-check', 'data-complete',
        'defect-analysis', 'utility', 'unlock'
      ];
      const masterIdx = MASTER_ORDER.indexOf(stepId);
      for (let i = masterIdx + 1; i < MASTER_ORDER.length; i++) {
        const nextIdx = steps.findIndex((s: { id: string }) => s.id === MASTER_ORDER[i]);
        if (nextIdx >= 0) {
          setCurrentStep(nextIdx);
          return;
        }
      }
      setCurrentStep(steps.length - 1);
    }
  }, [data.transactionType, data.handoverDirection]);

  const contextValue = useMemo(() => ({
    data, currentStep, setCurrentStep, goToStepById, updateData, resetData, loadProject
  }), [data, currentStep, goToStepById, updateData, resetData, loadProject]);

  return (
    <HandoverContext.Provider value={contextValue}>
      {children}
    </HandoverContext.Provider>
  );
};

export const useHandover = () => {
  const context = useContext(HandoverContext);
  if (!context) throw new Error('useHandover must be used within HandoverProvider');
  return context;
};
