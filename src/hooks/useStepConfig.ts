import { useHandover } from '@/context/HandoverContext';

export interface StepDef {
  id: string;
  label: string;
  component: string; // component key used in ProjectView
}

// All possible steps with their IDs
const ALL_STEPS: StepDef[] = [
  { id: 'hero',              label: 'Start',       component: 'Step1Hero' },
  { id: 'role',              label: 'Rolle',       component: 'Step2Role' },
  { id: 'direction',         label: 'Richtung',    component: 'Step1cDirection' },
  { id: 'data-check',        label: 'Daten-Check', component: 'Step4Validation' },
  
  { id: 'participants',      label: 'Teilnehmer',  component: 'Step6Participants' },
  { id: 'evidence',          label: 'Beweis',       component: 'Step7Evidence' },
  { id: 'keys',              label: 'Schlüssel',    component: 'Step9Keys' },
  { id: 'meters',            label: 'Zähler',       component: 'Step8MeterScan' },
  { id: 'deposit-check',     label: 'Kautionscheck', component: 'StepDepositCheck' },
  { id: 'data-complete',     label: 'Abschluss',    component: 'Step10DataComplete' },
  { id: 'defect-analysis',   label: 'Mängel',       component: 'Step10DefectAnalysis' },
  { id: 'utility',           label: 'Versorger',    component: 'Step14Utility' },
  { id: 'unlock',            label: 'Freischaltung', component: 'Step12Unlock' },
];

/**
 * Returns the filtered list of steps based on transactionType and handoverDirection.
 *
 * Rental Move-In:  No defect-analysis, no deposit → ~10 steps
 * Rental Move-Out: Full flow → 14 steps
 * Sale (both):     No deposit, no direction step → ~11 steps
 */
export function getFilteredSteps(
  transactionType: 'rental' | 'sale' | null,
  handoverDirection: 'move-in' | 'move-out' | null
): StepDef[] {
  return ALL_STEPS.filter(step => {
    // Sale: no direction step (simultaneous), no deposit/kaution
    if (transactionType === 'sale') {
      if (step.id === 'direction') return false;
    }

    // Rental Move-In: no defect-analysis, no deposit, no deposit-check, no utility (no Auszug)
    if (transactionType === 'rental' && handoverDirection === 'move-in') {
      if (step.id === 'defect-analysis') return false;
      if (step.id === 'deposit-check') return false;
      if (step.id === 'utility') return false;
    }

    // Rental Move-Out: no data-complete, no separate defect-analysis (integrated in deposit-check)
    if (transactionType === 'rental' && handoverDirection === 'move-out') {
      if (step.id === 'data-complete') return false;
      if (step.id === 'defect-analysis') return false;
    }

    // Sale: no deposit-check (only for rental move-out), no utility
    if (transactionType === 'sale') {
      if (step.id === 'deposit-check') return false;
      if (step.id === 'utility') return false;
    }

    return true;
  });
}

export const useStepConfig = () => {
  const { data } = useHandover();
  const steps = getFilteredSteps(data.transactionType, data.handoverDirection);

  return {
    steps,
    totalSteps: steps.length,
    /** Given a filtered index, return the step definition */
    getStep: (index: number) => steps[index] || steps[0],
    /** Find the filtered index for a given step ID */
    findIndex: (id: string) => steps.findIndex(s => s.id === id),
  };
};
