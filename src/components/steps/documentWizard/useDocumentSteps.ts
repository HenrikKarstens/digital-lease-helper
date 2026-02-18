import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import type { DocStep } from './types';

export const useDocumentSteps = (): DocStep[] => {
  const { data } = useHandover();
  const { contractLabel, isSale } = useTransactionLabels();
  const isMoveOut = data.handoverDirection === 'move-out';

  const isMoveIn = data.handoverDirection === 'move-in';

  const allSteps: DocStep[] = [
    {
      id: 'main-contract',
      title: contractLabel,
      subtitle: isSale
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
    },
  ];

  // Hide handover-protocol for move-in (only relevant for move-out)
  const steps = allSteps.filter(s => {
    if (s.id === 'handover-protocol' && isMoveIn) return false;
    return true;
  });

  return steps;
};
