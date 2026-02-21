import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const transactionType = formData.get('transactionType') as string || 'rental';
    const documentType = formData.get('documentType') as string || 'main-contract';

    // Support multiple files (multi-page)
    const files: File[] = [];
    let i = 0;
    while (true) {
      const f = formData.get(`file_${i}`) as File | null;
      if (!f) {
        // fallback: single file
        const single = formData.get('file') as File | null;
        if (single && i === 0) files.push(single);
        break;
      }
      files.push(f);
      i++;
    }

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Keine Datei hochgeladen' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API Key nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSale = transactionType === 'sale';

    // Helper: chunked base64 encoding (avoids stack overflow for large files)
    function uint8ToBase64(bytes: Uint8Array): string {
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
      }
      return btoa(binary);
    }

    // Build parts for all pages (limit to first 5 pages for performance)
    const parts: any[] = [];
    const maxPages = Math.min(files.length, 5);

    for (let idx = 0; idx < maxPages; idx++) {
      const file = files[idx];
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = uint8ToBase64(new Uint8Array(arrayBuffer));
      const mimeType = file.type || 'application/pdf';
      parts.push({
        inlineData: { mimeType, data: base64Data }
      });
    }

    // Build tailored prompt based on document type
    let docTypeLabel = '';
    let extraFields = '';

    if (documentType === 'main-contract') {
      docTypeLabel = isSale ? 'Kaufvertrag' : 'Mietvertrag';
      extraFields = `
- "propertyAddress": Die vollständige Objektadresse
- "landlordName": Name ${isSale ? 'des Verkäufers' : 'des Vermieters'}
- "landlordEmail": E-Mail ${isSale ? 'des Verkäufers' : 'des Vermieters'} (falls vorhanden, sonst "")
- "tenantName": Name ${isSale ? 'des Käufers' : 'des Mieters'}
- "tenantEmail": E-Mail ${isSale ? 'des Käufers' : 'des Mieters'} (falls vorhanden, sonst "")
- "depositAmount": ${isSale ? 'Kaufpreis' : 'Kautionshöhe'} als Zahl in Euro (nur die Zahl, z.B. "2400")
- "coldRent": Aktuelle Kaltmiete in Euro als Zahl (nur bei Mietvertrag, sonst "")
- "nkAdvancePayment": Aktuelle Nebenkostenvorauszahlung in Euro als Zahl (nur bei Mietvertrag, sonst "")
- "contractStart": Vertragsbeginn im Format YYYY-MM-DD
- "contractEnd": Vertragsende im Format YYYY-MM-DD (falls unbefristet, dann "")
- "depositLegalCheck": Prüfung der ${isSale ? 'Zahlungsbedingungen' : 'Kaution gegen § 551 BGB'} - ist die Höhe zulässig? Max. 3 Nettokaltmieten bei Mietvertrag. Kurze Bewertung in 1-2 Sätzen.
- "renovationClauseAnalysis": Analyse der Schönheitsreparaturklauseln nach aktueller BGH-Rechtsprechung. Sind starre Fristen enthalten? Ist die Klausel wirksam? Kurze Bewertung in 1-2 Sätzen.`;
    } else if (documentType === 'amendment') {
      docTypeLabel = 'Miet-Nachtrag / Änderungsvereinbarung';
      extraFields = `
- "coldRent": Neue/aktuelle Kaltmiete in Euro als Zahl (falls geändert, sonst "")
- "nkAdvancePayment": Neue Nebenkostenvorauszahlung in Euro als Zahl (falls geändert, sonst "")
- "contractStart": Datum des Nachtrags im Format YYYY-MM-DD
- "amendmentSummary": Kurze Zusammenfassung der wesentlichen Änderungen in 1-2 Sätzen`;
    } else if (documentType === 'handover-protocol') {
      docTypeLabel = 'Übergabeprotokoll / Einzugsprotokoll';
      extraFields = `
- "propertyAddress": Objektadresse falls erkennbar, sonst ""
- "preDamages": Auflistung aller im Protokoll vermerkten Vorschäden und Mängel. Jeder Eintrag mit Raum und Beschreibung, kommagetrennt. Falls keine vorhanden: ""
- "contractStart": Datum des Protokolls im Format YYYY-MM-DD
- "protocolSummary": Kurze Zusammenfassung des Zustands der Wohnung in 1-2 Sätzen`;
    } else if (documentType === 'utility-bill') {
      docTypeLabel = 'Nebenkostenabrechnung';
      extraFields = `
- "nkAdvancePayment": Bisher geleistete Vorauszahlungen pro Monat in Euro als Zahl (falls erkennbar)
- "nkTotal": Gesamte NK-Kosten des Abrechnungsjahres in Euro als Zahl
- "nkBalance": Nachzahlungsbetrag (positiv) oder Guthaben (negativ) in Euro als Zahl
- "contractStart": Abrechnungszeitraum Beginn im Format YYYY-MM-DD
- "contractEnd": Abrechnungszeitraum Ende im Format YYYY-MM-DD
- "billSummary": Kurze Bewertung des Puffers - ist die aktuelle Vorauszahlung ausreichend? 1-2 Sätze.`;
    }

    const prompt = `Du bist ein deutscher Immobilienrechtsexperte und Gutachter.
Analysiere alle bereitgestellten Seiten (${maxPages} Seite${maxPages > 1 ? 'n' : ''}) dieses Dokuments: ${docTypeLabel}.

Extrahiere die folgenden Informationen als JSON:
${extraFields}

WICHTIG: 
- Antworte NUR mit validem JSON, keine Erklärungen davor oder danach.
- Felder, die nicht gefunden werden, mit leerem String "" befüllen, nicht weglassen.
- Zahlen ohne Währungssymbol, nur die Zahl (z.B. "1250" nicht "1.250 €").`;

    parts.push({ text: prompt });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Fehler bei der KI-Analyse', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiResult = await geminiResponse.json();
    const textContent = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse Gemini response as JSON:', textContent);
      return new Response(
        JSON.stringify({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: textContent }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: parsedData, pageCount: maxPages }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-contract:', error);
    return new Response(
      JSON.stringify({ error: 'Interner Serverfehler', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
