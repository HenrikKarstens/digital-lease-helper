import { useHandover } from '@/context/HandoverContext';

export const useTransactionLabels = () => {
  const { data } = useHandover();
  const isSale = data.transactionType === 'sale';
  const isMoveIn = data.handoverDirection === 'move-in';

  return {
    contractLabel: isSale ? 'Kaufvertrag' : 'Mietvertrag',
    contractLabelShort: isSale ? 'Vertrag' : 'Mietvertrag',
    ownerLabel: isSale ? 'Verkäuferseite' : 'Vermieterseite',
    clientLabel: isSale ? 'Käuferseite' : 'Mieterseite',
    ownerRole: isSale ? 'Verkäufer' : 'Vermieter',
    clientRole: isSale ? 'Käufer' : 'Mieter',
    depositLabel: isSale ? 'Kaufpreisrestbetrag' : 'Kaution',
    handoverLabel: isSale ? 'Objektübergabe' : 'Wohnungsübergabe',
    contractStartLabel: isSale ? 'Übergabedatum' : 'Vertragsbeginn',
    contractEndLabel: isSale ? 'Stichtag' : 'Vertragsende',
    cancellationTarget: isSale ? 'Vorbesitzer' : 'Altmieter',
    evidenceTitle: isMoveIn ? 'Dokumentation des Zustands bei Einzug' : 'Beweissicherung',
    evidenceSubtitle: isMoveIn
      ? 'Dokumentieren Sie den aktuellen Zustand zum Schutz vor künftigen Forderungen'
      : 'Tippen Sie auf den Grundriss, um einen Mangel zu dokumentieren',
    isSale,
    isMoveIn,
  };
};
