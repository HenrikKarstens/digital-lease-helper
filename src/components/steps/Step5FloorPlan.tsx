import { useEffect } from 'react';
import { useHandover } from '@/context/HandoverContext';

export const Step5FloorPlan = () => {
  const { goToStepById } = useHandover();

  useEffect(() => {
    goToStepById('participants');
  }, []);

  return null;
};
