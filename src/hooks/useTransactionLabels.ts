import { useHandover } from '@/context/HandoverContext';

export const useTransactionLabels = () => {
  const { data } = useHandover();
  const isSale = data.transactionType === 'sale';

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
    isSale,
  };
};
