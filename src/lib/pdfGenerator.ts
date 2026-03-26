import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HandoverData } from '@/context/HandoverContext';
import { createThumbnail } from '@/lib/imageUtils';
import { formatGeoForPdf, formatTimestampForPdf } from '@/hooks/useGeoPhoto';

// Executive Certificate Theme
const BRAND_COLOR: [number, number, number] = [15, 23, 42];      // Midnight Blue #0F172A
const BRAND_LIGHT: [number, number, number] = [241, 245, 249];   // Soft slate-100
const DANGER_COLOR: [number, number, number] = [220, 38, 38];
const SUCCESS_COLOR: [number, number, number] = [5, 150, 105];   // Rich Emerald #059669
const TEXT_COLOR: [number, number, number] = [15, 23, 42];
const MUTED_COLOR: [number, number, number] = [100, 116, 139];   // Slate-500
const GOLD_COLOR: [number, number, number] = [197, 160, 89];     // Muted Gold #C5A059
const GOLD_LIGHT: [number, number, number] = [254, 249, 235];    // Gold background

// Helper: detect image format from data URL (jsPDF supports JPEG, PNG, GIF, BMP – NOT WEBP)
function imgFormat(dataUrl: string): string {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  // WEBP is not supported by jsPDF – treat as JPEG (safeAddImage will handle via canvas conversion)
  return 'JPEG';
}

// Helper: check if a URL is a valid base64 data URL (not a placeholder like __photo_captured__)
function isValidDataUrl(url: string | null | undefined): url is string {
  return !!url && url.startsWith('data:');
}

// Helper: convert WEBP data URL to JPEG via canvas (jsPDF doesn't support WEBP)
async function convertWebpToJpeg(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:image/webp')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Helper: safely add image to PDF with auto-format detection
function safeAddImage(doc: jsPDF, url: string, x: number, y: number, w: number, h: number): boolean {
  try {
    doc.addImage(url, imgFormat(url), x, y, w, h);
    doc.setDrawColor(200, 200, 215);
    doc.rect(x, y, w, h);
    return true;
  } catch {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.text('Bild nicht ladbar', x + 2, y + h / 2);
    return false;
  }
}


function embedPhotos(
  doc: jsPDF,
  photos: { url: string; label: string; timestamp?: string; gps?: string; sha256?: string }[],
  y: number,
  pageW: number,
  pageH: number,
  col1: number
): number {
  // Filter out placeholder URLs from localStorage persistence
  const validPhotos = photos.filter(p => p.url && p.url.startsWith('data:'));
  if (validPhotos.length === 0) return y;
  const imgW = 50;
  const imgH = 37;
  const gap = 4;
  const cols = Math.floor((pageW - 28) / (imgW + gap));
  
  for (let i = 0; i < validPhotos.length; i++) {
    const colIdx = i % cols;
    const x = col1 + colIdx * (imgW + gap);
    if (colIdx === 0 && i > 0) y += imgH + 18;
    if (y + imgH + 18 > pageH - 20) { doc.addPage(); y = 36; }
    
    safeAddImage(doc, validPhotos[i].url, x, y, imgW, imgH);
    // Label
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(validPhotos[i].label, x, y + imgH + 3, { maxWidth: imgW });
    // Timestamp + GPS
    const meta: string[] = [];
    if (validPhotos[i].timestamp) meta.push(validPhotos[i].timestamp!);
    if (validPhotos[i].gps) meta.push(validPhotos[i].gps!);
    if (meta.length > 0) {
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'italic');
      doc.text(meta.join(' · '), x, y + imgH + 6.5, { maxWidth: imgW });
      doc.setFont('helvetica', 'normal');
    }
    // SHA-256 Hash
    if (validPhotos[i].sha256) {
      doc.setFontSize(4);
      doc.setTextColor(100, 100, 120);
      doc.setFont('helvetica', 'normal');
      const shortHash = validPhotos[i].sha256!.substring(0, 16) + '…';
      doc.text(`SHA-256: ${shortHash}`, x, y + imgH + 9.5, { maxWidth: imgW });
    }
    // Forensic certification line
    if (validPhotos[i].gps || validPhotos[i].timestamp) {
      doc.setFontSize(4.5);
      doc.setTextColor(...GOLD_COLOR);
      doc.setFont('helvetica', 'bold');
      doc.text('Forensisch gesichert durch EstateTurn Live-GPS-Validierung', x, y + imgH + 12, { maxWidth: imgW });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED_COLOR);
    }
  }
  y += imgH + 18;
  return y;
}

function addHeader(doc: jsPDF, title: string, subtitle: string, pageW: number) {
  // Midnight blue header band
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 30, 'F');
  
  // Brand name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('EstateTurn', 14, 12);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 230);
  doc.text('Rechtssicheres Übergabe-Zertifikat', 14, 18);
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 25);
  doc.setTextColor(180, 200, 230);
  doc.setFontSize(8);
  doc.text(subtitle, pageW - 14, 25, { align: 'right' });
  
  // Gold seal badge (top right)
  const sealX = pageW - 30;
  const sealY = 4;
  const sealR = 9;
  doc.setFillColor(...GOLD_COLOR);
  doc.circle(sealX, sealY + sealR, sealR, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('VERIFIZIERT', sealX, sealY + sealR - 1, { align: 'center' });
  doc.setFontSize(4);
  doc.setFont('helvetica', 'normal');
  doc.text('SHA-256', sealX, sealY + sealR + 2, { align: 'center' });
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number, pageW: number, pageH: number) {
  // Subtle gold line
  doc.setDrawColor(...GOLD_COLOR);
  doc.setLineWidth(0.3);
  doc.line(14, pageH - 15, pageW - 14, pageH - 15);
  doc.setLineWidth(0.1);
  doc.setTextColor(...MUTED_COLOR);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`EstateTurn Übergabe-Zertifikat • Seite ${pageNum} von ${totalPages} • SHA-256 versiegelt`, 14, pageH - 9);
  doc.text(new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), pageW - 14, pageH - 9, { align: 'right' });
  // Watermark
  doc.setTextColor(230, 230, 235);
  doc.setFontSize(40);
  doc.setFont('helvetica', 'bold');
  const waterY = pageH / 2;
  doc.text('EstateTurn Verified', pageW / 2, waterY, { align: 'center', angle: 45 });
}

function sectionTitle(doc: jsPDF, text: string, y: number, pageW: number): number {
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(14, y, pageW - 28, 9, 2, 2, 'F');
  // Gold left accent bar
  doc.setFillColor(...GOLD_COLOR);
  doc.rect(14, y, 2, 9, 'F');
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(text, 20, y + 6);
  return y + 13;
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

// ── Room-by-room section helper ──────────────────────────────────────────────
function generateRoomSections(
  doc: jsPDF,
  data: HandoverData,
  yStart: number,
  pageW: number,
  pageH: number,
  col1: number,
  date: string,
  isMoveIn: boolean,
): number {
  let y = yStart;
  const roomConfigs = (data as any).__roomConfigs as any[] | undefined;
  const rooms = roomConfigs && roomConfigs.length > 0 ? roomConfigs : [];

  // Group findings by room name
  const findingsByRoom = new Map<string, typeof data.findings>();
  for (const f of data.findings) {
    const key = f.room || '__unassigned__';
    if (!findingsByRoom.has(key)) findingsByRoom.set(key, []);
    findingsByRoom.get(key)!.push(f);
  }

  // Track which room names we've rendered
  const renderedRoomNames = new Set<string>();

  const techCheckLabel = (val: any): string => {
    if (!val || val.status === null || val.status === undefined) return '–';
    if (val.status === 'ok') return '☑ OK';
    if (val.status === 'nv') return '⊘ N/V';
    if (val.status === 'ng') return `⚠ Mangel${val.comment ? ': ' + val.comment : ''}`;
    return '–';
  };

  for (const room of rooms) {
    renderedRoomNames.add(room.name);
    const roomFindings = findingsByRoom.get(room.name) || [];
    const roomDefects = roomFindings.filter(f => f.entryType !== 'note');
    const roomNotes = roomFindings.filter(f => f.entryType === 'note');

    // ── Room sub-header ──
    if (y > pageH - 60) { doc.addPage(); y = 36; }
    doc.setFillColor(230, 235, 245);
    doc.roundedRect(14, y, pageW - 28, 8, 2, 2, 'F');
    doc.setFillColor(...GOLD_COLOR);
    doc.rect(14, y, 2, 8, 'F');
    doc.setTextColor(...BRAND_COLOR);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`🏠  ${room.name}`, 20, y + 5.5);
    // Status badge
    const statusText = room.completed ? '✓ Abgeschlossen' : '○ Offen';
    const statusColor: [number, number, number] = room.completed ? SUCCESS_COLOR : MUTED_COLOR;
    doc.setTextColor(...statusColor);
    doc.setFontSize(7);
    doc.text(statusText, pageW - 16, y + 5.5, { align: 'right' });
    y += 12;

    // ── Overview photos (2 per row) ──
    const overviewPhotos = (room.overviewPhotos || []).filter((p: any) => p.url && p.url.startsWith('data:'));
    if (overviewPhotos.length > 0) {
      const imgW = (pageW - 28 - 4) / 2; // 2 photos per row
      const imgH = imgW * 0.65;
      for (let i = 0; i < overviewPhotos.length; i++) {
        const colIdx = i % 2;
        const x = col1 + colIdx * (imgW + 4);
        if (colIdx === 0 && i > 0) y += imgH + 8;
        if (y + imgH + 8 > pageH - 20) { doc.addPage(); y = 36; }
        safeAddImage(doc, overviewPhotos[i].url, x, y, imgW, imgH);
        // Timestamp
        if (overviewPhotos[i].timestamp) {
          doc.setTextColor(...MUTED_COLOR); doc.setFontSize(5.5); doc.setFont('helvetica', 'italic');
          doc.text(overviewPhotos[i].timestamp, x, y + imgH + 3, { maxWidth: imgW });
          doc.setFont('helvetica', 'normal');
        }
        // SHA-256
        if (overviewPhotos[i].sha256Hash) {
          doc.setTextColor(100, 100, 120); doc.setFontSize(4);
          doc.text(`SHA-256: ${overviewPhotos[i].sha256Hash.substring(0, 16)}…`, x, y + imgH + 6, { maxWidth: imgW });
        }
      }
      y += imgH + 10;
    }

    // ── Checklist status ──
    const checkItems: [string, string][] = [];
    if (room.cleaningDone !== undefined) checkItems.push(['Reinigung/Besenrein', room.cleaningDone ? '☑ Ja' : '☐ Nein']);
    if (room.smokeDetectorOk !== undefined) checkItems.push(['Rauchwarnmelder', room.smokeDetectorOk ? '☑ OK' : '☐ Nicht geprüft']);
    if (room.wallsNeutral !== undefined && room.wallsNeutral !== null) checkItems.push(['Wände neutral', room.wallsNeutral ? '☑ Ja' : '☐ Nein']);
    // Tech checks
    const techFields: [string, string][] = [
      ['Fenster & Türen', 'windowsDoors'], ['Sanitär', 'sanitary'],
      ['Elektrik', 'electrical'], ['Rauchwarnmelder', 'smokeDetector'],
      ['Herd/Backofen', 'oven'], ['Spüle/Abfluss', 'sinkDrain'],
      ['Fliesen/Fugen', 'tilesGrout'], ['Spülung/Armaturen', 'flushFittings'],
    ];
    for (const [label, field] of techFields) {
      const val = (room as any)[field];
      if (val && val.status !== null && val.status !== undefined) {
        checkItems.push([label, techCheckLabel(val)]);
      }
    }
    if (checkItems.length > 0) {
      if (y + 10 > pageH - 20) { doc.addPage(); y = 36; }
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Prüfpunkt', 'Ergebnis']],
        body: checkItems,
        headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7, textColor: TEXT_COLOR },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
        didParseCell: (hookData: any) => {
          if (hookData.section === 'body' && hookData.column.index === 1) {
            const text = hookData.cell.text?.[0] || '';
            if (text.startsWith('⚠')) {
              hookData.cell.styles.textColor = DANGER_COLOR;
              hookData.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // ── Defects for this room ──
    if (roomDefects.length > 0) {
      if (y + 10 > pageH - 20) { doc.addPage(); y = 36; }
      doc.setTextColor(...DANGER_COLOR); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text(`Befunde / Mängel (${roomDefects.length})`, col1, y);
      doc.setFont('helvetica', 'normal');
      y += 5;

      for (const defect of roomDefects) {
        if (y + 50 > pageH - 20) { doc.addPage(); y = 36; }

        // Defect photo + description side by side
        const hasPhoto = defect.photoUrl && defect.photoUrl.startsWith('data:');
        const photoW = 45;
        const photoH = 34;
        const textX = hasPhoto ? col1 + photoW + 4 : col1;
        const textW = hasPhoto ? pageW - 28 - photoW - 4 : pageW - 28;

        if (hasPhoto) {
          try {
            safeAddImage(doc, defect.photoUrl!, col1, y, photoW, photoH);
          } catch { /* skip */ }
        }

        // Label
        doc.setFillColor(255, 240, 240);
        doc.roundedRect(textX, y, Math.min(textW, 40), 5, 1, 1, 'F');
        doc.setTextColor(...DANGER_COLOR); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
        doc.text('Befund / Mangel', textX + 1, y + 3.5);
        doc.setFont('helvetica', 'normal');

        let ty = y + 8;
        // Damage type
        doc.setTextColor(...TEXT_COLOR); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        const dtLines = doc.splitTextToSize(defect.damageType || '–', textW);
        doc.text(dtLines, textX, ty);
        ty += dtLines.length * 3.5 + 1;
        doc.setFont('helvetica', 'normal');

        // Description
        if (defect.description) {
          doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7);
          const descLines = doc.splitTextToSize(defect.description, textW);
          doc.text(descLines, textX, ty);
          ty += descLines.length * 3 + 1;
        }

        // Material
        if (defect.material) {
          doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5);
          doc.text(`Material: ${defect.material}`, textX, ty);
          ty += 3.5;
        }

        // Withholding (move-out only)
        if (!isMoveIn && defect.recommendedWithholding > 0) {
          doc.setTextColor(...DANGER_COLOR); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
          doc.text(`Einbehalt: ${defect.recommendedWithholding} €`, textX, ty);
          doc.setFont('helvetica', 'normal');
          ty += 3.5;
        }

        // Forensic metadata
        if (hasPhoto) {
          const metaX = col1;
          let my = y + photoH + 2;
          doc.setTextColor(...MUTED_COLOR); doc.setFontSize(5.5); doc.setFont('helvetica', 'italic');
          if (defect.photoGeo?.timestamp) {
            doc.text(formatTimestampForPdf(defect.photoGeo.timestamp) || '', metaX, my, { maxWidth: photoW });
            my += 3;
          }
          if (defect.photoGeo) {
            const gps = formatGeoForPdf(defect.photoGeo);
            if (gps) { doc.text(gps, metaX, my, { maxWidth: photoW }); my += 3; }
          }
          if (defect.sha256Hash) {
            doc.setFontSize(4); doc.setTextColor(100, 100, 120); doc.setFont('helvetica', 'normal');
            doc.text(`SHA-256: ${defect.sha256Hash.substring(0, 16)}…`, metaX, my, { maxWidth: photoW });
            my += 2.5;
          }
          doc.setTextColor(...GOLD_COLOR); doc.setFontSize(4.5); doc.setFont('helvetica', 'bold');
          doc.text('Forensisch gesichert durch EstateTurn Live-GPS-Validierung', metaX, my, { maxWidth: photoW });
          doc.setFont('helvetica', 'normal');
          y = Math.max(ty, my + 4) + 4;
        } else {
          y = ty + 4;
        }
      }
    }

    // ── Notes for this room ──
    if (roomNotes.length > 0) {
      if (y + 10 > pageH - 20) { doc.addPage(); y = 36; }
      doc.setTextColor(...BRAND_COLOR); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.text(`Feststellungen (${roomNotes.length})`, col1, y);
      doc.setFont('helvetica', 'normal');
      y += 4;
      for (const note of roomNotes) {
        if (y + 10 > pageH - 20) { doc.addPage(); y = 36; }
        doc.setTextColor(...TEXT_COLOR); doc.setFontSize(7);
        const noteText = `• ${note.description || note.damageType}`;
        const noteLines = doc.splitTextToSize(noteText, pageW - 32);
        doc.text(noteLines, col1 + 2, y);
        y += noteLines.length * 3.5 + 2;
      }
      y += 2;
    }

    // Separator line between rooms
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.2);
    doc.line(col1, y, pageW - 14, y);
    doc.setLineWidth(0.1);
    y += 4;
  }

  // ── Findings not assigned to any room ──
  const unassigned = data.findings.filter(f => !renderedRoomNames.has(f.room || '') && f.room !== '__unassigned__');
  const unassignedDefects = unassigned.filter(f => f.entryType !== 'note');
  if (unassignedDefects.length > 0) {
    if (y > pageH - 40) { doc.addPage(); y = 36; }
    doc.setFillColor(255, 240, 200);
    doc.roundedRect(14, y, pageW - 28, 8, 2, 2, 'F');
    doc.setTextColor(180, 90, 0); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text(`⚠ ${unassignedDefects.length} Befund(e) ohne Raumzuordnung`, 18, y + 5.5);
    doc.setFont('helvetica', 'normal');
    y += 12;
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Raum', 'Schaden', 'Beschreibung', isMoveIn ? '' : 'Einbehalt €']],
      body: unassignedDefects.map(f => [
        f.room || '–', f.damageType, f.description || '–',
        isMoveIn ? '' : (f.recommendedWithholding > 0 ? `${f.recommendedWithholding} €` : '–'),
      ]),
      headStyles: { fillColor: DANGER_COLOR, textColor: [255, 255, 255], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 248, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    // Embed unassigned photos
    const unassignedPhotos = unassignedDefects
      .filter(f => f.photoUrl && f.photoUrl.startsWith('data:'))
      .map(f => ({ url: f.photoUrl!, label: `${f.room || '–'}: ${f.damageType}`, timestamp: formatTimestampForPdf(f.photoGeo?.timestamp) || f.timestamp, gps: formatGeoForPdf(f.photoGeo), sha256: f.sha256Hash }));
    y = embedPhotos(doc, unassignedPhotos, y, pageW, pageH, col1);
  }

  return y;
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
    ? data.meterReadings.map(m => [m.medium, m.meterNumber || '', m.location || '', m.reading, m.unit, ''])
    : [
        ['Strom', '', '', '', 'kWh', ''],
        ['Gas', '', '', '', 'm³', ''],
        ['Wasser', '', '', '', 'm³', ''],
        ['Heizung', '', '', '', 'MWh', ''],
        ['Sonstiges', '', '', '', '', ''],
      ];
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Typ / Medium', 'Zählernummer', 'Standort', 'Ablesewert (Zahl)', 'Einheit', 'Foto / Bemerkung']],
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
  const hasRestforderung = (defectsCost + nkBuffer) > deposit && deposit > 0;
  const restforderungAmount = hasRestforderung ? (defectsCost + nkBuffer) - deposit : 0;

  const isMoveIn = data.handoverDirection === 'move-in';

  // Dynamic title based on context
  let protocolTitle: string;
  if (isSale) {
    protocolTitle = 'Übergabeprotokoll (Kauf)';
  } else if (isMoveIn) {
    protocolTitle = 'Einzugsprotokoll & Zustandsbericht';
  } else {
    protocolTitle = 'Übergabeprotokoll (Miete)';
  }

  // ── Titelseite ────────────────────────────────────────────────────────────
  addHeader(doc, protocolTitle, `${date} · ID: ${protocolId}`, pageW);

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
    head: [['Partei', 'Name', 'E-Mail', 'Mobilnummer', 'Geburtstag']],
    body: [
      [isSale ? 'Verkäufer' : 'Vermieter', data.landlordName || '–', data.landlordEmail || '–', data.landlordPhone || '–', data.landlordBirthday || '–'],
      [isSale ? 'Käufer' : 'Mieter', data.tenantName || '–', data.tenantEmail || '–', data.tenantPhone || '–', data.tenantBirthday || '–'],
    ],
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Prior/Next address
  if (data.priorAddress || data.nextAddress) {
    const addrLabel = data.handoverDirection === 'move-in' ? 'Voranschrift (Mieter)' : 'Nachanschrift (Mieter)';
    const addrValue = data.handoverDirection === 'move-in' ? data.priorAddress : data.nextAddress;
    if (addrValue) {
      labelValue(doc, addrLabel, addrValue, col1, y, colW * 2);
      y += 8;
    }
  }

  // ── §3 Vertragsanalyse (KI) ───────────────────────────────────────────────
  y = sectionTitle(doc, '§3  Vertragsanalyse (KI-gestützt)', y, pageW);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Parameter', 'Wert']],
    body: [
      ['Kaltmiete', data.coldRent ? `${data.coldRent} €` : '–'],
      ['NK-Vorauszahlung', data.nkAdvancePayment ? `${data.nkAdvancePayment} €` : '–'],
      ['Heiz-/Warmwasserkosten', data.heatingCosts ? `${data.heatingCosts} €` : '–'],
      ['Gesamtmiete', data.totalRent ? `${data.totalRent} €` : '–'],
      ['Kaution', data.depositAmount ? `${data.depositAmount} €` : '–'],
      ['Zimmeranzahl', data.roomCount || '–'],
      ['Vertragsbeginn', data.contractStart || '–'],
      ['Vertragsende / Befristung', data.contractDuration || data.contractEnd || '–'],
      ['Vertragsart', data.contractType === 'befristet' ? 'Befristet' : data.contractType === 'unbefristet' ? 'Unbefristet' : '–'],
      ['Datum Vertragsunterzeichnung', data.contractSigningDate || '–'],
      ['Kautionsprüfung (§ 551 BGB)', data.depositLegalCheck || 'Nicht geprüft'],
      ['Renovierungsklausel', data.renovationClauseAnalysis || 'Nicht geprüft'],
    ],
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold' } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ── §3a Individuelle Vertragsanpassungen (gestrichene Klauseln) ──────────
  const strickenClauseIds = (data.strickenClauses || []).filter(id => id.startsWith('deep-'));
  const strickenDeepClauses = (data.deepLegalClauses || []).filter(c =>
    strickenClauseIds.includes(`deep-${c.paragraphRef}`)
  );
  if (strickenDeepClauses.length > 0) {
    if (y > pageH - 50) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§3a  Individuelle Vertragsanpassungen', y, pageW);
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Paragraf', 'Klausel', 'Status', 'Vermerk']],
      body: strickenDeepClauses.map(c => [
        c.paragraphRef,
        c.title,
        'GESTRICHEN',
        'Vom Nutzer als gestrichen verifiziert',
      ]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      columnStyles: { 2: { fontStyle: 'bold', textColor: [100, 116, 139] }, 3: { fontStyle: 'italic' } },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.text('Gestrichene Klauseln haben keinen Einfluss auf die Gesamtbewertung des Vertragsdokuments.', col1, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
  }

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

    // Embed attendance photo if available
    if (data.attendancePhotoUrl && data.attendancePhotoUrl.startsWith('data:')) {
      if (y > pageH - 60) { doc.addPage(); y = 36; }
      try {
        const imgW = 60;
        const imgH = 45;
        safeAddImage(doc, data.attendancePhotoUrl, col1, y, imgW, imgH);
        doc.setTextColor(...MUTED_COLOR);
        doc.setFontSize(6.5);
        doc.text('Beweisfoto: Anwesenheit der Teilnehmer', col1 + imgW + 4, y + 6);
        if (data.attendancePhotoGeo) {
          const gpsText = formatGeoForPdf(data.attendancePhotoGeo);
          const tsText = formatTimestampForPdf(data.attendancePhotoGeo.timestamp);
          if (tsText) doc.text(tsText, col1 + imgW + 4, y + 10);
          if (gpsText) doc.text(gpsText, col1 + imgW + 4, y + 14);
        }
        y += imgH + 6;
      } catch { /* skip */ }
    }

  // ── §5 Zählerstände ───────────────────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§5  Zählerstände', y, pageW);
  if (data.meterReadings.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Typ / Medium', 'Zählernummer', 'Standort', 'Ablesung', 'Einheit', 'Datum']],
      body: data.meterReadings.map(m => [
        m.medium,
        m.meterNumber || '–',
        m.location || '–',
        m.reading,
        m.unit,
        m.maloId || date,
      ]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // HKV Room Readings sub-table
    const hkvMeters = data.meterReadings.filter(m => m.hkvRoomReadings && m.hkvRoomReadings.length > 0);
    if (hkvMeters.length > 0) {
      if (y > pageH - 50) { doc.addPage(); y = 36; }
      doc.setTextColor(...BRAND_COLOR);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Raumweise HKV-Ablesewerte (Heizkostenverteiler)', col1, y);
      doc.setFont('helvetica', 'normal');
      y += 4;
      const hkvRows: string[][] = [];
      hkvMeters.forEach(m => {
        m.hkvRoomReadings!.forEach(r => {
          hkvRows.push([r.room, r.meterNumber || '–', r.reading, 'Einheiten', m.meterNumber || '–']);
        });
      });
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Raum', 'HKV-Zählernr.', 'Ablesewert', 'Einheit', 'Hauptzähler']],
        body: hkvRows,
        headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right', fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }
    
    // Embed meter photos with GPS
    const meterPhotos = data.meterReadings
      .filter(m => m.photoUrl)
      .map(m => ({
        url: m.photoUrl!,
        label: `${m.medium} – Zähler ${m.meterNumber || '–'}${m.location ? ' (' + m.location + ')' : ''}`,
        timestamp: formatTimestampForPdf(m.photoGeo?.timestamp) || date,
        gps: formatGeoForPdf(m.photoGeo),
        sha256: m.sha256Hash,
      }));
    y = embedPhotos(doc, meterPhotos, y, pageW, pageH, col1);
  } else {
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(8);
    doc.text('Keine Zähler erfasst.', col1, y);
    y += 8;
  }

  // ── §5a Schlüsselrückgabe ─────────────────────────────────────────────────
  if (data.keyEntries && data.keyEntries.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§5a  Schlüsselrückgabe', y, pageW);
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Schlüssel-Typ', 'Anzahl', 'Zustand', 'Notiz']],
      body: data.keyEntries.map(k => [
        k.type,
        String(k.count),
        k.condition === 'gut' ? 'Gut' : k.condition === 'beschädigt' ? 'Beschädigt' : k.condition === 'fehlt' ? 'Fehlt' : '–',
        k.note || '–',
      ]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: TEXT_COLOR },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    const totalKeys = data.keyEntries.reduce((s, k) => s + k.count, 0);
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`Gesamtanzahl übergebener Schlüssel: ${totalKeys}`, col1, y);
    doc.setFont('helvetica', 'normal');
    y += 5;

    // Embed key bundle photo
    if (isValidDataUrl(data.keyBundlePhotoUrl)) {
      if (y > pageH - 60) { doc.addPage(); y = 36; }
      try {
        const imgW = 60;
        const imgH = 45;
        safeAddImage(doc, data.keyBundlePhotoUrl, col1, y, imgW, imgH);
        doc.setTextColor(...MUTED_COLOR);
        doc.setFontSize(6.5);
        doc.text('Beweisfoto: Schlüsselbund bei Übergabe', col1 + imgW + 4, y + 6);
        if (data.keyBundlePhotoGeo) {
          const gpsText = formatGeoForPdf(data.keyBundlePhotoGeo);
          const tsText = formatTimestampForPdf(data.keyBundlePhotoGeo.timestamp);
          if (tsText) { doc.setFontSize(5.5); doc.setFont('helvetica', 'italic'); doc.text(tsText, col1 + imgW + 4, y + 10); }
          if (gpsText) { doc.setFontSize(5.5); doc.text(gpsText, col1 + imgW + 4, y + 14); doc.setFont('helvetica', 'normal'); }
        }
        y += imgH + 6;
      } catch {
        doc.setTextColor(...MUTED_COLOR);
        doc.setFontSize(7);
        doc.text('Beweisfoto: Konnte nicht eingebettet werden.', col1, y);
        y += 6;
      }
    }

    // Legal note
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.text('Der Mieter versichert, alle in seinem Besitz befindlichen Schlüssel (inkl. Duplikate) zurückgegeben zu haben.', col1, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
  }

  // ── §5b Zustand & Sicherheit ──────────────────────────────────────────────
  {
    const hasConditionData = data.cleaningBesenrein || data.cleaningBriefkasten || data.cleaningKeller || data.smokeDetectorChecked || data.wallsNeutralColors !== null;
    if (hasConditionData) {
      if (y > pageH - 60) { doc.addPage(); y = 36; }
      y = sectionTitle(doc, '§5b  Zustand & Sicherheit', y, pageW);
      const condRows: string[][] = [];
      condRows.push(['Wohnung besenrein übergeben', data.cleaningBesenrein ? '☑ Ja' : '☐ Nein']);
      condRows.push(['Briefkasten geleert', data.cleaningBriefkasten ? '☑ Ja' : '☐ Nein']);
      condRows.push(['Keller geräumt', data.cleaningKeller ? '☑ Ja' : '☐ Nein']);
      condRows.push(['Rauchwarnmelder geprüft (LBO SH)', data.smokeDetectorChecked ? '☑ Ja – funktionsgeprüft' : '☐ Nein – NICHT GEPRÜFT']);
      condRows.push(['Wände in neutralen Farben', data.wallsNeutralColors === true ? '☑ Ja' : data.wallsNeutralColors === false ? '☐ Nein – auffällige Farben' : '☐ Nicht geprüft']);
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Prüfpunkt', 'Ergebnis']],
        body: condRows,
        headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: TEXT_COLOR },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      if (!data.smokeDetectorChecked) {
        doc.setTextColor(...DANGER_COLOR);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('⚠ Rauchwarnmelder: Pflichtprüfung gemäß § 49 Abs. 4 LBO Schleswig-Holstein nicht bestätigt.', col1, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
      }
    }
  }

  // ── §5c Technische Funktionsprüfung je Raum ───────────────────────────────
  {
    const roomConfigs = (data as any).__roomConfigs as any[] | undefined;
    const techCheckLabel = (val: any): string => {
      if (!val || val.status === null || val.status === undefined) return '–';
      if (val.status === 'ok') return '☑ OK';
      if (val.status === 'nv') return '⊘ Nicht vorhanden';
      if (val.status === 'ng') return `⚠ Nicht geprüft${val.comment ? ': ' + val.comment : ''}`;
      return '–';
    };
    if (roomConfigs && roomConfigs.length > 0) {
      const hasAnyTechCheck = roomConfigs.some((r: any) => r.windowsDoors || r.sanitary || r.electrical || r.smokeDetector);
      if (hasAnyTechCheck) {
        if (y > pageH - 60) { doc.addPage(); y = 36; }
        y = sectionTitle(doc, '§5c  Technische Funktionsprüfung je Raum', y, pageW);
        const techRows: string[][] = [];
        for (const room of roomConfigs) {
          const checks: [string, any][] = [
            ['Rauchwarnmelder (LBO SH §49)', room.smokeDetector],
            ['Fenster & Türen (§ 538 BGB)', room.windowsDoors],
            ['Sanitär/Wasseranschlüsse', room.sanitary],
            ['Steckdosen/Lichtschalter', room.electrical],
          ];
          // Room-specific
          const nameL = (room.name || '').toLowerCase();
          if (nameL.includes('küche')) {
            checks.push(['Herd/Backofen', room.oven]);
            checks.push(['Spüle/Abfluss', room.sinkDrain]);
          }
          if (nameL.includes('bad') || nameL.includes('wc') || nameL.includes('dusch')) {
            checks.push(['Fliesen/Fugen', room.tilesGrout]);
            checks.push(['Spülung/Armaturen', room.flushFittings]);
          }
          for (const [label, val] of checks) {
            if (val) {
              techRows.push([room.name, label, techCheckLabel(val)]);
            }
          }
        }
        if (techRows.length > 0) {
          autoTable(doc, {
            startY: y,
            margin: { left: 14, right: 14 },
            head: [['Raum', 'Prüfpunkt', 'Ergebnis']],
            body: techRows,
            headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 7.5 },
            bodyStyles: { fontSize: 7.5, textColor: TEXT_COLOR },
            alternateRowStyles: { fillColor: [248, 249, 255] },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 1: { cellWidth: 55 } },
            didParseCell: (hookData: any) => {
              if (hookData.section === 'body' && hookData.column.index === 2) {
                const text = hookData.cell.text?.[0] || '';
                if (text.startsWith('⊘')) {
                  hookData.cell.styles.textColor = [180, 120, 20];
                  hookData.cell.styles.fontStyle = 'bold';
                } else if (text.startsWith('⚠')) {
                  hookData.cell.styles.textColor = DANGER_COLOR;
                  hookData.cell.styles.fontStyle = 'bold';
                }
              }
            },
          });
          y = (doc as any).lastAutoTable.finalY + 4;
        }
      }
    }
  }

  // ── §6  Raum-für-Raum-Dokumentation ────────────────────────────────────────
  const defectFindings = data.findings.filter(f => f.entryType !== 'note');
  const noteFindings = data.findings.filter(f => f.entryType === 'note');

  if (y > pageH - 60) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, isMoveIn ? '§6  Zustandsdokumentation je Raum' : '§6  Bestandsaufnahme & Mängel je Raum', y, pageW);

  if (data.findings.length === 0 && !((data as any).__roomConfigs?.length > 0)) {
    doc.setTextColor(...SUCCESS_COLOR);
    doc.setFontSize(8);
    doc.text('✓ Keine Mängel oder Besonderheiten dokumentiert.', col1, y);
    y += 8;
  } else {
    y = generateRoomSections(doc, data, y, pageW, pageH, col1, date, isMoveIn);
  }

  if (isMoveIn && data.findings.length > 0) {
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5); doc.setFont('helvetica', 'italic');
    doc.text('Dokumentation des Ist-Zustands zur Beweissicherung bei Einzug. Keine Kautionsabzüge.', col1, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
  }

  // ── §7 Kautions-Abrechnung ────────────────────────────────────────────────
  if (!isSale && !isMoveIn) {
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
    const restforderungFinal = !isGuarantee && (defectsCost + nkBuffer) > baseAmount ? (defectsCost + nkBuffer) - baseAmount : 0;

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
        [restforderungFinal > 0 ? '= Offene Restforderung' : '= Auszuzahlender Endbetrag', restforderungFinal > 0 ? `${restforderungFinal.toFixed(2)} €` : `${payoutFinal.toFixed(2)} €`],
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

      if (restforderungFinal > 0) {
        doc.setFillColor(255, 235, 235);
        doc.roundedRect(14, y, pageW - 28, 10, 2, 2, 'F');
        doc.setTextColor(...DANGER_COLOR);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Offene Restforderung: ${restforderungFinal.toFixed(2)} €`, pageW / 2, y + 6.5, { align: 'center' });
      } else {
        doc.setFillColor(230, 255, 240);
        doc.roundedRect(14, y, pageW - 28, 10, 2, 2, 'F');
        doc.setTextColor(...SUCCESS_COLOR);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Auszahlungsbetrag: ${payoutFinal.toFixed(2)} €`, pageW / 2, y + 6.5, { align: 'center' });
      }
      y += 14;

      // Legal basis
      doc.setTextColor(...MUTED_COLOR);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      const basisText = isCash
        ? `Berechnung gemäß BGH VIII ZR 71/05 (NK-Puffer) & BGH VIII ZR 222/15 (Zeitwert-Abzug, § 538 BGB). Zinsen: Kaution × ${interestRate}% × ${interestDays}/360 gem. § 551 Abs. 3 BGB.`
        : `Berechnung gemäß BGH VIII ZR 71/05 (NK-Puffer) & BGH VIII ZR 222/15 (Zeitwert-Abzug). Kontostand laut Sparbuch (Zinsen bankseitig gutgeschrieben).`;
      doc.text(basisText, col1, y);
      y += 4;
      doc.text('Die Kaution wurde gemäß § 551 Abs. 3 BGB getrennt vom Privatvermögen des Vermieters angelegt.', col1, y);
      y += 6;

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

    // ── §7d Zahlungsaufforderung (nur bei Restforderung) ──────────────
    if (restforderungFinal > 0 && (data.payeeIban || data.payeeAccountHolder)) {
      if (y > pageH - 80) { doc.addPage(); y = 36; }
      y = sectionTitle(doc, '§7d  Zahlungsaufforderung (§ 280 Abs. 1 BGB)', y, pageW);
      const deadline14rest = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); })();
      const payeeHolder7d = data.payeeAccountHolder || data.landlordName || 'Vermieter';
      const payeeIban7d = data.payeeIban || '(IBAN nicht angegeben)';

      doc.setFillColor(255, 240, 240);
      const restText = `Die oben aufgeführten Mängel und Einbehalte übersteigen die hinterlegte Kautionssumme von ${deposit.toFixed(2)} €. Wir fordern Sie hiermit auf, den Differenzbetrag in Höhe von ${restforderungFinal.toFixed(2)} € bis spätestens zum ${deadline14rest} auf das unten genannte Konto zu überweisen. Der Anspruch ergibt sich aus § 280 Abs. 1 BGB.`;
      const restLines = doc.splitTextToSize(restText, pageW - 36);
      const restH = restLines.length * 4 + 10;
      doc.roundedRect(14, y, pageW - 28, restH, 2, 2, 'F');
      doc.setTextColor(...DANGER_COLOR);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(restLines, 18, y + 6);
      y += restH + 4;

      // Bankdaten prominent
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(14, y, pageW - 28, 16, 2, 2, 'F');
      doc.setTextColor(...TEXT_COLOR);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Empfänger:', 18, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(`${payeeHolder7d}  ·  IBAN: ${payeeIban7d}`, 18, y + 11);
      y += 20;

      doc.setTextColor(...MUTED_COLOR);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text(`Verwendungszweck: Nachforderung gemäß EstateTurn-Übergabeprotokoll · Objekt: ${data.propertyAddress || '–'}`, col1, y);
      doc.setFont('helvetica', 'normal');
      y += 7;
    }
  }



  // ── §7b Aufforderungsschreiben (§ 281 BGB) ───────────────────────────────
  const damageFindings = data.findings.filter(f => f.recommendedWithholding > 0);
  if (damageFindings.length > 0 && !isSale && !isMoveIn) {
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
    `6. Anerkennung: Dem Mieter wird eine Prüffrist von 14 Tagen eingeräumt. Erfolgt innerhalb dieser Frist kein begründeter Widerspruch gegen die Feststellungen in diesem Protokoll, gilt der dokumentierte Zustand als anerkannt.`,
    `7. GPS-Validierung: Die Beweisfotos (Zähler, Mängel, Schlüssel) wurden mittels Live-GPS-Validierung am Standort ${data.propertyAddress || 'des Objekts'} verifiziert (Geofencing-Radius: 100m). Die erfassten Koordinaten und Zeitstempel sind Bestandteil der SHA-256-Versiegelung dieses Protokolls.`,
  ];
  // Add GPS denial clause if applicable
  if (data.geoPermissionDenied) {
    clauses.push(`8. HINWEIS – GPS-Zugriff verweigert: Der Ersteller dieses Protokolls hat den GPS-Standortzugriff während der Aufnahme abgelehnt. Die Beweisfotos enthalten daher KEINE verifizierten Standortdaten. Dies kann die Beweiskraft dieses Dokuments vor Gericht erheblich einschränken (fehlende Manipulationssicherheit gem. § 371a ZPO).`);
  }
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
    if (party.sig && party.sig.startsWith('data:')) {
      // Embed the actual signature image
      try { doc.addImage(party.sig, 'PNG', party.x + 2, y + 11, sigBoxW - 4, 18, undefined, 'FAST'); } catch { /* skip invalid */ }
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

  // ── §10 Versorgungs-Anhang ──────────────────────────────────────────────
  if (!isMoveIn && data.meterReadings.length > 0) {
    doc.addPage();
    y = 36;
    addHeader(doc, 'Versorgungs-Anhang', `${date} · ID: ${protocolId}`, pageW);
    y = 36;

    // Gold seal for utility appendix
    doc.setFillColor(...GOLD_LIGHT);
    doc.roundedRect(14, y, pageW - 28, 12, 2, 2, 'F');
    doc.setFillColor(...GOLD_COLOR);
    doc.rect(14, y, 2, 12, 'F');
    doc.setTextColor(...GOLD_COLOR);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('EstateTurn Verified · Versorgungs-Nachweis', 20, y + 7);
    y += 16;

    // Meter readings table
    y = sectionTitle(doc, '§10a  Zählerablesungen zur Endabrechnung', y, pageW);
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Typ / Medium', 'Zählernummer', 'Standort', 'Ablesewert', 'Einheit', 'MaLo-ID']],
      body: data.meterReadings.map(m => [
        m.medium,
        m.meterNumber || '–',
        m.location || '–',
        m.reading,
        m.unit,
        m.maloId || '–',
      ]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: TEXT_COLOR },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Embed meter photos
    const meterPhotosAppendix = data.meterReadings
      .filter(m => m.photoUrl && m.photoUrl.startsWith('data:'))
      .map(m => ({
        url: m.photoUrl!,
        label: `${m.medium} – Zähler ${m.meterNumber || '–'}${m.location ? ' (' + m.location + ')' : ''}`,
        timestamp: formatTimestampForPdf(m.photoGeo?.timestamp) || date,
        gps: formatGeoForPdf(m.photoGeo),
        sha256: m.sha256Hash,
      }));
    y = embedPhotos(doc, meterPhotosAppendix, y, pageW, pageH, col1);

    // §10c Legal notice: Tenant responsibility for utility cancellations
    if (y > pageH - 50) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§10c  Hinweis zur Versorgerkündigung', y, pageW);
    doc.setFillColor(255, 248, 235);
    const utilityNoticeText = `Gemäß § 433 BGB i.V.m. aktueller Rechtsprechung (BGH, Urt. v. 22.02.2012 – VIII ZR 34/11) ist der bisherige Mieter (${data.tenantName || 'Mieter'}) eigenverantwortlich für die fristgerechte Kündigung bzw. Ummeldung sämtlicher auf seinen Namen laufenden Versorgungsverträge (Strom, Gas, Internet, Telefon etc.) zum Übergabezeitpunkt verantwortlich. Der Vermieter (${data.landlordName || 'Vermieter'}) übernimmt hierfür keine Haftung. Nicht gekündigte Verträge gehen weiterhin zu Lasten des bisherigen Mieters (§ 546 Abs. 1 BGB).`;
    const utilityNoticeLines = doc.splitTextToSize(utilityNoticeText, pageW - 36);
    const utilityNoticeH = utilityNoticeLines.length * 4 + 10;
    doc.roundedRect(14, y, pageW - 28, utilityNoticeH, 2, 2, 'F');
    doc.setTextColor(120, 90, 20);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(utilityNoticeLines, 18, y + 6);
    y += utilityNoticeH + 6;

    // Confirmation text
    if (y > pageH - 40) { doc.addPage(); y = 36; }
    doc.setFillColor(...GOLD_LIGHT);
    const confirmText = `Hiermit bestätigt der Vermieter ${data.landlordName || '(Name)'} die Richtigkeit der Zählerstände zum ${date} für die Endabrechnung des Mieters ${data.tenantName || '(Name)'}.`;
    const confirmLines = doc.splitTextToSize(confirmText, pageW - 36);
    const confirmH = confirmLines.length * 4 + 10;
    doc.roundedRect(14, y, pageW - 28, confirmH, 2, 2, 'F');
    doc.setTextColor(...BRAND_COLOR);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(confirmLines, 18, y + 6);
    y += confirmH + 6;

    // Financial summary from deposit
    if (!isSale && deposit > 0) {
      y = sectionTitle(doc, '§10b  Finanzielle Zusammenfassung (Kaution)', y, pageW);
      const summaryBody: string[][] = [
        ['Hinterlegte Kaution (Basis)', `${deposit.toFixed(2)} €`],
      ];
      const totalInterest = data.findings.reduce((s, f) => s + f.recommendedWithholding, 0);
      if (totalInterest > 0) {
        summaryBody.push(['./. Mängelkosten', `- ${totalInterest.toFixed(2)} €`]);
      }
      if (nkBuffer > 0) {
        summaryBody.push(['./. NK-Rücklage', `- ${nkBuffer.toFixed(2)} €`]);
      }
      summaryBody.push(['= Auszahlungsbetrag', `${payout.toFixed(2)} €`]);

      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Position', 'Betrag']],
        body: summaryBody,
        headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      // Payout highlight
      doc.setFillColor(230, 255, 240);
      doc.roundedRect(14, y, pageW - 28, 10, 2, 2, 'F');
      doc.setTextColor(...SUCCESS_COLOR);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Endbetrag: ${payout.toFixed(2)} € + Zinsen gem. § 551 BGB`, pageW / 2, y + 6.5, { align: 'center' });
      y += 14;
    }

    // Nachsendeadresse
    if (data.nextAddress) {
      if (y > pageH - 30) { doc.addPage(); y = 36; }
      y = sectionTitle(doc, '§10c  Nachsendeadresse (Mieter)', y, pageW);
      doc.setTextColor(...TEXT_COLOR);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(data.tenantName || 'Mieter', col1, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.text(data.nextAddress, col1, y);
      y += 8;
    }
  }

  // ── Foto-Anhang (alle Mängelfotos) ─────────────────────────────────────────
  const allPhotos = data.findings
    .filter(f => f.photoUrl && f.photoUrl.startsWith('data:'))
    .map(f => ({ url: f.photoUrl!, label: `${f.room || '–'}: ${f.damageType || f.description}`, timestamp: formatTimestampForPdf(f.photoGeo?.timestamp) || f.timestamp, gps: formatGeoForPdf(f.photoGeo), sha256: f.sha256Hash }));
  if (allPhotos.length > 0) {
    doc.addPage();
    y = 36;
    addHeader(doc, 'Foto-Anhang – Mängeldokumentation', `${date} · ID: ${protocolId}`, pageW);
    y = 36;
    y = sectionTitle(doc, 'Beweisfotos aus der Mängelerfassung', y, pageW);
    y = embedPhotos(doc, allPhotos, y, pageW, pageH, col1);
  }

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
  const forderungSuffix = hasRestforderung ? '_Forderung' : '';
  doc.save(`EstateTurn_Protokoll_${safeAddress}_${safeDate}${forderungSuffix}_${protocolId}.pdf`);
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
  const hasRestforderungBlob = (defectsCost + nkBuffer) > deposit && deposit > 0;
  const restforderungAmountBlob = hasRestforderungBlob ? (defectsCost + nkBuffer) - deposit : 0;

  const isMoveIn = data.handoverDirection === 'move-in';

  let protocolTitle: string;
  if (isSale) {
    protocolTitle = 'Übergabeprotokoll (Kauf)';
  } else if (isMoveIn) {
    protocolTitle = 'Einzugsprotokoll & Zustandsbericht';
  } else {
    protocolTitle = 'Übergabeprotokoll (Miete)';
  }

  addHeader(doc, protocolTitle, `${date} · ID: ${protocolId}`, pageW);

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
    head: [['Partei', 'Name', 'E-Mail', 'Mobilnummer', 'Geburtstag', 'Digitale Signatur']],
    body: [
      [isSale ? 'Verkäufer' : 'Vermieter', data.landlordName || '–', data.landlordEmail || '–', data.landlordPhone || '–', data.landlordBirthday || '–',
        data.signatureLandlord ? `✓ Signiert am ${signatureTimestamp}` : 'Nicht unterschrieben'],
      [isSale ? 'Käufer' : 'Mieter', data.tenantName || '–', data.tenantEmail || '–', data.tenantPhone || '–', data.tenantBirthday || '–',
        data.signatureTenant ? `✓ Signiert am ${signatureTimestamp}` : 'Nicht unterschrieben'],
    ],
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Prior/Next address
  if (data.priorAddress || data.nextAddress) {
    const addrLabel2 = data.handoverDirection === 'move-in' ? 'Voranschrift (Mieter)' : 'Nachanschrift (Mieter)';
    const addrValue2 = data.handoverDirection === 'move-in' ? data.priorAddress : data.nextAddress;
    if (addrValue2) {
      labelValue(doc, addrLabel2, addrValue2, col1, y, colW * 2);
      y += 8;
    }
  }

  y = sectionTitle(doc, '§3  Vertragsanalyse (KI-gestützt)', y, pageW);
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Parameter', 'Wert']],
    body: [
      ['Kaltmiete', data.coldRent ? `${data.coldRent} €` : '–'],
      ['NK-Vorauszahlung', data.nkAdvancePayment ? `${data.nkAdvancePayment} €` : '–'],
      ['Heiz-/Warmwasserkosten', data.heatingCosts ? `${data.heatingCosts} €` : '–'],
      ['Gesamtmiete', data.totalRent ? `${data.totalRent} €` : '–'],
      ['Kaution', data.depositAmount ? `${data.depositAmount} €` : '–'],
      ['Zimmeranzahl', data.roomCount || '–'],
      ['Vertragsbeginn', data.contractStart || '–'],
      ['Vertragsende / Befristung', data.contractDuration || data.contractEnd || '–'],
      ['Vertragsart', data.contractType === 'befristet' ? 'Befristet' : data.contractType === 'unbefristet' ? 'Unbefristet' : '–'],
      ['Datum Vertragsunterzeichnung', data.contractSigningDate || '–'],
      ['Kautionsprüfung (§ 551 BGB)', data.depositLegalCheck || 'Nicht geprüft'],
      ['Renovierungsklausel', data.renovationClauseAnalysis || 'Nicht geprüft'],
    ],
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold' } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ── §3a Individuelle Vertragsanpassungen (gestrichene Klauseln) ──────────
  const strickenClauseIds2 = (data.strickenClauses || []).filter(id => id.startsWith('deep-'));
  const strickenDeepClauses2 = (data.deepLegalClauses || []).filter(c =>
    strickenClauseIds2.includes(`deep-${c.paragraphRef}`)
  );
  if (strickenDeepClauses2.length > 0) {
    if (y > pageH - 50) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§3a  Individuelle Vertragsanpassungen', y, pageW);
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Paragraf', 'Klausel', 'Status', 'Vermerk']],
      body: strickenDeepClauses2.map(c => [
        c.paragraphRef,
        c.title,
        'GESTRICHEN',
        'Vom Nutzer als gestrichen verifiziert',
      ]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      columnStyles: { 2: { fontStyle: 'bold', textColor: [100, 116, 139] }, 3: { fontStyle: 'italic' } },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.text('Gestrichene Klauseln haben keinen Einfluss auf die Gesamtbewertung des Vertragsdokuments.', col1, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
  }

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

  // Embed attendance photo (blob version)
  if (data.attendancePhotoUrl && data.attendancePhotoUrl.startsWith('data:')) {
    if (y > pageH - 60) { doc.addPage(); y = 36; }
    try {
      safeAddImage(doc, data.attendancePhotoUrl, col1, y, 60, 45);
      doc.text('Beweisfoto: Anwesenheit der Teilnehmer', col1 + 64, y + 6);
      if (data.attendancePhotoGeo) {
        const gpsText = formatGeoForPdf(data.attendancePhotoGeo);
        const tsText = formatTimestampForPdf(data.attendancePhotoGeo.timestamp);
        if (tsText) { doc.setFontSize(5.5); doc.setFont('helvetica', 'italic'); doc.text(tsText, col1 + 64, y + 10); }
        if (gpsText) { doc.setFontSize(5.5); doc.text(gpsText, col1 + 64, y + 14); doc.setFont('helvetica', 'normal'); }
      }
      y += 51;
    } catch { /* skip */ }
  }

  if (y > pageH - 60) { doc.addPage(); y = 36; }
  y = sectionTitle(doc, '§5  Zählerstände', y, pageW);
  if (data.meterReadings.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Typ / Medium', 'Zählernummer', 'Standort', 'Ablesung', 'Einheit', 'Datum']],
      body: data.meterReadings.map(m => [m.medium, m.meterNumber || '–', m.location || '–', m.reading, m.unit, m.maloId || date]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // HKV Room Readings sub-table (blob)
    const hkvMeters2 = data.meterReadings.filter(m => m.hkvRoomReadings && m.hkvRoomReadings.length > 0);
    if (hkvMeters2.length > 0) {
      if (y > pageH - 50) { doc.addPage(); y = 36; }
      doc.setTextColor(...BRAND_COLOR); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('Raumweise HKV-Ablesewerte (Heizkostenverteiler)', col1, y);
      doc.setFont('helvetica', 'normal'); y += 4;
      const hkvRows2: string[][] = [];
      hkvMeters2.forEach(m => {
        m.hkvRoomReadings!.forEach(r => {
          hkvRows2.push([r.room, r.meterNumber || '–', r.reading, 'Einheiten', m.meterNumber || '–']);
        });
      });
      autoTable(doc, {
        startY: y, margin: { left: 14, right: 14 },
        head: [['Raum', 'HKV-Zählernr.', 'Ablesewert', 'Einheit', 'Hauptzähler']],
        body: hkvRows2,
        headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right', fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Embed meter photos (blob)
    const meterPhotos2 = data.meterReadings
      .filter(m => m.photoUrl)
      .map(m => ({ url: m.photoUrl!, label: `${m.medium} – Zähler ${m.meterNumber || '–'}${m.location ? ' (' + m.location + ')' : ''}`, timestamp: formatTimestampForPdf(m.photoGeo?.timestamp) || date, gps: formatGeoForPdf(m.photoGeo), sha256: m.sha256Hash }));
    y = embedPhotos(doc, meterPhotos2, y, pageW, pageH, col1);
  } else {
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(8);
    doc.text('Keine Zähler erfasst.', col1, y); y += 8;
  }

  // ── §5a Schlüsselrückgabe (blob) ──────────────────────────────────────────
  if (data.keyEntries && data.keyEntries.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§5a  Schlüsselrückgabe', y, pageW);
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14 },
      head: [['Schlüssel-Typ', 'Anzahl', 'Zustand', 'Notiz']],
      body: data.keyEntries.map(k => [
        k.type, String(k.count),
        k.condition === 'gut' ? 'Gut' : k.condition === 'beschädigt' ? 'Beschädigt' : k.condition === 'fehlt' ? 'Fehlt' : '–',
        k.note || '–',
      ]),
      headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: TEXT_COLOR },
      alternateRowStyles: { fillColor: [248, 249, 255] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 28, halign: 'center' } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    const totalKeys2 = data.keyEntries.reduce((s, k) => s + k.count, 0);
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text(`Gesamtanzahl übergebener Schlüssel: ${totalKeys2}`, col1, y);
    doc.setFont('helvetica', 'normal'); y += 5;
    if (data.keyBundlePhotoUrl) {
      if (y > pageH - 60) { doc.addPage(); y = 36; }
      try {
        safeAddImage(doc, data.keyBundlePhotoUrl, col1, y, 60, 45);
        doc.text('Beweisfoto: Schlüsselbund bei Übergabe', col1 + 64, y + 6);
        if (data.keyBundlePhotoGeo) {
          const gpsText = formatGeoForPdf(data.keyBundlePhotoGeo);
          const tsText = formatTimestampForPdf(data.keyBundlePhotoGeo.timestamp);
          if (tsText) { doc.setFontSize(5.5); doc.setFont('helvetica', 'italic'); doc.text(tsText, col1 + 64, y + 10); }
          if (gpsText) { doc.setFontSize(5.5); doc.text(gpsText, col1 + 64, y + 14); doc.setFont('helvetica', 'normal'); }
        }
        y += 51;
      } catch { y += 6; }
    }
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5); doc.setFont('helvetica', 'italic');
    doc.text('Der Mieter versichert, alle in seinem Besitz befindlichen Schlüssel (inkl. Duplikate) zurückgegeben zu haben.', col1, y);
    doc.setFont('helvetica', 'normal'); y += 7;
  }

  // ── §5b Zustand & Sicherheit (blob) ───────────────────────────────────────
  {
    const hasConditionData2 = data.cleaningBesenrein || data.cleaningBriefkasten || data.cleaningKeller || data.smokeDetectorChecked || data.wallsNeutralColors !== null;
    if (hasConditionData2) {
      if (y > pageH - 60) { doc.addPage(); y = 36; }
      y = sectionTitle(doc, '§5b  Zustand & Sicherheit', y, pageW);
      const condRows2: string[][] = [
        ['Wohnung besenrein übergeben', data.cleaningBesenrein ? '☑ Ja' : '☐ Nein'],
        ['Briefkasten geleert', data.cleaningBriefkasten ? '☑ Ja' : '☐ Nein'],
        ['Keller geräumt', data.cleaningKeller ? '☑ Ja' : '☐ Nein'],
        ['Rauchwarnmelder geprüft (LBO SH)', data.smokeDetectorChecked ? '☑ Ja – funktionsgeprüft' : '☐ Nein – NICHT GEPRÜFT'],
        ['Wände in neutralen Farben', data.wallsNeutralColors === true ? '☑ Ja' : data.wallsNeutralColors === false ? '☐ Nein – auffällige Farben' : '☐ Nicht geprüft'],
      ];
      autoTable(doc, {
        startY: y, margin: { left: 14, right: 14 },
        head: [['Prüfpunkt', 'Ergebnis']],
        body: condRows2,
        headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: TEXT_COLOR },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      if (!data.smokeDetectorChecked) {
        doc.setTextColor(...DANGER_COLOR); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        doc.text('⚠ Rauchwarnmelder: Pflichtprüfung gemäß § 49 Abs. 4 LBO Schleswig-Holstein nicht bestätigt.', col1, y);
        doc.setFont('helvetica', 'normal'); y += 6;
      }
    }
  }

  if (y > pageH - 60) { doc.addPage(); y = 36; }
  const bghRef = isSale ? 'BGH V ZR 104/19 (Kaufrecht)' : 'BGH VIII ZR 222/15 (Wohnraummietrecht)';
  const defectFindings2 = data.findings.filter(f => f.entryType !== 'note');
  const noteFindings2 = data.findings.filter(f => f.entryType === 'note');

  y = sectionTitle(doc, isMoveIn ? '§6  Zustandsdokumentation je Raum' : '§6  Bestandsaufnahme & Mängel je Raum', y, pageW);

  if (data.findings.length === 0 && !((data as any).__roomConfigs?.length > 0)) {
    doc.setTextColor(...SUCCESS_COLOR); doc.setFontSize(8);
    doc.text('✓ Keine Mängel oder Besonderheiten dokumentiert.', col1, y); y += 8;
  } else {
    y = generateRoomSections(doc, data, y, pageW, pageH, col1, date, isMoveIn);
  }

  if (isMoveIn && data.findings.length > 0) {
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5); doc.setFont('helvetica', 'italic');
    doc.text('Dokumentation des Ist-Zustands zur Beweissicherung bei Einzug. Keine Kautionsabzüge.', col1, y);
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
    const restforderungFinal2 = (defectsCost + nkBuffer) > gross2 ? (defectsCost + nkBuffer) - gross2 : 0;

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
      [restforderungFinal2 > 0 ? '= Offene Restforderung' : '= Auszuzahlender Endbetrag', restforderungFinal2 > 0 ? `${restforderungFinal2.toFixed(2)} €` : `${payoutFinal2.toFixed(2)} €`],
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
    if (restforderungFinal2 > 0) {
      doc.setFillColor(255, 235, 235);
      doc.roundedRect(14, y, pageW - 28, 10, 2, 2, 'F');
      doc.setTextColor(...DANGER_COLOR); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(`Offene Restforderung: ${restforderungFinal2.toFixed(2)} €`, pageW / 2, y + 6.5, { align: 'center' });
    } else {
      doc.setFillColor(230, 255, 240);
      doc.roundedRect(14, y, pageW - 28, 10, 2, 2, 'F');
      doc.setTextColor(...SUCCESS_COLOR); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(`Auszahlungsbetrag: ${payoutFinal2.toFixed(2)} €`, pageW / 2, y + 6.5, { align: 'center' });
    }
    y += 14;
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7); doc.setFont('helvetica', 'italic');
    doc.text(`Berechnung gemäß BGH VIII ZR 71/05 (NK-Puffer) & ${bghRef} (Zeitwert-Abzug, § 538 BGB). Zinsen gemäß § 551 Abs. 3 BGB.`, col1, y);
    y += 4;
    doc.text('Die Kaution wurde gemäß § 551 Abs. 3 BGB getrennt vom Privatvermögen des Vermieters angelegt.', col1, y);
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
    // ── §7d Zahlungsaufforderung (nur bei Restforderung) ──────────────
    if (restforderungFinal2 > 0 && (data.payeeIban || data.payeeAccountHolder)) {
      if (y > pageH - 80) { doc.addPage(); y = 36; }
      y = sectionTitle(doc, '§7d  Zahlungsaufforderung (§ 280 Abs. 1 BGB)', y, pageW);
      const deadline14rest2 = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); })();
      const payeeHolder7d2 = data.payeeAccountHolder || data.landlordName || 'Vermieter';
      const payeeIban7d2 = data.payeeIban || '(IBAN nicht angegeben)';

      doc.setFillColor(255, 240, 240);
      const restText2 = `Die oben aufgeführten Mängel und Einbehalte übersteigen die hinterlegte Kautionssumme von ${deposit.toFixed(2)} €. Wir fordern Sie hiermit auf, den Differenzbetrag in Höhe von ${restforderungFinal2.toFixed(2)} € bis spätestens zum ${deadline14rest2} auf das unten genannte Konto zu überweisen. Der Anspruch ergibt sich aus § 280 Abs. 1 BGB.`;
      const restLines2 = doc.splitTextToSize(restText2, pageW - 36);
      const restH2 = restLines2.length * 4 + 10;
      doc.roundedRect(14, y, pageW - 28, restH2, 2, 2, 'F');
      doc.setTextColor(...DANGER_COLOR); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      doc.text(restLines2, 18, y + 6);
      y += restH2 + 4;

      doc.setFillColor(238, 242, 255);
      doc.roundedRect(14, y, pageW - 28, 16, 2, 2, 'F');
      doc.setTextColor(...TEXT_COLOR); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('Empfänger:', 18, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(`${payeeHolder7d2}  ·  IBAN: ${payeeIban7d2}`, 18, y + 11);
      y += 20;

      doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7); doc.setFont('helvetica', 'italic');
      doc.text(`Verwendungszweck: Nachforderung gemäß EstateTurn-Übergabeprotokoll · Objekt: ${data.propertyAddress || '–'}`, col1, y);
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
    `6. Anerkennung: Dem Mieter wird eine Prüffrist von 14 Tagen eingeräumt. Erfolgt innerhalb dieser Frist kein begründeter Widerspruch gegen die Feststellungen in diesem Protokoll, gilt der dokumentierte Zustand als anerkannt.`,
    isSale ? `7. Kaufrecht: Mängelansprüche richten sich nach § 434 BGB i.V.m. ${bghRef}.` : `7. Mietrecht: Kautions-Abrechnung gemäß § 551 BGB, Zeitwert-Abzug gemäß ${bghRef}.`,
    `8. GPS-Validierung: Die Zählerstände wurden mittels Live-GPS-Validierung am Standort ${data.propertyAddress || 'des Objekts'} verifiziert. Die erfassten Koordinaten und Zeitstempel sind Bestandteil dieses Protokolls.`,
  ];
  const clauseLines = clauses.flatMap(c => doc.splitTextToSize(c, pageW - 36));
  const clauseH = clauseLines.length * 3.8 + 8;
  doc.roundedRect(14, y, pageW - 28, clauseH, 2, 2, 'F');
  doc.setTextColor(120, 80, 20); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(clauseLines, 18, y + 5); y += clauseH + 6;

  // §8b – Zukünftige Erreichbarkeit des Mieters (Nachsendeadresse)
  if (!isSale && data.nextAddress) {
    if (y > pageH - 50) { doc.addPage(); y = 36; }
    y = sectionTitle(doc, '§8b  Zukünftige Erreichbarkeit des Mieters', y, pageW);
    doc.setFillColor(238, 242, 255);
    const addrBoxH = 18;
    doc.roundedRect(14, y, pageW - 28, addrBoxH, 2, 2, 'F');
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('Neue Anschrift (für Endabrechnung, Kautionsrückzahlung & Nachsendung):', 18, y + 5);
    doc.setTextColor(...TEXT_COLOR); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(data.nextAddress, 18, y + 11);
    doc.setTextColor(...MUTED_COLOR); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text(`Angegeben von: ${data.tenantName || 'Mieter'} am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 18, y + 16);
    y += addrBoxH + 6;
  }

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
    if (party2.sig && party2.sig.startsWith('data:')) {
      try {
        doc.addImage(party2.sig, 'PNG', party2.x + 2, y + 11, sigBoxW2 - 4, 18, undefined, 'FAST');
      } catch { /* signature image invalid – skip */ }
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

  // ── Foto-Anhang (blob) ─────────────────────────────────────────────────────
  const allPhotos2 = data.findings
    .filter(f => f.photoUrl && f.photoUrl.startsWith('data:'))
    .map(f => ({ url: f.photoUrl!, label: `${f.room || '–'}: ${f.damageType || f.description}`, timestamp: formatTimestampForPdf(f.photoGeo?.timestamp) || f.timestamp, gps: formatGeoForPdf(f.photoGeo), sha256: f.sha256Hash }));
  if (allPhotos2.length > 0) {
    doc.addPage();
    let yAppendix = 36;
    addHeader(doc, 'Foto-Anhang – Mängeldokumentation', `${date} · ID: ${protocolId}`, pageW);
    yAppendix = 36;
    yAppendix = sectionTitle(doc, 'Beweisfotos aus der Mängelerfassung', yAppendix, pageW);
    embedPhotos(doc, allPhotos2, yAppendix, pageW, pageH, col1);
  }

  const totalPages2 = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages2; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages2, pageW, pageH);
  }

  return doc.output('blob');
}
