import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import type { DocStep } from './types';

export const useDocumentSteps = (): DocStep[] => {
  const { data } = useHandover();
  const { contractLabel, isSale } = useTransactionLabels();
  const isMoveOut = data.handoverDirection === 'move-out';

  const isMoveIn = data.handoverDirection === 'move-in';

  // For rental move-in: only show the main contract
  const isRentalMoveIn = !isSale && isMoveIn;

  const allSteps: DocStep[] = [
    {
      id: 'main-contract',
      title: contractLabel,
      subtitle: isRentalMoveIn
        ? 'Laden Sie Ihren neuen Mietvertrag hoch, um Stammdaten automatisch zu erfassen.'
        : isSale
          ? 'Kaufvertrag oder notarielle Urkunde'
          : 'Hauptmietvertrag inkl. aller Anlagen',
      icon: '📄',
      optional: false,
    },
    {
      id: 'amendment',
      title: 'Nachträge',
      subtitle: 'Mietanpassungen, NK-Änderungen, Sondervereinbarungen',
      icon: '📝',
      optional: true,
      relevantFor: 'move-out',
    },
    {
      id: 'handover-protocol',
      title: 'Vor-Protokoll',
      subtitle: isMoveOut
        ? 'Einzugsprotokoll – entscheidend für die Bewertung von Schäden'
        : 'Vorheriges Übergabeprotokoll (falls vorhanden)',
      icon: '🔍',
      optional: true,
      relevantFor: 'move-out',
    },
    {
      id: 'utility-bill',
      title: 'Nebenkostenabrechnung',
      subtitle: 'Letzte NK-Abrechnung zur Puffer-Prüfung',
      icon: '💡',
      optional: true,
      relevantFor: 'move-out',
    },
  ];

  // For rental move-in: only main-contract. For move-in generally: hide move-out-only steps.
  const steps = allSteps.filter(s => {
    if (isRentalMoveIn && s.id !== 'main-contract') return false;
    if (s.relevantFor === 'move-out' && isMoveIn) return false;
    return true;
  });

  return steps;
};
