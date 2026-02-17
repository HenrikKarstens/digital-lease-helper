import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Participant {
  id: string;
  name: string;
  role: string;
  email?: string;
  present: boolean;
}

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

export interface HandoverData {
  // Step 1a/1b
  transactionType: 'rental' | 'sale' | null;
  handoverDirection: 'move-in' | 'move-out' | null;
  role: 'landlord' | 'tenant' | null;
  // Step 3-4
  propertyAddress: string;
  landlordName: string;
  landlordEmail: string;
  tenantName: string;
  tenantEmail: string;
  depositAmount: string;
  contractStart: string;
  contractEnd: string;
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
  // Step 13
  protocolSent: boolean;
}

const defaultData: HandoverData = {
  transactionType: null,
  handoverDirection: null,
  role: null,
  propertyAddress: '',
  landlordName: '',
  landlordEmail: '',
  tenantName: '',
  tenantEmail: '',
  depositAmount: '',
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
  protocolSent: false,
};

interface HandoverContextType {
  data: HandoverData;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  updateData: (partial: Partial<HandoverData>) => void;
  resetData: () => void;
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

  return (
    <HandoverContext.Provider value={{ data, currentStep, setCurrentStep, updateData, resetData }}>
      {children}
    </HandoverContext.Provider>
  );
};

export const useHandover = () => {
  const context = useContext(HandoverContext);
  if (!context) throw new Error('useHandover must be used within HandoverProvider');
  return context;
};
