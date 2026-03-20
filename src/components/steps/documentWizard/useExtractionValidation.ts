import { useMemo } from 'react';
import type { HandoverData } from '@/context/HandoverContext';

interface ExtractedField {
  key: string;
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'error';
  hint?: string;
}

interface ValidationWarning {
  type: 'deposit' | 'date' | 'missing';
  title: string;
  description: string;
  severity: 'warning' | 'error';
  legalRef?: string;
}

export const useExtractionValidation = (data: HandoverData) => {
  return useMemo(() => {
    const coldRent = parseFloat(data.coldRent) || 0;
    const deposit = parseFloat(data.depositAmount) || 0;
    const maxDeposit = coldRent * 3;

    // Parse dates
    const parseDE = (s: string) => {
      if (!s) return null;
      const parts = s.split('.');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    };

    const contractStartDate = parseDE(data.contractStart);
    const signingDate = parseDE(data.contractSigningDate);

    const fields: ExtractedField[] = [
      {
        key: 'propertyAddress',
        label: 'Objektadresse',
        value: data.propertyAddress,
        status: data.propertyAddress ? 'ok' : 'warning',
      },
      {
        key: 'landlordName',
        label: 'Vermieter',
        value: data.landlordName,
        status: data.landlordName ? 'ok' : 'warning',
      },
      {
        key: 'tenantName',
        label: 'Mieter',
        value: data.tenantName,
        status: data.tenantName ? 'ok' : 'warning',
      },
      {
        key: 'coldRent',
        label: 'Kaltmiete',
        value: data.coldRent ? `${data.coldRent} €` : '',
        status: data.coldRent ? 'ok' : 'error',
        hint: !data.coldRent ? 'Pflichtfeld für §551-Prüfung' : undefined,
      },
      {
        key: 'nkAdvancePayment',
        label: 'NK-Vorauszahlung',
        value: data.nkAdvancePayment ? `${data.nkAdvancePayment} €` : '',
        status: data.nkAdvancePayment ? 'ok' : 'warning',
      },
      {
        key: 'heatingCosts',
        label: 'Heizkosten',
        value: data.heatingCosts ? `${data.heatingCosts} €` : '',
        status: data.heatingCosts ? 'ok' : 'warning',
      },
      {
        key: 'depositAmount',
        label: 'Kaution',
        value: data.depositAmount ? `${data.depositAmount} €` : '',
        status: deposit > 0
          ? deposit > maxDeposit && coldRent > 0
            ? 'error'
            : 'ok'
          : 'warning',
        hint: deposit > maxDeposit && coldRent > 0
          ? `Überschreitet 3× Kaltmiete (${maxDeposit.toFixed(0)} €)`
          : undefined,
      },
      {
        key: 'contractStart',
        label: 'Vertragsbeginn',
        value: data.contractStart,
        status: data.contractStart ? 'ok' : 'error',
        hint: !data.contractStart ? 'Pflichtfeld' : undefined,
      },
      {
        key: 'contractSigningDate',
        label: 'Unterzeichnungsdatum',
        value: data.contractSigningDate,
        status: data.contractSigningDate
          ? signingDate && contractStartDate && signingDate > contractStartDate
            ? 'warning'
            : 'ok'
          : 'warning',
        hint: signingDate && contractStartDate && signingDate > contractStartDate
          ? 'Liegt nach Vertragsbeginn – bitte prüfen'
          : undefined,
      },
      {
        key: 'totalRent',
        label: 'Gesamtmiete',
        value: data.totalRent ? `${data.totalRent} €` : '',
        status: data.totalRent ? 'ok' : 'warning',
      },
    ];

    const warnings: ValidationWarning[] = [];

    // §551 BGB deposit check
    if (coldRent > 0 && deposit > 0 && deposit > maxDeposit) {
      warnings.push({
        type: 'deposit',
        title: `Kaution überschreitet §551 BGB Obergrenze`,
        description: `Die Kaution (${deposit.toFixed(0)} €) übersteigt das gesetzliche Maximum von 3 Nettokaltmieten (3 × ${coldRent.toFixed(0)} € = ${maxDeposit.toFixed(0)} €). Der überschüssige Betrag ist nicht geschuldet.`,
        severity: 'error',
        legalRef: '§ 551 Abs. 1 BGB – Begrenzung auf 3 Monatskaltmieten',
      });
    } else if (coldRent > 0 && deposit > 0 && deposit === maxDeposit) {
      warnings.push({
        type: 'deposit',
        title: 'Kaution am gesetzlichen Maximum',
        description: `Die Kaution (${deposit.toFixed(0)} €) entspricht exakt 3 Nettokaltmieten. Gesetzeskonform gemäß §551 BGB.`,
        severity: 'warning',
        legalRef: '§ 551 Abs. 1 BGB',
      });
    }

    // Date consistency check
    if (signingDate && contractStartDate && signingDate > contractStartDate) {
      warnings.push({
        type: 'date',
        title: 'Datumsinkonsistenz erkannt',
        description: `Das Unterzeichnungsdatum (${data.contractSigningDate}) liegt zeitlich nach dem Vertragsbeginn (${data.contractStart}). Dies erfordert eine manuelle Prüfung – möglicherweise wurde der Vertrag rückwirkend geschlossen.`,
        severity: 'warning',
        legalRef: 'Vgl. §§ 145 ff. BGB – Vertragsschluss',
      });
    }

    // Missing critical fields
    const missingCritical = ['coldRent', 'contractStart'].filter(k => !data[k as keyof HandoverData]);
    if (missingCritical.length > 0) {
      warnings.push({
        type: 'missing',
        title: 'Pflichtfelder nicht erkannt',
        description: `Folgende für das Protokoll essenzielle Felder konnten nicht extrahiert werden: ${
          missingCritical.map(k => k === 'coldRent' ? 'Kaltmiete' : 'Vertragsbeginn').join(', ')
        }. Bitte manuell ergänzen.`,
        severity: 'error',
      });
    }

    return { fields, warnings };
  }, [data]);
};
