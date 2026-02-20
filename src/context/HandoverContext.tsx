import React, { createContext, useContext, useState, ReactNode } from 'react';

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

export interface Finding {
  id: string;
  room: string;
  pinX: number;
  pinY: number;
  photoUrl?: string;
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
  tenantName: string;
  tenantEmail: string;
  depositAmount: string;
  contractStart: string;
  contractEnd: string;
  coldRent: string;
  nkAdvancePayment: string;
  preDamages: string;
  // AI analysis results
  depositLegalCheck: string;
  renovationClauseAnalysis: string;
  // Step 5
  floorPlanUrl: string | null;
  rooms: { id: string; name: string; x: number; y: number }[];
  // Step 6
  participants: Participant[];
  attendancePhotoUrl: string | null;
  // Step 7
  findings: Finding[];
  // Step 8
  meterReadings: MeterReading[];
  // Step 9
  signatureLandlord: string | null;
  signatureTenant: string | null;
  // Step 10
  nkVorauszahlung: number;
  nkPrognose: number;
  nkRisiko: 'niedrig' | 'mittel' | 'hoch';
  // Step 12 – Kautionsart, Zinsberechnung & Zahlungsanweisung
  depositType: DepositType;
  guaranteeNumber: string;          // Bürgschaftsurkunde Nr.
  pledgedAccountBalance: string;    // Aktueller Stand inkl. Zinsen laut Sparbuch
  depositPaymentDate: string;       // Datum der Kautionszahlung
  depositInterestRate: number;      // Zinssatz in % (z.B. 1.5)
  payeeIban: string;                // IBAN des Empfängers
  payeeAccountHolder: string;       // Kontoinhaber des Empfängers
  // Step 10 – Anschlussvermietung
  immediateReletting: boolean;       // Sofortige Anschlussvermietung (Einzug < 7 Tage)
  relettingDate: string;             // Datum des Neueinzugs
  // Step 13
  protocolSent: boolean;
}

const defaultData: HandoverData = {
  transactionType: null,
  handoverDirection: null,
  role: null,
  capturedDocuments: [],
  propertyAddress: '',
  landlordName: '',
  landlordEmail: '',
  tenantName: '',
  tenantEmail: '',
  depositAmount: '',
  coldRent: '',
  nkAdvancePayment: '',
  preDamages: '',
  contractStart: '',
  contractEnd: '',
  depositLegalCheck: '',
  renovationClauseAnalysis: '',
  floorPlanUrl: null,
  rooms: [],
  participants: [],
  attendancePhotoUrl: null,
  findings: [],
  meterReadings: [],
  signatureLandlord: null,
  signatureTenant: null,
  nkVorauszahlung: 150,
  nkPrognose: 210,
  nkRisiko: 'hoch',
  depositType: 'cash',
  guaranteeNumber: '',
  pledgedAccountBalance: '',
  depositPaymentDate: '',
  depositInterestRate: 1.5,
  payeeIban: '',
  payeeAccountHolder: '',
  immediateReletting: false,
  relettingDate: '',
  protocolSent: false,
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

export const HandoverProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<HandoverData>(defaultData);
  const [currentStep, setCurrentStep] = useState(0);

  const updateData = (partial: Partial<HandoverData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const resetData = () => {
    setData(defaultData);
    setCurrentStep(0);
  };

  const loadProject = (savedData: Partial<HandoverData>, step: number) => {
    setData({ ...defaultData, ...savedData });
    setCurrentStep(step);
  };

  // Navigate by step ID using the filtered step config
  // If the target step is filtered out, advance to the next available step in the master order
  const goToStepById = (stepId: string) => {
    const { getFilteredSteps } = require('@/hooks/useStepConfig');
    const steps = getFilteredSteps(data.transactionType, data.handoverDirection);
    const idx = steps.findIndex((s: { id: string }) => s.id === stepId);
    if (idx >= 0) {
      setCurrentStep(idx);
    } else {
      // Step filtered out: find the next step in master order after the requested one
      const MASTER_ORDER = [
        'hero', 'transaction-type', 'role', 'direction', 'smart-entry', 'validation',
        'floor-plan', 'participants', 'evidence', 'meters', 'defect-analysis',
        'deposit', 'certificate', 'utility'
      ];
      const masterIdx = MASTER_ORDER.indexOf(stepId);
      // Find the next step that exists in the filtered list
      for (let i = masterIdx + 1; i < MASTER_ORDER.length; i++) {
        const nextIdx = steps.findIndex((s: { id: string }) => s.id === MASTER_ORDER[i]);
        if (nextIdx >= 0) {
          setCurrentStep(nextIdx);
          return;
        }
      }
      // Fallback: go to last step
      setCurrentStep(steps.length - 1);
    }
  };

  return (
    <HandoverContext.Provider value={{ data, currentStep, setCurrentStep, goToStepById, updateData, resetData, loadProject }}>
      {children}
    </HandoverContext.Provider>
  );
};

export const useHandover = () => {
  const context = useContext(HandoverContext);
  if (!context) throw new Error('useHandover must be used within HandoverProvider');
  return context;
};
