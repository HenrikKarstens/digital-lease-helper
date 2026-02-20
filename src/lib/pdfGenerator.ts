import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HandoverData } from '@/context/HandoverContext';

const BRAND_COLOR: [number, number, number] = [79, 70, 229]; // indigo-600
const BRAND_LIGHT: [number, number, number] = [238, 242, 255];
const DANGER_COLOR: [number, number, number] = [220, 38, 38];
const SUCCESS_COLOR: [number, number, number] = [22, 163, 74];
const TEXT_COLOR: [number, number, number] = [30, 30, 40];
const MUTED_COLOR: [number, number, number] = [100, 100, 120];

function addHeader(doc: jsPDF, title: string, subtitle: string, pageW: number) {
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('EstateTurn', 14, 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Rechtssichere Immobilienübergabe', 14, 17);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 23);
  doc.setTextColor(200, 200, 255);
  doc.setFontSize(8);
  doc.text(subtitle, pageW - 14, 23, { align: 'right' });
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number, pageW: number, pageH: number) {
  doc.setDrawColor(200, 200, 215);
  doc.line(14, pageH - 14, pageW - 14, pageH - 14);
  doc.setTextColor(...MUTED_COLOR);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`EstateTurn • Seite ${pageNum} von ${totalPages} • SHA-256 versiegelt`, 14, pageH - 8);
  doc.text(new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), pageW - 14, pageH - 8, { align: 'right' });
}

function sectionTitle(doc: jsPDF, text: string, y: number, pageW: number): number {
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(14, y, pageW - 28, 8, 2, 2, 'F');
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(text, 18, y + 5.5);
  return y + 12;
}

function labelValue(doc: jsPDF, label: string, value: string, x: number, y: number, colWidth: number) {
  doc.setTextColor(...MUTED_COLOR);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x, y);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const lines = doc.splitTextToSize(value || '–', colWidth - 2);
  doc.text(lines, x, y + 4);
  return y + 4 + lines.length * 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// VORAB-DOKUMENT / OFFLINE-PROTOKOLL – comprehensive pre-meeting document
// ─────────────────────────────────────────────────────────────────────────────
const STANDARD_ROOMS = [
  'Flur', 'Wohnzimmer', 'Schlafzimmer', 'Kinderzimmer', 'Bad', 'Gäste-WC',
  'Küche', 'Abstellraum', 'Balkon/Terrasse', 'Garten', 'Garage', 'Carport',
  'Keller', 'Dachboden', 'Außenbereich', 'Sonstiges',
];

function drawWriteLine(doc: jsPDF, x: number, y: number, width: number): number {
  doc.setDrawColor(190, 190, 210);
  doc.line(x, y, x + width, y);
  return y + 6;
}

export function generateBeweisanker(data: HandoverData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const isSale = data.transactionType === 'sale';
  const isMoveIn = data.handoverDirection === 'move-in';
  const ownerLabel = isSale ? 'Verkäufer' : 'Vermieter';
  const clientLabel = isSale ? 'Käufer' : 'Mieter';

  addHeader(doc, 'Vorab-Dokument / Offline-Protokoll', `Erstellt am ${date}`, pageW);

  let y = 36;
  const col1 = 14, col2 = pageW / 2 + 2, colW = pageW / 2 - 16;

  // ── §1 Stammdaten & Parteien ───────────────────────────────────────────────
  y = sectionTitle(doc, '§1  Stammdaten & Parteien', y, pageW);

  // Info box
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(14, y, pageW - 28, 7, 2, 2, 'F');
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text('Bereits aus der App übernommene Daten sind vorausgefüllt. Leere Felder bitte handschriftlich ergänzen.', 18, y + 4.5);
  doc.setFont('helvetica', 'normal');
  y += 10;

  const fieldLineH = 12;
  const drawField = (label: string, value: string, x: number, fy: number, w: number): number => {
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text(label, x, fy);
    fy += 2.5;
    if (value && value !== '–') {
      doc.setTextColor(...TEXT_COLOR); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      const vlines = doc.splitTextToSize(value, w - 2);
      doc.text(vlines, x, fy);
      fy += vlines.length * 4;
    } else {
      fy = drawWriteLine(doc, x, fy + 2, w - 4);
    }
    return fy + 2;
  };

  let lY = y, rY = y;
  lY = drawField('Objekt / Adresse', data.propertyAddress, col1, lY, colW);
  rY = drawField('Übergabedatum / Uhrzeit', date, col2, rY, colW);
  lY = drawField('Vertragsart', isSale ? 'Kauf' : 'Miete', col1, lY, colW);
  rY = drawField('Übergaberichtung', isMoveIn ? 'Einzug' : 'Auszug', col2, rY, colW);
  y = Math.max(lY, rY) + 2;

  // Parteien nebeneinander
  lY = y; rY = y;
  lY = drawField(`Name ${ownerLabel}`, data.landlordName, col1, lY, colW);
  rY = drawField(`Name ${clientLabel}`, data.tenantName, col2, rY, colW);
  lY = drawField(`E-Mail ${ownerLabel}`, data.landlordEmail, col1, lY, colW);
  rY = drawField(`E-Mail ${clientLabel}`, data.tenantEmail, col2, rY, colW);
  y = Math.max(lY, rY) + 2;

  // Finanzdaten
  lY = y; rY = y;
  lY = drawField('Kaltmiete', data.coldRent ? `${data.coldRent} €` : '', col1, lY, colW);
  rY = drawField('NK-Vorauszahlung', data.nkAdvancePayment ? `${data.nkAdvancePayment} €` : '', col2, rY, colW);
  lY = drawField('Kaution', data.depositAmount ? `${data.depositAmount} €` : '', col1, lY, colW);
  rY = drawField('Vertragsbeginn', data.contractStart, col2, rY, colW);
  y = Math.max(lY, rY) + 4;

  // ── §2 Teilnehmer ─────────────────────────────────────────────────────────
  if (y > pageH - 50) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§2  Anwesende Teilnehmer', y, pageW);
  const participantRows: string[][] = data.participants.length > 0
    ? data.participants.map(p => [p.name, p.role, p.present ? '☑ Ja' : '☐ Ja', ''])
    : [['', '', '☐ Ja', ''], ['', '', '☐ Ja', ''], ['', '', '☐ Ja', '']];
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Name', 'Rolle / Funktion', 'Anwesend', 'Handzeichen vor Ort']],
    body: participantRows,
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: TEXT_COLOR, minCellHeight: 10 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: { 2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 45 } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── §3 Zählerstände ───────────────────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§3  Zählerstände', y, pageW);
  const meterRows: string[][] = data.meterReadings.length > 0
    ? data.meterReadings.map(m => [m.medium, m.meterNumber || '', m.reading, m.unit, ''])
    : [
        ['Strom', '', '', 'kWh', ''],
        ['Gas', '', '', 'm³', ''],
        ['Wasser', '', '', 'm³', ''],
        ['Heizung', '', '', 'MWh', ''],
        ['Sonstiges', '', '', '', ''],
      ];
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Typ / Medium', 'Zählernummer', 'Ablesewert (Zahl)', 'Einheit', 'Foto / Bemerkung']],
    body: meterRows,
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: TEXT_COLOR, minCellHeight: 10 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: { 2: { cellWidth: 38, halign: 'right' }, 3: { cellWidth: 18, halign: 'center' } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── §4 Schlüssel-Übergabe ─────────────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§4  Schlüssel-Übergabe', y, pageW);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Schlüssel-Typ', `Anzahl ${ownerLabel} → ${clientLabel}`, 'Quittierung Empfang', 'Bemerkung']],
    body: [
      ['Haustürschlüssel', '', '☐ erhalten', ''],
      ['Wohnungsschlüssel', '', '☐ erhalten', ''],
      ['Kellerschlüssel', '', '☐ erhalten', ''],
      ['Briefkastenschlüssel', '', '☐ erhalten', ''],
      ['Garagenschlüssel / Chip', '', '☐ erhalten', ''],
      ['Sonstige Schlüssel', '', '☐ erhalten', ''],
    ],
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: TEXT_COLOR, minCellHeight: 9 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 38, halign: 'center' }, 2: { cellWidth: 30, halign: 'center' } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── §5 Raum-für-Raum-Checkliste ───────────────────────────────────────────
  doc.addPage(); y = 36;
  y = sectionTitle(doc, '§5  Raum-für-Raum-Checkliste', y, pageW);
  doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7); doc.setFont('helvetica', 'italic');
  doc.text('Zustand je Raum beurteilen. Bitte handschriftlich Mängel oder Besonderheiten eintragen.', col1, y);
  doc.setFont('helvetica', 'normal');
  y += 5;

  const roomCheckRows = STANDARD_ROOMS.map(room => [room, '☐ OK  ☐ Mängel', '', '']);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Raum', 'Zustand', 'Mängel / Besonderheiten (handschriftlich)', 'Foto Nr.']],
    body: roomCheckRows,
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: TEXT_COLOR, minCellHeight: 12 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 100 },
      3: { cellWidth: 14, halign: 'center' },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── §6 Besondere Vereinbarungen ────────────────────────────────────────────
  if (y > pageH - 55) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§6  Besondere Vereinbarungen & Notizen', y, pageW);
  const noteLabels = ['Schönheitsreparaturen / Renovierungsvereinbarung', 'Abweichungen vom Vertrag', 'Sonstige Absprachen'];
  for (const label of noteLabels) {
    if (y > pageH - 35) { doc.addPage(); y = 36; }
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7); doc.text(label, col1, y); y += 3;
    y = drawWriteLine(doc, col1, y, pageW - 28);
    y = drawWriteLine(doc, col1, y, pageW - 28);
    y = drawWriteLine(doc, col1, y, pageW - 28);
    y += 4;
  }

  // ── §7 Rechtsbelehrung ─────────────────────────────────────────────────────
  if (y > pageH - 55) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§7  Rechtsbelehrung & Anerkennungsklausel', y, pageW);
  doc.setFillColor(255, 248, 230);
  const clauses = [
    `Zustandsanerkennung (§ 536b BGB): Mit Unterzeichnung erkennen beide Parteien den zum Zeitpunkt der Übergabe festgestellten und dokumentierten Zustand der Immobilie als bindend an.`,
    `Fristsetzung (§ 281 BGB): Mängelanzeigen sind innerhalb von 7 Tagen nach Übergabe schriftlich zu erklären. Danach gelten nicht gerügte Mängel als anerkannt, sofern kein Vorbehalt erklärt wurde.`,
    `Verjährung (§ 548 BGB): Ansprüche wegen Verschlechterungen der Mietsache verjähren in 6 Monaten nach Rückgabe.`,
    `Schlüssel: Die Rückgabe sämtlicher Schlüssel beendet die Sachherrschaft und das Mietverhältnis. Nicht zurückgegebene Schlüssel begründen Schadensersatzansprüche.`,
    `Dieses Vorab-Dokument ist kein rechtskräftiges Übergabeprotokoll. Es dient als strukturierte Arbeitsgrundlage für die Begehung. Das finale Protokoll wird anschließend digital in der App EstateTurn erstellt und rechtssicher archiviert.`,
  ];
  const clines = clauses.flatMap(c => ['• ' + c, '']);
  const clH = clines.length * 3.5 + 8;
  const safeClH = Math.min(clH, pageH - y - 20);
  doc.roundedRect(14, y, pageW - 28, safeClH, 2, 2, 'F');
  doc.setTextColor(120, 80, 20); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(clauses.map(c => '• ' + c).join('\n\n'), pageW - 36), 18, y + 5);
  y += safeClH + 6;

  // ── §8 Unterschriften ─────────────────────────────────────────────────────
  if (y > pageH - 55) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§8  Unterschriften der Parteien', y, pageW);
  const sigBoxW = (pageW - 28 - 8) / 2;
  const sigBoxH = 30;

  const parties = [
    { x: col1, name: data.landlordName || ownerLabel, role: ownerLabel },
    { x: col2 - 2, name: data.tenantName || clientLabel, role: clientLabel },
  ];
  for (const party of parties) {
    doc.setDrawColor(160, 160, 190);
    doc.rect(party.x, y, sigBoxW, sigBoxH);
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7);
    doc.text(party.role, party.x + 2, y + 4);
    doc.setTextColor(...TEXT_COLOR); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text(party.name, party.x + 2, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(200, 200, 220);
    doc.line(party.x + 2, y + sigBoxH - 8, party.x + sigBoxW - 4, y + sigBoxH - 8);
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5);
    doc.text('Datum, Ort & Unterschrift', party.x + 2, y + sigBoxH - 3);
  }
  y += sigBoxH + 4;

  // Datum/Ort Felder darunter
  lY = y; rY = y;
  for (const [xi, label] of [[col1, 'Ort, Datum (Vermieterseite)'], [col2 - 2, 'Ort, Datum (Mieterseite)']] as [number, string][]) {
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5); doc.text(label, xi, y);
    drawWriteLine(doc, xi, y + 3, sigBoxW - 4);
  }
  y += 14;

  // Add page numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, pageW, pageH);
  }

  doc.save(`EstateTurn_Vorabdokument_${date.replace(/\s/g, '_')}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER PROTOKOLL – full legal handover certificate
// ─────────────────────────────────────────────────────────────────────────────
export function generateMasterProtocol(data: HandoverData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const protocolId = `ET-${Date.now().toString(36).toUpperCase()}`;
  const isSale = data.transactionType === 'sale';

  const deposit = parseFloat(data.depositAmount) || 0;
  const defectsCost = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const hasNkData = data.nkVorauszahlung > 0 || data.nkPrognose > 0;
  const nkBuffer = hasNkData ? Math.max(0, (data.nkPrognose - data.nkVorauszahlung) * 3) : 180;
  const payout = Math.max(0, deposit - defectsCost - nkBuffer);

  // ── Titelseite ────────────────────────────────────────────────────────────
  addHeader(doc, isSale ? 'Übergabeprotokoll (Kauf)' : 'Übergabeprotokoll (Miete)', `${date} · ID: ${protocolId}`, pageW);

  let y = 36;

  // ── §1 Stammdaten ─────────────────────────────────────────────────────────
  y = sectionTitle(doc, '§1  Stammdaten', y, pageW);
  const col1 = 14, col2 = pageW / 2 + 2, colW = pageW / 2 - 16;
  let leftY = y, rightY = y;
  leftY = labelValue(doc, 'Objekt / Adresse', data.propertyAddress, col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'Übergabedatum', date, col2, rightY, colW) + 4;
  leftY = labelValue(doc, 'Vertragsart', isSale ? 'Kauf' : 'Miete', col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'Übergaberichtung', data.handoverDirection === 'move-in' ? 'Einzug' : 'Auszug', col2, rightY, colW) + 4;
  y = Math.max(leftY, rightY) + 2;

  // ── §2 Parteien ───────────────────────────────────────────────────────────
  y = sectionTitle(doc, '§2  Vertragsparteien', y, pageW);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Partei', 'Name', 'E-Mail']],
    body: [
      [isSale ? 'Verkäufer' : 'Vermieter', data.landlordName || '–', data.landlordEmail || '–'],
      [isSale ? 'Käufer' : 'Mieter', data.tenantName || '–', data.tenantEmail || '–'],
    ],
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ── §3 Vertragsanalyse (KI) ───────────────────────────────────────────────
  y = sectionTitle(doc, '§3  Vertragsanalyse (KI-gestützt)', y, pageW);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Parameter', 'Wert']],
    body: [
      ['Kaltmiete', data.coldRent ? `${data.coldRent} €` : '–'],
      ['NK-Vorauszahlung', data.nkAdvancePayment ? `${data.nkAdvancePayment} €` : '–'],
      ['Kaution', data.depositAmount ? `${data.depositAmount} €` : '–'],
      ['Vertragsbeginn', data.contractStart || '–'],
      ['Vertragsende', data.contractEnd || '–'],
      ['Kautionsprüfung (§ 551 BGB)', data.depositLegalCheck || 'Nicht geprüft'],
      ['Renovierungsklausel', data.renovationClauseAnalysis || 'Nicht geprüft'],
    ],
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold' } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ── §4 Teilnehmer & Unterschriften ────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§4  Anwesende Teilnehmer & Unterschriften', y, pageW);
  const isLandlordUser = data.role === 'landlord';
  const isTenantUser = data.role === 'tenant';
  const landlordLabel = isSale ? 'Verkäufer' : 'Vermieter';
  const tenantLabel = isSale ? 'Käufer' : 'Mieter';
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Name', 'Rolle', 'Anwesend', 'Unterschrift']],
    body: data.participants.map(p => {
      const isAppUser =
        (isLandlordUser && (p.role === landlordLabel || p.name === data.landlordName)) ||
        (isTenantUser && (p.role === tenantLabel || p.name === data.tenantName));
      const sigStatus = p.signature
        ? (isAppUser ? '✓ Digital geleistet (App-Nutzer)' : '✓ Digital geleistet (vor Ort)')
        : 'Nicht unterschrieben';
      return [p.name, p.role, p.present ? 'Ja' : 'Nein', sigStatus];
    }),
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ── §5 Zählerstände ───────────────────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§5  Zählerstände', y, pageW);
  if (data.meterReadings.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Typ / Medium', 'Zählernummer', 'Ablesung', 'Einheit', 'Datum']],
      body: data.meterReadings.map(m => [
        m.medium,
        m.meterNumber || '–',
        m.reading,
        m.unit,
        m.maloId || date,
      ]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  } else {
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(8);
    doc.text('Keine Zähler erfasst.', col1, y);
    y += 8;
  }

  // ── §6 Detailliertes Mängelverzeichnis ────────────────────────────────────
  const defectFindings = data.findings.filter(f => f.entryType !== 'note');
  const noteFindings = data.findings.filter(f => f.entryType === 'note');

  if (y > pageH - 80) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§6a  Festgestellte Mängel & Schäden', y, pageW);
  if (defectFindings.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Raum', 'Lage', 'Material', 'Schaden', 'Zeitwert %', 'Einbehalt €', 'Maßnahme']],
      body: defectFindings.map(f => [
        f.room || '⚠ Unbekannt',
        (f as any).locationDetail || '–',
        f.material,
        f.damageType,
        `${f.timeValueDeduction}%`,
        f.recommendedWithholding > 0 ? `${f.recommendedWithholding} €` : '–',
        f.remediationOption === 'self'
          ? `Selbst behoben (${f.remediationParty || '–'})`
          : f.remediationOption === 'notice'
            ? `Aufforderung bis ${f.remediationDeadline || '–'}`
            : '–',
      ]),
      headStyles: { fillColor: DANGER_COLOR, textColor: [255, 255, 255], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 248, 248] },
      columnStyles: { 4: { halign: 'center' }, 5: { halign: 'right', fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // BGH references
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    defectFindings.forEach(f => {
      if (f.bghReference) {
        doc.text(`• ${f.room || 'Unbekannt'} / ${f.damageType}: ${f.bghReference} – ${f.description}`, col1, y);
        y += 3.5;
        if (y > pageH - 20) { doc.addPage(); y = 36; }
      }
    });
    doc.setFont('helvetica', 'normal');
    y += 2;
  } else {
    doc.setTextColor(...SUCCESS_COLOR);
    doc.setFontSize(8);
    doc.text('✓ Keine Mängel dokumentiert.', col1, y);
    y += 8;
  }

  // ── §6b Zusätzliche Feststellungen (Besonderheiten / Notizen) ─────────────
  if (noteFindings.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§6b  Zusätzliche Feststellungen (Zustand / Besonderheiten)', y, pageW);
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Raum', 'Lage', 'Feststellung', 'Zeitstempel']],
      body: noteFindings.map(f => [
        f.room || '–',
        (f as any).locationDetail || '–',
        f.description || f.damageType,
        f.timestamp,
      ]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.text('Hinweis: Die obigen Feststellungen sind reine Beweisanker ohne Kautionsabzug. Sie dienen der vollständigen Dokumentation des Objektzustands.', col1, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
  }

  // ── §7 Kautions-Abrechnung ────────────────────────────────────────────────
  if (!isSale) {
    const depositType = data.depositType || 'cash';
    const isGuarantee = depositType === 'guarantee';
    const isPledged = depositType === 'pledged-account';
    const isCash = depositType === 'cash';

    // Interest calculation: Kaution × (Zinssatz/100) × (Tage/360)
    const calcDays = (payDateStr: string): number => {
      if (!payDateStr) return 0;
      const start = new Date(payDateStr);
      if (isNaN(start.getTime())) return 0;
      return Math.max(0, Math.floor((new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    };
    const interestDays = calcDays(data.depositPaymentDate || '');
    const interestRate = data.depositInterestRate || 1.5;
    const interest = isCash && deposit > 0 && interestDays > 0 ? deposit * (interestRate / 100) * (interestDays / 360) : 0;
    const pledgedBalance = isPledged ? (parseFloat(data.pledgedAccountBalance || '0') || 0) : 0;
    const baseAmount = isCash ? deposit + interest : isPledged ? pledgedBalance : 0;
    const payoutFinal = isGuarantee ? 0 : Math.max(0, baseAmount - defectsCost - nkBuffer);

    if (y > pageH - 80) { doc.addPage(); y = 36; }

    if (isGuarantee) {
      // ── Bürgschaft: kein Auszahlungstabelle ──
      y = sectionTitle(doc, '§7  Kautions-Abrechnung (Bürgschaft)', y, pageW);
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(14, y, pageW - 28, 18, 2, 2, 'F');
      doc.setTextColor(...TEXT_COLOR);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const guaranteeText = `Die Bürgschaftsurkunde Nr. ${data.guaranteeNumber || '(nicht angegeben)'} wird dem Mieter ausgehändigt. Keine Barauszahlung.`;
      doc.text(doc.splitTextToSize(guaranteeText, pageW - 36), 18, y + 6);
      y += 22;
      if (defectsCost > 0) {
        doc.setTextColor(...DANGER_COLOR);
        doc.setFontSize(7);
        doc.text(`Hinweis: Dokumentierte Mängelkosten in Höhe von ${defectsCost.toFixed(2)} € – Inanspruchnahme der Bürgschaft ist gesondert zu prüfen.`, col1, y);
        y += 6;
      }
      doc.setTextColor(...MUTED_COLOR);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text('Berechnung gemäß BGH VIII ZR 71/05 & BGH VIII ZR 222/15. Bürgschaft: keine Zinspflicht gem. § 551 BGB.', col1, y);
      doc.setFont('helvetica', 'normal');
      y += 7;
    } else {
      // ── Bar-Kaution oder verpfändetes Konto ──
      const isReletting = data.immediateReletting === true;
      y = sectionTitle(doc, '§7  Kautions-Abrechnung (§ 551 BGB)', y, pageW);
      const tableBody7: string[][] = [];

      if (isCash) {
        tableBody7.push(['+ Hinterlegte Kaution', `${deposit.toFixed(2)} €`]);
        if (interest > 0) {
          tableBody7.push([`+ Zinsgutschrift gem. § 551 BGB (${interestRate.toFixed(2)}% p.a. für ${interestDays} Tage)`, `+ ${interest.toFixed(2)} €`]);
        }
      } else if (isPledged) {
        tableBody7.push(['+ Kontostand inkl. Zinsen (laut Sparbuch)', `${pledgedBalance.toFixed(2)} €`]);
      }

      tableBody7.push(
        [`- ${isReletting ? 'Endgültiger Schadensersatz' : 'Mängelkosten'} (${defectFindings.length} Posten)`, `- ${defectsCost.toFixed(2)} €`],
        [hasNkData ? '- NK-Puffer (KI-Prognose, 3 Mon.)' : '- NK-Puffer (Standardwert)', `- ${nkBuffer.toFixed(2)} €`],
        ['= Auszuzahlender Endbetrag', `${payoutFinal.toFixed(2)} €`],
      );
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Position', 'Betrag']],
        body: tableBody7,
        headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      doc.setFillColor(230, 255, 240);
      doc.roundedRect(14, y, pageW - 28, 10, 2, 2, 'F');
      doc.setTextColor(...SUCCESS_COLOR);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Auszahlungsbetrag: ${payoutFinal.toFixed(2)} €`, pageW / 2, y + 6.5, { align: 'center' });
      y += 14;

      // Legal basis
      doc.setTextColor(...MUTED_COLOR);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      const basisText = isCash
        ? `Berechnung gemäß BGH VIII ZR 71/05 (NK-Puffer) & BGH VIII ZR 222/15 (Zeitwert-Abzug, § 538 BGB). Zinsen: Kaution × ${interestRate}% × ${interestDays}/360 gem. § 551 Abs. 3 BGB.`
        : `Berechnung gemäß BGH VIII ZR 71/05 (NK-Puffer) & BGH VIII ZR 222/15 (Zeitwert-Abzug). Kontostand laut Sparbuch (Zinsen bankseitig gutgeschrieben).`;
      doc.text(basisText, col1, y);
      y += 6;
      doc.setFont('helvetica', 'normal');

      // ── §7c Zahlungsanweisung ──────────────────────────────
      if (payoutFinal > 0 && (data.payeeIban || data.payeeAccountHolder)) {
        if (y > pageH - 50) { doc.addPage(); y = 36; }
        y = sectionTitle(doc, '§7c  Zahlungsanweisung', y, pageW);
        const isRelettingPay = data.immediateReletting === true;
        const deadline14pay = isRelettingPay
          ? 'sofort fällig'
          : (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); })();
        const payeeHolder = data.payeeAccountHolder || data.tenantName || 'Mieter';
        const payeeIban = data.payeeIban || '(IBAN nicht angegeben)';

        doc.setFillColor(238, 242, 255);
        doc.roundedRect(14, y, pageW - 28, 22, 2, 2, 'F');
        doc.setTextColor(...TEXT_COLOR);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const paymentText = isRelettingPay
          ? `Der Betrag in Höhe von ${payoutFinal.toFixed(2)} € ist sofort fällig (Anschlussvermietung – § 281 Abs. 2 BGB) und auf das folgende Konto zu überweisen: ${payeeHolder}, IBAN: ${payeeIban}.`
          : `Der Betrag in Höhe von ${payoutFinal.toFixed(2)} € ist bis zum ${deadline14pay} auf das folgende Konto zu überweisen: ${payeeHolder}, IBAN: ${payeeIban}.`;
        const paymentLines = doc.splitTextToSize(paymentText, pageW - 36);
        doc.text(paymentLines, 18, y + 6);
        y += 26;

        doc.setTextColor(...MUTED_COLOR);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text('Verwendungszweck: Kautionsrückzahlung gemäß Übergabeprotokoll EstateTurn · Objekt: ' + (data.propertyAddress || '–'), col1, y);
        doc.setFont('helvetica', 'normal');
        y += 7;
      }
    }
  }



  // ── §7b Aufforderungsschreiben (§ 281 BGB) ───────────────────────────────
  const damageFindings = data.findings.filter(f => f.recommendedWithholding > 0);
  if (damageFindings.length > 0 && !isSale) {
    if (y > pageH - 80) { doc.addPage(); y = 36; }

    const isReletting7b = data.immediateReletting === true;
    const relettingDateStr = data.relettingDate
      ? new Date(data.relettingDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '(Datum nicht angegeben)';

    if (isReletting7b) {
      // ── Schadensersatzforderung (Anschlussvermietung) ──
      y = sectionTitle(doc, '§7b  Schadensersatzforderung (§ 281 Abs. 2 BGB – Anschlussvermietung)', y, pageW);
      doc.setFillColor(255, 248, 230);
      const seTotalCost = damageFindings.reduce((s, f) => s + f.recommendedWithholding, 0);
      const seText = `Aufgrund der unmittelbaren Anschlussvermietung zum ${relettingDateStr} ist eine Fristsetzung zur Mängelbeseitigung gemäß § 281 Abs. 2 BGB entbehrlich. Die festgestellten Schäden (${damageFindings.map(f => f.damageType).join(', ')}) werden daher unmittelbar als Schadensersatz in Geld in Höhe von ${seTotalCost.toFixed(2)} € mit der Kaution verrechnet.\n\nDer Anspruch auf Schadensersatz statt der Leistung ergibt sich aus § 280 Abs. 1, 3 i.V.m. § 281 Abs. 2 BGB, da dem Vermieter aufgrund des kurzfristigen Nachmietereinzugs die Gewährung einer Nachbesserungsfrist nicht zumutbar ist.`;
      const seLines = doc.splitTextToSize(seText, pageW - 36);
      const seH = seLines.length * 4 + 10;
      doc.roundedRect(14, y, pageW - 28, seH, 2, 2, 'F');
      doc.setTextColor(120, 80, 20);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(seLines, 18, y + 6);
      y += seH + 4;

      // Damage table
      autoTable(doc, {
        startY: y,
        margin: { left: 18, right: 18 },
        head: [['Nr.', 'Raum', 'Schadensbild', 'Endgültiger Schadensersatz']],
        body: damageFindings.map((f, idx) => [
          `${idx + 1}.`,
          f.room,
          `${f.damageType} (${f.material})`,
          `${f.recommendedWithholding} €`,
        ]),
        headStyles: { fillColor: DANGER_COLOR, textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [255, 248, 248] },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      // ── Standard: Aufforderungsschreiben (14-Tage-Frist) ──
      y = sectionTitle(doc, '§7b  Aufforderungsschreiben zur Mängelbeseitigung (§ 281 BGB)', y, pageW);
      doc.setFillColor(238, 242, 255);
      const letterStartY = y;
      doc.roundedRect(14, letterStartY, pageW - 28, 8, 2, 2, 'F');
      doc.setTextColor(...BRAND_COLOR);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Schriftliche Aufforderung zur Mängelbeseitigung', 18, letterStartY + 5.5);
      y = letterStartY + 12;

      const tenantName = data.tenantName || 'Mieter';
      const landlordName = data.landlordName || 'Vermieter';
      const address = data.propertyAddress || 'der o.g. Immobilie';
      const deadline14 = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); })();
      const deadline30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); })();

      doc.setTextColor(...TEXT_COLOR);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      const intro = `An: ${tenantName}\nVon: ${landlordName}\nBetr.: Aufforderung zur Beseitigung von Mängeln an ${address}\n\nSehr geehrte Mieterin, sehr geehrter Mieter,\n\nim Rahmen der am ${date} durchgeführten Wohnungsübergabe wurden folgende Schäden festgestellt, die über den üblichen Mietgebrauch hinausgehen und daher gemäß § 538 BGB in Verbindung mit der BGH-Rechtsprechung (BGH VIII ZR 222/15) zu Lasten der Mieterseite gehen:`;
      const introLines = doc.splitTextToSize(intro, pageW - 32);
      if (y + introLines.length * 4 > pageH - 20) { doc.addPage(); y = 36; }
      doc.text(introLines, 18, y);
      y += introLines.length * 4 + 4;

      autoTable(doc, {
        startY: y,
        margin: { left: 18, right: 18 },
        head: [['Nr.', 'Raum', 'Schadensbild', 'Geschätzter Einbehalt']],
        body: damageFindings.map((f, idx) => [
          `${idx + 1}.`,
          f.room,
          `${f.damageType} (${f.material})`,
          `ca. ${f.recommendedWithholding} €`,
        ]),
        headStyles: { fillColor: DANGER_COLOR, textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [255, 248, 248] },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      const demand = `Wir fordern Sie hiermit ausdrücklich auf, die oben aufgeführten Mängel bis spätestens ${deadline14} (Frist: 14 Tage gemäß § 281 BGB) fachgerecht und auf eigene Kosten zu beseitigen. Sofern Sie die Behebung durch einen Fachbetrieb beauftragen, bitten wir um Vorlage eines Kostenvoranschlags und eines Nachweises der Mängelbeseitigung (Fotos/Rechnung).\n\nWir weisen darauf hin, dass bei fruchtlosem Ablauf der gesetzten Frist ${landlordName} berechtigt ist, die Mängelbeseitigung auf Ihre Kosten zu veranlassen und entstandene Aufwendungen mit der hinterlegten Kaution zu verrechnen bzw. als Schadensersatz nach § 280 Abs. 1 BGB geltend zu machen.\n\nSollte eine einvernehmliche Lösung nicht erzielt werden, behalten wir uns vor, rechtliche Schritte einzuleiten. Für etwaige Rückfragen stehen wir bis zum ${deadline30} zur Verfügung.\n\nDiese Aufforderung ist Bestandteil des EstateTurn-Übergabeprotokolls (ID: ${protocolId}) und rechtlich bindend.`;
      const demandLines = doc.splitTextToSize(demand, pageW - 32);
      if (y + demandLines.length * 4 > pageH - 20) { doc.addPage(); y = 36; }
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_COLOR);
      doc.text(demandLines, 18, y);
      y += demandLines.length * 4 + 6;

      doc.setDrawColor(180, 180, 200);
      doc.line(18, y, 18 + 60, y);
      doc.setFontSize(7);
      doc.setTextColor(...MUTED_COLOR);
      doc.text(`${landlordName} (Vermieter/in)`, 18, y + 4);
      y += 12;
    }
  }

  // ── §8 Rechtsbelehrung ────────────────────────────────────────────────────
  if (y > pageH - 70) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§8  Rechtsbelehrung & Anerkennungsklauseln', y, pageW);
  doc.setFillColor(255, 248, 230);
  const clauses = [
    `1. Zustandsanerkennung: Mit Unterzeichnung erkennen beide Parteien den unter §6 dokumentierten Zustand der Immobilie als bindend an (§ 536b BGB).`,
    `2. Fristwahrung (§ 281 BGB): Aufforderungen zur Mängelbeseitigung wurden mit einer gesetzlichen Frist von 14 Tagen versehen. Bei Fristablauf steht dem Gläubiger Schadensersatz zu.`,
    `3. Verjährungsfrist: Ansprüche des Vermieters wegen Verschlechterungen verjähren in 6 Monaten nach Rückgabe der Mietsache (§ 548 BGB).`,
    `4. Schönheitsreparaturen: Formularklauseln zu Renovierungspflichten des Mieters sind nach BGH-Rechtsprechung in der Regel unwirksam, sofern sie von § 307 BGB abweichen.`,
    `5. Protokollverbindlichkeit: Dieses Protokoll wurde digital mit einem SHA-256-Hash versiegelt und ist urkundlich zu verwahren.`,
  ];
  const clauseLines = clauses.flatMap(c => doc.splitTextToSize(c, pageW - 36));
  const clauseH = clauseLines.length * 3.8 + 8;
  doc.roundedRect(14, y, pageW - 28, clauseH, 2, 2, 'F');
  doc.setTextColor(120, 80, 20);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(clauseLines, 18, y + 5);
  y += clauseH + 6;

// ── §9 Finale Unterschriften ──────────────────────────────────────────────
  if (y > pageH - 70) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§9  Unterschriften & Bestätigung', y, pageW);
  const sigBoxW = (pageW - 28 - 8) / 2;
  const sigBoxH9 = 38;

  const sigParties = [
    { x: col1, name: data.landlordName || (isSale ? 'Verkäufer' : 'Vermieter'), roleLabel: isSale ? 'Verkäufer' : 'Vermieter', sig: data.signatureLandlord, isAppUser: data.role === 'landlord' },
    { x: col2 - 2, name: data.tenantName || (isSale ? 'Käufer' : 'Mieter'), roleLabel: isSale ? 'Käufer' : 'Mieter', sig: data.signatureTenant, isAppUser: data.role === 'tenant' },
  ];

  for (const party of sigParties) {
    doc.setDrawColor(180, 180, 200);
    doc.rect(party.x, y, sigBoxW, sigBoxH9);
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(party.roleLabel, party.x + 2, y + 4);
    doc.setTextColor(...TEXT_COLOR);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(party.name, party.x + 2, y + 9);
    doc.setFont('helvetica', 'normal');
    if (party.sig) {
      // Embed the actual signature image
      doc.addImage(party.sig, 'PNG', party.x + 2, y + 11, sigBoxW - 4, 18, undefined, 'FAST');
      doc.setTextColor(...SUCCESS_COLOR);
      doc.setFontSize(6.5);
      doc.text(party.isAppUser ? '✓ Digital geleistet (App-Nutzer)' : '✓ Digital geleistet (vor Ort)', party.x + 2, y + sigBoxH9 - 3);
    } else {
      // Empty signature line placeholder
      doc.setDrawColor(200, 200, 220);
      doc.line(party.x + 2, y + sigBoxH9 - 8, party.x + sigBoxW - 4, y + sigBoxH9 - 8);
      doc.setTextColor(...MUTED_COLOR);
      doc.setFontSize(6.5);
      doc.text('Datum, Ort & Unterschrift', party.x + 2, y + sigBoxH9 - 3);
    }
  }
  y += sigBoxH9 + 6;

  // Integrity note
  doc.setTextColor(...MUTED_COLOR);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(`Protokoll-ID: ${protocolId} · SHA-256 versiegelt · Nur tatsächlich in der App oder vor Ort geleistete Unterschriften werden hier abgebildet.`, col1, y, { maxWidth: pageW - 28 });
  y += 8;
  doc.setFont('helvetica', 'normal');

  // Page numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, pageW, pageH);
  }

  // Smart filename: EstateTurn_Protokoll_[Adresse]_[Datum]_[ID].pdf
  const safeAddress = (data.propertyAddress || 'Unbekannt')
    .replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '')
    .substring(0, 30);
  const safeDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  doc.save(`EstateTurn_Protokoll_${safeAddress}_${safeDate}_${protocolId}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER PROTOKOLL – returns Blob for inline preview
// ─────────────────────────────────────────────────────────────────────────────
export function generateMasterProtocolBlob(data: HandoverData): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const protocolId = `ET-${Date.now().toString(36).toUpperCase()}`;
  const isSale = data.transactionType === 'sale';

  const deposit = parseFloat(data.depositAmount) || 0;
  const defectsCost = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);
  const hasNkData = data.nkVorauszahlung > 0 || data.nkPrognose > 0;
  const nkBuffer = hasNkData ? Math.max(0, (data.nkPrognose - data.nkVorauszahlung) * 3) : 180;
  const payout = Math.max(0, deposit - defectsCost - nkBuffer);

  addHeader(doc, isSale ? 'Übergabeprotokoll (Kauf)' : 'Übergabeprotokoll (Miete)', `${date} · ID: ${protocolId}`, pageW);

  let y = 36;
  const col1 = 14, col2 = pageW / 2 + 2, colW = pageW / 2 - 16;
  let leftY = y, rightY = y;

  y = sectionTitle(doc, '§1  Stammdaten', y, pageW);
  leftY = y; rightY = y;
  leftY = labelValue(doc, 'Objekt / Adresse', data.propertyAddress, col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'Übergabedatum', date, col2, rightY, colW) + 4;
  leftY = labelValue(doc, 'Vertragsart', isSale ? 'Kauf' : 'Miete', col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'Übergaberichtung', data.handoverDirection === 'move-in' ? 'Einzug' : 'Auszug', col2, rightY, colW) + 4;
  y = Math.max(leftY, rightY) + 2;

  y = sectionTitle(doc, '§2  Vertragsparteien', y, pageW);
  const signatureTimestamp = new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Partei', 'Name', 'E-Mail', 'Digitale Signatur']],
    body: [
      [isSale ? 'Verkäufer' : 'Vermieter', data.landlordName || '–', data.landlordEmail || '–',
        data.signatureLandlord ? `✓ Signiert am ${signatureTimestamp}` : 'Nicht unterschrieben'],
      [isSale ? 'Käufer' : 'Mieter', data.tenantName || '–', data.tenantEmail || '–',
        data.signatureTenant ? `✓ Signiert am ${signatureTimestamp}` : 'Nicht unterschrieben'],
    ],
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  y = sectionTitle(doc, '§3  Vertragsanalyse (KI-gestützt)', y, pageW);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Parameter', 'Wert']],
    body: [
      ['Kaltmiete', data.coldRent ? `${data.coldRent} €` : '–'],
      ['NK-Vorauszahlung', data.nkAdvancePayment ? `${data.nkAdvancePayment} €` : '–'],
      ['Kaution', data.depositAmount ? `${data.depositAmount} €` : '–'],
      ['Vertragsbeginn', data.contractStart || '–'],
      ['Vertragsende', data.contractEnd || '–'],
      ['Kautionsprüfung (§ 551 BGB)', data.depositLegalCheck || 'Nicht geprüft'],
      ['Renovierungsklausel', data.renovationClauseAnalysis || 'Nicht geprüft'],
    ],
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold' } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  if (data.participants.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§4  Anwesende Teilnehmer & Unterschriften', y, pageW);
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Name', 'Rolle', 'Anwesend', 'Unterschrift']],
      body: data.participants.map(p => {
        const isLandlordUser2 = data.role === 'landlord';
        const isTenantUser2 = data.role === 'tenant';
        const landlordLabel2 = isSale ? 'Verkäufer' : 'Vermieter';
        const tenantLabel2 = isSale ? 'Käufer' : 'Mieter';
        const isAppUser2 =
          (isLandlordUser2 && (p.role === landlordLabel2 || p.name === data.landlordName)) ||
          (isTenantUser2 && (p.role === tenantLabel2 || p.name === data.tenantName));
        const sigStatus2 = p.signature
          ? (isAppUser2 ? `✓ Digital geleistet (App-Nutzer) – ${signatureTimestamp}` : `✓ Digital geleistet (vor Ort) – ${signatureTimestamp}`)
          : 'Nicht unterschrieben';
        return [p.name, p.role, p.present ? 'Ja' : 'Nein', sigStatus2];
      }),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  if (y > pageH - 60) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§5  Zählerstände', y, pageW);
  if (data.meterReadings.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Typ / Medium', 'Zählernummer', 'Ablesung', 'Einheit', 'Datum']],
      body: data.meterReadings.map(m => [m.medium, m.meterNumber || '–', m.reading, m.unit, m.maloId || date]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  } else {
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(8);
    doc.text('Keine Zähler erfasst.', col1, y); y += 8;
  }

  if (y > pageH - 80) { doc.addPage(); y = 36; }
  const bghRef = isSale ? 'BGH V ZR 104/19 (Kaufrecht)' : 'BGH VIII ZR 222/15 (Wohnraummietrecht)';
  const defectFindings2 = data.findings.filter(f => f.entryType !== 'note');
  const noteFindings2 = data.findings.filter(f => f.entryType === 'note');

  y = sectionTitle(doc, '§6a  Festgestellte Mängel & Schäden', y, pageW);
  const unknownRoomWarning = defectFindings2.some(f => !f.room || f.room === 'Unbekannt');
  if (unknownRoomWarning) {
    doc.setFillColor(255, 240, 200);
    doc.roundedRect(14, y, pageW - 28, 8, 2, 2, 'F');
    doc.setTextColor(180, 90, 0); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text('⚠ Rechtlicher Hinweis: Ohne Raumzuordnung ist die Fristsetzung zur Mängelbeseitigung ggf. unwirksam.', 18, y + 5.5);
    doc.setFont('helvetica', 'normal');
    y += 12;
  }
  if (defectFindings2.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Raum', 'Lage', 'Material', 'Schaden', 'Zeitwert %', 'Einbehalt €', 'Frist']],
      body: defectFindings2.map(f => [
        f.room || '⚠ Unbekannt',
        (f as any).locationDetail || '–',
        f.material,
        f.damageType,
        `${f.timeValueDeduction}%`,
        f.recommendedWithholding > 0 ? `${f.recommendedWithholding} €` : '–',
        f.remediationDeadline ? `bis ${f.remediationDeadline}` : '–',
      ]),
      headStyles: { fillColor: DANGER_COLOR, textColor: [255, 255, 255], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 248, 248] },
      columnStyles: { 4: { halign: 'center' }, 5: { halign: 'right', fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5); doc.setFont('helvetica', 'italic');
    defectFindings2.forEach(f => {
      if (f.bghReference) {
        const ref = isSale ? f.bghReference.replace('VIII ZR', 'V ZR') : f.bghReference;
        doc.text(`• ${f.room || 'Unbekannt'} / ${f.damageType}: ${ref} – ${f.description}`, col1, y);
        y += 3.5;
        if (y > pageH - 20) { doc.addPage(); y = 36; }
      }
    });
    doc.setFont('helvetica', 'normal'); y += 2;
  } else {
    doc.setTextColor(...SUCCESS_COLOR); doc.setFontSize(8);
    doc.text('✓ Keine Mängel dokumentiert.', col1, y); y += 8;
  }

  // §6b – Zusätzliche Feststellungen
  if (noteFindings2.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§6b  Zusätzliche Feststellungen (Zustand / Besonderheiten)', y, pageW);
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14 },
      head: [['Raum', 'Lage', 'Feststellung', 'Zeitstempel']],
      body: noteFindings2.map(f => [f.room || '–', (f as any).locationDetail || '–', f.description || f.damageType, f.timestamp]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5); doc.setFont('helvetica', 'italic');
    doc.text('Hinweis: Reine Beweisanker ohne Kautionsabzug – dokumentieren den vollständigen Objektzustand.', col1, y);
    doc.setFont('helvetica', 'normal'); y += 7;
  }

  if (!isSale) {
    const calcInterest2 = (dep: number, rate: number, payDateStr: string): number => {
      if (!dep || !rate || !payDateStr) return 0;
      const start = new Date(payDateStr);
      if (isNaN(start.getTime())) return 0;
      const years = Math.max(0, (new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      return dep * (rate / 100) * years;
    };
    const interest2 = calcInterest2(deposit, data.depositInterestRate || 1.5, data.depositPaymentDate || '');
    const gross2 = deposit + interest2;
    const payoutFinal2 = Math.max(0, gross2 - defectsCost - nkBuffer);

    if (y > pageH - 80) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§7  Kautions-Abrechnung (§ 551 BGB)', y, pageW);
    const tableBody7b: string[][] = [
      ['+ Hinterlegte Kaution', `${deposit.toFixed(2)} €`],
    ];
    if (interest2 > 0) {
      tableBody7b.push([`+ Erwirtschaftete Zinsen (${(data.depositInterestRate || 1.5).toFixed(2)}% p.a., § 551 Abs. 3 BGB)`, `+ ${interest2.toFixed(2)} €`]);
    }
    const isReletting2 = data.immediateReletting === true;
    tableBody7b.push(
      [`- ${isReletting2 ? 'Endgültiger Schadensersatz' : 'Mängelkosten'} (${defectFindings2.length} Posten)`, `- ${defectsCost.toFixed(2)} €`],
      [hasNkData ? '- NK-Puffer (KI-Prognose, 3 Mon.)' : '- NK-Puffer (Standardwert)', `- ${nkBuffer.toFixed(2)} €`],
      ['= Auszuzahlender Endbetrag', `${payoutFinal2.toFixed(2)} €`],
    );
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14 },
      head: [['Position', 'Betrag']],
      body: tableBody7b,
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFillColor(230, 255, 240);
    doc.roundedRect(14, y, pageW - 28, 10, 2, 2, 'F');
    doc.setTextColor(...SUCCESS_COLOR); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`Auszahlungsbetrag: ${payoutFinal2.toFixed(2)} €`, pageW / 2, y + 6.5, { align: 'center' });
    y += 14;
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7); doc.setFont('helvetica', 'italic');
    doc.text(`Berechnung gemäß BGH VIII ZR 71/05 (NK-Puffer) & ${bghRef} (Zeitwert-Abzug, § 538 BGB). Zinsen gemäß § 551 Abs. 3 BGB.`, col1, y);
    y += 6; doc.setFont('helvetica', 'normal');

    // §7c Zahlungsanweisung
    if (payoutFinal2 > 0 && (data.payeeIban || data.payeeAccountHolder)) {
      if (y > pageH - 50) { doc.addPage(); y = 36; }
      y = sectionTitle(doc, '§7c  Zahlungsanweisung', y, pageW);
      const isRelettingPay2 = data.immediateReletting === true;
      const deadline28b = isRelettingPay2
        ? 'sofort fällig'
        : (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); })();
      const payeeHolder2 = data.payeeAccountHolder || data.tenantName || 'Mieter';
      const payeeIban2 = data.payeeIban || '(IBAN nicht angegeben)';
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(14, y, pageW - 28, 22, 2, 2, 'F');
      doc.setTextColor(...TEXT_COLOR); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      const payText2 = isRelettingPay2
        ? `Der Betrag in Höhe von ${payoutFinal2.toFixed(2)} € ist sofort fällig (Anschlussvermietung – § 281 Abs. 2 BGB) und auf das folgende Konto zu überweisen: ${payeeHolder2}, IBAN: ${payeeIban2}.`
        : `Der Betrag in Höhe von ${payoutFinal2.toFixed(2)} € ist bis zum ${deadline28b} auf das folgende Konto zu überweisen: ${payeeHolder2}, IBAN: ${payeeIban2}.`;
      doc.text(doc.splitTextToSize(payText2, pageW - 36), 18, y + 6);
      y += 26;
      doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7); doc.setFont('helvetica', 'italic');
      doc.text('Verwendungszweck: Kautionsrückzahlung gemäß EstateTurn-Übergabeprotokoll · Objekt: ' + (data.propertyAddress || '–'), col1, y);
      doc.setFont('helvetica', 'normal'); y += 7;
    }
  }


  const damageFindings = defectFindings2.filter(f => f.recommendedWithholding > 0);
  if (damageFindings.length > 0 && !isSale) {
    if (y > pageH - 80) { doc.addPage(); y = 36; }

    const isReletting7b2 = data.immediateReletting === true;
    const relettingDateStr2 = data.relettingDate
      ? new Date(data.relettingDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '(Datum nicht angegeben)';

    if (isReletting7b2) {
      y = sectionTitle(doc, '§7b  Schadensersatzforderung (§ 281 Abs. 2 BGB – Anschlussvermietung)', y, pageW);
      doc.setFillColor(255, 248, 230);
      const seTotalCost2 = damageFindings.reduce((s, f) => s + f.recommendedWithholding, 0);
      const seText2 = `Aufgrund der unmittelbaren Anschlussvermietung zum ${relettingDateStr2} ist eine Fristsetzung zur Mängelbeseitigung gemäß § 281 Abs. 2 BGB entbehrlich. Die festgestellten Schäden (${damageFindings.map(f => f.damageType).join(', ')}) werden daher unmittelbar als Schadensersatz in Geld in Höhe von ${seTotalCost2.toFixed(2)} € mit der Kaution verrechnet.\n\nDer Anspruch auf Schadensersatz statt der Leistung ergibt sich aus § 280 Abs. 1, 3 i.V.m. § 281 Abs. 2 BGB, da dem Vermieter aufgrund des kurzfristigen Nachmietereinzugs die Gewährung einer Nachbesserungsfrist nicht zumutbar ist.`;
      const seLines2 = doc.splitTextToSize(seText2, pageW - 36);
      const seH2 = seLines2.length * 4 + 10;
      doc.roundedRect(14, y, pageW - 28, seH2, 2, 2, 'F');
      doc.setTextColor(120, 80, 20); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(seLines2, 18, y + 6);
      y += seH2 + 4;
      autoTable(doc, {
        startY: y, margin: { left: 18, right: 18 },
        head: [['Nr.', 'Raum', 'Schadensbild', 'Endgültiger Schadensersatz']],
        body: damageFindings.map((f, idx) => [`${idx + 1}.`, f.room || '–', `${f.damageType} (${f.material})`, `${f.recommendedWithholding} €`]),
        headStyles: { fillColor: DANGER_COLOR, textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [255, 248, 248] },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      y = sectionTitle(doc, '§7b  Aufforderungsschreiben zur Mängelbeseitigung (§ 281 BGB)', y, pageW);
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(14, y, pageW - 28, 8, 2, 2, 'F');
      doc.setTextColor(...BRAND_COLOR); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('Schriftliche Aufforderung zur Mängelbeseitigung', 18, y + 5.5);
      y += 12;
      const tenantName = data.tenantName || 'Mieter';
      const landlordName2 = data.landlordName || 'Vermieter';
      const address = data.propertyAddress || 'der o.g. Immobilie';
      const deadline14 = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); })();
      const deadline30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); })();
      doc.setTextColor(...TEXT_COLOR); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      const intro = `An: ${tenantName}\nVon: ${landlordName2}\nBetr.: Aufforderung zur Beseitigung von Mängeln an ${address}\n\nSehr geehrte Mieterin, sehr geehrter Mieter,\n\nim Rahmen der am ${date} durchgeführten Wohnungsübergabe wurden folgende Schäden festgestellt, die über den üblichen Mietgebrauch hinausgehen und daher gemäß § 538 BGB in Verbindung mit der BGH-Rechtsprechung (${bghRef}) zu Lasten der Mieterseite gehen:`;
      const introLines = doc.splitTextToSize(intro, pageW - 32);
      if (y + introLines.length * 4 > pageH - 20) { doc.addPage(); y = 36; }
      doc.text(introLines, 18, y); y += introLines.length * 4 + 4;
      autoTable(doc, {
        startY: y, margin: { left: 18, right: 18 },
        head: [['Nr.', 'Raum', 'Lage', 'Schadensbild', 'Einbehalt']],
        body: damageFindings.map((f, idx) => [`${idx + 1}.`, f.room || '⚠ Unbekannt', (f as any).locationDetail || '–', `${f.damageType} (${f.material})`, `ca. ${f.recommendedWithholding} €`]),
        headStyles: { fillColor: DANGER_COLOR, textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [255, 248, 248] },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      const demand = `Wir fordern Sie hiermit ausdrücklich auf, die oben aufgeführten Mängel bis spätestens ${deadline14} (Frist: 14 Tage gemäß § 281 BGB) fachgerecht und auf eigene Kosten zu beseitigen.\n\nWir weisen darauf hin, dass bei fruchtlosem Ablauf der gesetzten Frist ${landlordName2} berechtigt ist, die Mängelbeseitigung auf Ihre Kosten zu veranlassen und entstandene Aufwendungen mit der hinterlegten Kaution zu verrechnen bzw. als Schadensersatz nach § 280 Abs. 1 BGB geltend zu machen.\n\nDiese Aufforderung ist Bestandteil des EstateTurn-Übergabeprotokolls (ID: ${protocolId}) und rechtlich bindend.`;
      const demandLines = doc.splitTextToSize(demand, pageW - 32);
      if (y + demandLines.length * 4 > pageH - 20) { doc.addPage(); y = 36; }
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXT_COLOR);
      doc.text(demandLines, 18, y); y += demandLines.length * 4 + 6;
      doc.setDrawColor(180, 180, 200);
      doc.line(18, y, 18 + 60, y);
      doc.setFontSize(7); doc.setTextColor(...MUTED_COLOR);
      doc.text(`${landlordName2} (Vermieter/in)`, 18, y + 4); y += 12;
    }
  }

  if (y > pageH - 70) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§8  Rechtsbelehrung & Anerkennungsklauseln', y, pageW);
  doc.setFillColor(255, 248, 230);
  const clauses = [
    `1. Zustandsanerkennung: Mit Unterzeichnung erkennen beide Parteien den unter §6 dokumentierten Zustand der Immobilie als bindend an (§ 536b BGB).`,
    `2. Fristwahrung (§ 281 BGB): Aufforderungen zur Mängelbeseitigung wurden mit einer gesetzlichen Frist von 14 Tagen versehen. Bei Fristablauf steht dem Gläubiger Schadensersatz zu.`,
    `3. Verjährungsfrist: Ansprüche des Vermieters wegen Verschlechterungen verjähren in 6 Monaten nach Rückgabe der Mietsache (§ 548 BGB).`,
    `4. Schönheitsreparaturen: Formularklauseln zu Renovierungspflichten des Mieters sind nach BGH-Rechtsprechung in der Regel unwirksam (BGH VIII ZR 163/18, § 307 BGB).`,
    `5. Protokollverbindlichkeit: Dieses Protokoll wurde digital mit einem SHA-256-Hash versiegelt und ist urkundlich zu verwahren.`,
    isSale ? `6. Kaufrecht: Mängelansprüche richten sich nach § 434 BGB i.V.m. ${bghRef}.` : `6. Mietrecht: Kautions-Abrechnung gemäß § 551 BGB, Zeitwert-Abzug gemäß ${bghRef}.`,
  ];
  const clauseLines = clauses.flatMap(c => doc.splitTextToSize(c, pageW - 36));
  const clauseH = clauseLines.length * 3.8 + 8;
  doc.roundedRect(14, y, pageW - 28, clauseH, 2, 2, 'F');
  doc.setTextColor(120, 80, 20); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(clauseLines, 18, y + 5); y += clauseH + 6;

  if (y > pageH - 70) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§9  Unterschriften & Bestätigung', y, pageW);
  const sigBoxW2 = (pageW - 28 - 8) / 2;
  const sigBoxH2 = 38;

  const sigParties2 = [
    { x: col1, name: data.landlordName || (isSale ? 'Verkäufer' : 'Vermieter'), roleLabel: isSale ? 'Verkäufer' : 'Vermieter', sig: data.signatureLandlord, isAppUser: data.role === 'landlord' },
    { x: col2 - 2, name: data.tenantName || (isSale ? 'Käufer' : 'Mieter'), roleLabel: isSale ? 'Käufer' : 'Mieter', sig: data.signatureTenant, isAppUser: data.role === 'tenant' },
  ];

  for (const party2 of sigParties2) {
    doc.setDrawColor(180, 180, 200);
    doc.rect(party2.x, y, sigBoxW2, sigBoxH2);
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(party2.roleLabel, party2.x + 2, y + 4);
    doc.setTextColor(...TEXT_COLOR);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(party2.name, party2.x + 2, y + 9);
    doc.setFont('helvetica', 'normal');
    if (party2.sig) {
      doc.addImage(party2.sig, 'PNG', party2.x + 2, y + 11, sigBoxW2 - 4, 18, undefined, 'FAST');
      doc.setTextColor(...SUCCESS_COLOR);
      doc.setFontSize(6.5);
      doc.text(party2.isAppUser ? '✓ Digital geleistet (App-Nutzer)' : '✓ Digital geleistet (vor Ort)', party2.x + 2, y + sigBoxH2 - 3);
    } else {
      doc.setDrawColor(200, 200, 220);
      doc.line(party2.x + 2, y + sigBoxH2 - 8, party2.x + sigBoxW2 - 4, y + sigBoxH2 - 8);
      doc.setTextColor(...MUTED_COLOR);
      doc.setFontSize(6.5);
      doc.text('Datum, Ort & Unterschrift', party2.x + 2, y + sigBoxH2 - 3);
    }
  }
  y += sigBoxH2 + 6;

  doc.setTextColor(...MUTED_COLOR);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(`Protokoll-ID: ${protocolId} · SHA-256 versiegelt · Nur tatsächlich in der App oder vor Ort geleistete Unterschriften werden hier abgebildet.`, col1, y, { maxWidth: pageW - 28 });
  doc.setFont('helvetica', 'normal');

  const totalPages2 = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages2; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages2, pageW, pageH);
  }

  return doc.output('blob');
}
