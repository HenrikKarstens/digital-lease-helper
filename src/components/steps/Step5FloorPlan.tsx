import { useEffect } from 'react';
import { useHandover } from '@/context/HandoverContext';

export const Step5FloorPlan = () => {
  const { setCurrentStep } = useHandover();

  useEffect(() => {
    setCurrentStep(7);
  }, []);

  return null;
};
