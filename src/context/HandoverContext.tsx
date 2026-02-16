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

export interface HandoverData {
  // Step 2
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
  // Step 5
  floorPlanUrl: string | null;
  rooms: { id: string; name: string; x: number; y: number }[];
  // Step 6
  participants: Participant[];
  attendancePhotoUrl: string | null;
  // Step 7
  findings: Finding[];
}

const defaultData: HandoverData = {
  role: null,
  propertyAddress: '',
  landlordName: '',
  landlordEmail: '',
  tenantName: '',
  tenantEmail: '',
  depositAmount: '',
  contractStart: '',
  contractEnd: '',
  floorPlanUrl: null,
  rooms: [],
  participants: [],
  attendancePhotoUrl: null,
  findings: [],
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
