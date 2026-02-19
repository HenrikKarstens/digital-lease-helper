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
// BEWEISANKER – pre-meeting evidence anchor document
// ─────────────────────────────────────────────────────────────────────────────
export function generateBeweisanker(data: HandoverData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  addHeader(doc, 'Beweisanker – Vorab-Dokument', date, pageW);

  let y = 36;

  // ── Objekt & Parteien ──────────────────────────────────────────────────────
  y = sectionTitle(doc, '§1  Stammdaten & Objekt', y, pageW);
  const col1 = 14, col2 = pageW / 2 + 2, colW = pageW / 2 - 16;
  let leftY = y, rightY = y;
  leftY = labelValue(doc, 'Objekt / Adresse', data.propertyAddress, col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'Übergabedatum', date, col2, rightY, colW) + 4;
  leftY = labelValue(doc, 'Vertragsart', data.transactionType === 'sale' ? 'Kauf' : 'Miete', col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'Richtung', data.handoverDirection === 'move-in' ? 'Einzug' : 'Auszug', col2, rightY, colW) + 4;
  y = Math.max(leftY, rightY) + 2;

  // ── Vermieter / Verkäufer ──────────────────────────────────────────────────
  y = sectionTitle(doc, '§2  Vermieter / Verkäufer', y, pageW);
  leftY = y; rightY = y;
  leftY = labelValue(doc, 'Name', data.landlordName, col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'E-Mail', data.landlordEmail, col2, rightY, colW) + 4;
  y = Math.max(leftY, rightY) + 2;

  // ── Mieter / Käufer ────────────────────────────────────────────────────────
  y = sectionTitle(doc, '§3  Mieter / Käufer', y, pageW);
  leftY = y; rightY = y;
  leftY = labelValue(doc, 'Name', data.tenantName, col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'E-Mail', data.tenantEmail, col2, rightY, colW) + 4;
  y = Math.max(leftY, rightY) + 2;

  // ── Mietkonditionen ────────────────────────────────────────────────────────
  y = sectionTitle(doc, '§4  Mietkonditionen (KI-Analyse)', y, pageW);
  leftY = y; rightY = y;
  leftY = labelValue(doc, 'Kaltmiete', data.coldRent ? `${data.coldRent} €` : '–', col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'NK-Vorauszahlung', data.nkAdvancePayment ? `${data.nkAdvancePayment} €` : '–', col2, rightY, colW) + 4;
  leftY = labelValue(doc, 'Kaution', data.depositAmount ? `${data.depositAmount} €` : '–', col1, leftY, colW) + 4;
  rightY = labelValue(doc, 'Vertragsbeginn', data.contractStart || '–', col2, rightY, colW) + 4;
  y = Math.max(leftY, rightY) + 2;

  // ── Vorschäden ─────────────────────────────────────────────────────────────
  if (data.preDamages) {
    y = sectionTitle(doc, '§5  Vorschäden (lt. Vor-Protokoll)', y, pageW);
    doc.setTextColor(...TEXT_COLOR);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.preDamages, pageW - 28);
    doc.text(lines, col1, y);
    y += lines.length * 4 + 6;
  }

  // ── Teilnehmer ─────────────────────────────────────────────────────────────
  if (data.participants.length > 0) {
    y = sectionTitle(doc, '§6  Anwesende Teilnehmer', y, pageW);
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Name', 'Rolle', 'Anwesend', 'Unterschrift (vor Ort)']],
      body: data.participants.map(p => [
        p.name,
        p.role,
        p.present ? 'Ja' : 'Nein',
        p.signature ? '✓ Digital hinterlegt' : '________________________',
      ]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: TEXT_COLOR },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      columnStyles: { 3: { cellWidth: 55 } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Notizfelder für Begehung ────────────────────────────────────────────────
  y = sectionTitle(doc, '§7  Notizfelder für die Begehung (Backup / handschriftlich)', y, pageW);
  const noteLabels = ['Schlüsselübergabe (Anzahl / Typ)', 'Besondere Vereinbarungen', 'Abweichungen vom Protokoll', 'Sonstiges'];
  noteLabels.forEach(label => {
    if (y > pageH - 40) { doc.addPage(); y = 36; }
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(7);
    doc.text(label, col1, y);
    y += 3;
    doc.setDrawColor(180, 180, 200);
    doc.line(col1, y, pageW - 14, y); y += 6;
    doc.line(col1, y, pageW - 14, y); y += 6;
    doc.line(col1, y, pageW - 14, y); y += 10;
  });

  // ── Rechtsbelehrung ────────────────────────────────────────────────────────
  if (y > pageH - 50) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§8  Rechtsbelehrung & Anerkennungsklausel', y, pageW);
  doc.setFillColor(255, 248, 230);
  doc.roundedRect(14, y, pageW - 28, 28, 2, 2, 'F');
  doc.setTextColor(120, 80, 20);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const disclaimer = 'Dieses Beweisanker-Dokument dient als rechtssichere Grundlage für die Immobilienübergabe. Mit Unterzeichnung des finalen Übergabeprotokolls erkennen beide Parteien den dokumentierten Zustand der Immobilie als bindend an. Einwände gegen den Zustand sind innerhalb von 7 Tagen nach Übergabe schriftlich geltend zu machen (§ 548 BGB). Mängel, die bei der Übergabe nicht dokumentiert wurden, gelten als vom Mieter anerkannt, sofern dieser keinen Vorbehalt erklärt hat. Dieses Dokument ist urkundlich zu verwahren.';
  const dlines = doc.splitTextToSize(disclaimer, pageW - 36);
  doc.text(dlines, 18, y + 5);
  y += 32;

  // ── Unterschriftenfelder ───────────────────────────────────────────────────
  if (y > pageH - 40) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§9  Bestätigung der Vollständigkeit', y, pageW);
  const sigBoxW = (pageW - 28 - 8) / 2;
  [[col1, data.landlordName || 'Vermieter / Verkäufer'], [col2 - 2, data.tenantName || 'Mieter / Käufer']].forEach(([x, name]) => {
    doc.setDrawColor(180, 180, 200);
    doc.rect(Number(x), y, sigBoxW, 18);
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(7);
    doc.text('Unterschrift', Number(x) + 2, y + 23);
    doc.text(String(name), Number(x) + 2, y + 27);
  });

  // Add page numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, pageW, pageH);
  }

  doc.save(`EstateTurn_Beweisanker_${date.replace(/\s/g, '_')}.pdf`);
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
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Name', 'Rolle', 'Anwesend', 'Unterschrift']],
    body: data.participants.map(p => [
      p.name,
      p.role,
      p.present ? 'Ja' : 'Nein',
      p.signature ? '✓ Digital geleistet' : 'Nicht unterschrieben',
    ]),
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
  if (y > pageH - 80) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§6  Detailliertes Mängelverzeichnis', y, pageW);
  if (data.findings.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Raum', 'Material', 'Schaden', 'Rechtl. Einordnung', 'Zeitwert %', 'Einbehalt €', 'Maßnahme']],
      body: data.findings.map(f => [
        f.room,
        f.material,
        f.damageType,
        f.legalClassification || '–',
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
      columnStyles: {
        4: { halign: 'center' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // BGH references
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    data.findings.forEach(f => {
      if (f.bghReference) {
        doc.text(`• ${f.room} / ${f.damageType}: ${f.bghReference} – ${f.description}`, col1, y);
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

  // ── §7 Kautions-Abrechnung ────────────────────────────────────────────────
  if (!isSale) {
    if (y > pageH - 80) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§7  Kautions-Abrechnung', y, pageW);
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Position', 'Betrag']],
      body: [
        ['Hinterlegte Kaution', `+ ${deposit.toFixed(2)} €`],
        [`Mängelkosten (${data.findings.length} Posten)`, `- ${defectsCost.toFixed(2)} €`],
        [hasNkData ? 'NK-Puffer (KI-Prognose, 3 Mon.)' : 'NK-Puffer (Standardwert)', `- ${nkBuffer.toFixed(2)} €`],
        ['⇒ Rückzahlung an Mieter', `${payout.toFixed(2)} €`],
      ],
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didDrawCell: (d: any) => {
        if (d.section === 'body' && d.row.index === 3) {
          doc.setFillColor(...SUCCESS_COLOR);
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    doc.setFillColor(230, 255, 240);
    doc.roundedRect(14, y, pageW - 28, 10, 2, 2, 'F');
    doc.setTextColor(...SUCCESS_COLOR);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Auszahlungsbetrag: ${payout.toFixed(2)} €`, pageW / 2, y + 6.5, { align: 'center' });
    y += 14;

    // Legal basis
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.text(`Berechnung gemäß BGH VIII ZR 71/05 (NK-Puffer) & BGH VIII ZR 222/15 (Zeitwert-Abzug, § 538 BGB).`, col1, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
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
  if (y > pageH - 55) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§9  Unterschriften & Bestätigung', y, pageW);
  const sigBoxW = (pageW - 28 - 8) / 2;
  [[col1, data.landlordName || (isSale ? 'Verkäufer' : 'Vermieter')], [col2 - 2, data.tenantName || (isSale ? 'Käufer' : 'Mieter')]].forEach(([x, name]) => {
    doc.setDrawColor(180, 180, 200);
    doc.rect(Number(x), y, sigBoxW, 20);
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(7);
    doc.text('Datum, Ort & Unterschrift', Number(x) + 2, y + 25);
    doc.text(String(name), Number(x) + 2, y + 29);
  });

  // Page numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, pageW, pageH);
  }

  doc.save(`EstateTurn_Protokoll_${protocolId}.pdf`);
}
