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

    const files: File[] = [];
    let i = 0;
    while (true) {
      const f = formData.get(`file_${i}`) as File | null;
      if (!f) {
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

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSale = transactionType === 'sale';

    function uint8ToBase64(bytes: Uint8Array): string {
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
      }
      return btoa(binary);
    }

    const imageParts: any[] = [];
    const maxPages = Math.min(files.length, 5);

    for (let idx = 0; idx < maxPages; idx++) {
      const file = files[idx];
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = uint8ToBase64(new Uint8Array(arrayBuffer));
      const mimeType = file.type || 'application/pdf';
      imageParts.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64Data}` }
      });
    }

    let docTypeLabel = '';
    let extraFields = '';

    if (documentType === 'main-contract') {
      docTypeLabel = isSale ? 'Kaufvertrag' : 'Mietvertrag';
      extraFields = `
- "propertyAddress": Die vollständige Objektadresse
- "landlordName": Name ${isSale ? 'des Verkäufers' : 'des Vermieters'}
- "landlordEmail": E-Mail ${isSale ? 'des Verkäufers' : 'des Vermieters'} (falls vorhanden, sonst "")
- "landlordPhone": Mobilnummer/Telefonnummer ${isSale ? 'des Verkäufers' : 'des Vermieters'} (falls vorhanden, sonst ""). Suche intensiv im gesamten Dokument, auch in Kopfzeilen, Fußzeilen und Kontaktblöcken.
- "landlordBirthday": Geburtsdatum ${isSale ? 'des Verkäufers' : 'des Vermieters'} im Format TT.MM.JJJJ (falls vorhanden, sonst ""). Suche auch nach Datumsangaben in Personendatenblöcken.
- "tenantName": Name ${isSale ? 'des Käufers' : 'des Mieters'}
- "tenantEmail": E-Mail ${isSale ? 'des Käufers' : 'des Mieters'} (falls vorhanden, sonst "")
- "tenantPhone": Mobilnummer/Telefonnummer ${isSale ? 'des Käufers' : 'des Mieters'} (falls vorhanden, sonst ""). Suche intensiv im gesamten Dokument, auch in Kopfzeilen, Fußzeilen, handschriftlichen Ergänzungen und Kontaktblöcken. Format z.B. "+49 152 57024760".
- "tenantBirthday": Geburtsdatum ${isSale ? 'des Käufers' : 'des Mieters'} im Format TT.MM.JJJJ (falls vorhanden, sonst ""). Suche auch nach Angaben wie "geb." oder "geboren am" oder Datumsformaten wie "12 09 1982" die als Geburtsdatum interpretiert werden können.
- "priorAddress": Bisherige/vorherige Adresse ${isSale ? 'des Käufers' : 'des Mieters'} (falls vorhanden, sonst ""). Suche nach "bisherige Anschrift", "Voranschrift", "alte Adresse" o.ä.
- "roomCount": Anzahl der Zimmer der Wohnung/des Objekts als Zahl (z.B. "3"). Falls nicht erkennbar, "".
- "contractStart": Mietvertragsbeginn / Übergabedatum im Format TT.MM.JJJJ
- "contractDuration": "unbefristet" wenn unbefristet, oder das Enddatum im Format TT.MM.JJJJ wenn befristet
- "contractType": "unbefristet" oder "befristet" – suche nach Formulierungen wie "auf unbestimmte Zeit" (= unbefristet) oder "befristet bis"
- "contractSigningDate": Datum der Vertragsunterzeichnung im Format TT.MM.JJJJ. Suche am Ende des Dokuments nach Datumsangaben neben den Unterschriften.
- "coldRent": Aktuelle Nettokaltmiete in Euro als Zahl (nur die Zahl, z.B. "800")
- "nkAdvancePayment": Betriebskostenvorauszahlung in Euro als Zahl (ohne Heizkosten, z.B. "150")
- "heatingCosts": Heiz- und Warmwasserkosten-Vorauszahlung in Euro als Zahl (z.B. "80"). Falls nicht separat ausgewiesen, "".
- "depositAmount": ${isSale ? 'Kaufpreis' : 'Kautionshöhe'} als Zahl in Euro (nur die Zahl, z.B. "2400")
- "depositLegalCheck": Prüfe die ${isSale ? 'Zahlungsbedingungen' : 'Kaution gegen § 551 Abs. 1 BGB'}. ${isSale ? '' : 'Ist die Kaution höher als 3 Nettokaltmieten? Berechne: 3 × Kaltmiete und vergleiche mit der Kaution.'} Kurze Bewertung in 1 Satz.
- "depositLegalStatus": Bewertung der Kaution: "safe" wenn gesetzeskonform, "warning" wenn grenzwertig, "invalid" wenn rechtswidrig
- "smallRepairAnalysis": Prüfe die Kleinreparaturklausel: Gibt es eine Obergrenze je Einzelfall? Liegt sie über 110-120€? Gibt es eine Jahreshöchstgrenze über 8% der Jahresmiete? Kurze Bewertung in 1 Satz.
- "smallRepairStatus": "safe" wenn Klausel fehlt oder rechtssicher, "warning" wenn grenzwertig, "invalid" wenn unwirksam
- "endRenovationAnalysis": Prüfe Schönheitsreparatur-/Endrenovierungsklauseln: Enthalten sie starre Fristenregelungen (z.B. "alle 3 Jahre Küche, alle 5 Jahre Bad")? Gibt es eine Endrenovierungspflicht unabhängig vom Zustand? Suche auch nach handschriftlichen Ergänzungen wie "Weiß-Streich-Klausel". Kurze Bewertung in 1 Satz.
- "endRenovationStatus": "safe" wenn keine problematische Klausel, "warning" wenn prüfenswert, "invalid" wenn nach BGH VIII ZR 308/02 unwirksam
- "depositSourceRef": Quellennachweis für die Kautionsklausel im Vertrag, z.B. "§ 6 Abs. 1 – Kaution". Nenne den genauen Paragrafen und Absatz aus dem Dokument. Falls nicht zuordbar: ""
- "smallRepairSourceRef": Quellennachweis für die Kleinreparaturklausel, z.B. "§ 16 Abs. 6 – Kleinreparaturen". Nenne den genauen Paragrafen und Absatz. Falls nicht zuordbar: ""
- "endRenovationSourceRef": Quellennachweis für die Renovierungs-/Schönheitsreparaturklausel, z.B. "§ 27 – Schönheitsreparaturen". Nenne den genauen Paragrafen und Absatz. Falls nicht zuordbar: ""
- "confidence": Ein JSON-Objekt mit Feldnamen als Keys und Werten "high", "medium" oder "low" je nachdem, wie sicher die Extraktion war. Z.B. {"coldRent": "high", "roomCount": "low"}`;
    } else if (documentType === 'amendment') {
      docTypeLabel = 'Miet-Nachtrag / Änderungsvereinbarung';
      extraFields = `
- "coldRent": Neue/aktuelle Kaltmiete in Euro als Zahl (falls geändert, sonst "")
- "nkAdvancePayment": Neue Nebenkostenvorauszahlung in Euro als Zahl (falls geändert, sonst "")
- "heatingCosts": Neue Heiz-/Warmwasserkosten in Euro als Zahl (falls geändert, sonst "")
- "contractStart": Datum des Nachtrags im Format TT.MM.JJJJ
- "amendmentSummary": Kurze Zusammenfassung der wesentlichen Änderungen in 1-2 Sätzen
- "confidence": Ein JSON-Objekt mit Feldnamen als Keys und Werten "high", "medium" oder "low"`;
    } else if (documentType === 'handover-protocol') {
      docTypeLabel = 'Übergabeprotokoll / Einzugsprotokoll';
      extraFields = `
- "propertyAddress": Objektadresse falls erkennbar, sonst ""
- "preDamages": Auflistung aller im Protokoll vermerkten Vorschäden und Mängel. Jeder Eintrag mit Raum und Beschreibung, kommagetrennt. Falls keine vorhanden: ""
- "contractStart": Datum des Protokolls im Format TT.MM.JJJJ
- "protocolSummary": Kurze Zusammenfassung des Zustands der Wohnung in 1-2 Sätzen
- "confidence": Ein JSON-Objekt mit Feldnamen als Keys und Werten "high", "medium" oder "low"`;
    } else if (documentType === 'utility-bill') {
      docTypeLabel = 'Nebenkostenabrechnung';
      extraFields = `
- "nkAdvancePayment": Bisher geleistete Vorauszahlungen pro Monat in Euro als Zahl (falls erkennbar)
- "heatingCosts": Heizkosten-Anteil pro Monat in Euro als Zahl (falls separat erkennbar, sonst "")
- "nkTotal": Gesamte NK-Kosten des Abrechnungsjahres in Euro als Zahl
- "nkBalance": Nachzahlungsbetrag (positiv) oder Guthaben (negativ) in Euro als Zahl
- "contractStart": Abrechnungszeitraum Beginn im Format TT.MM.JJJJ
- "contractEnd": Abrechnungszeitraum Ende im Format TT.MM.JJJJ
- "billSummary": Kurze Bewertung des Puffers - ist die aktuelle Vorauszahlung ausreichend? 1-2 Sätze.
- "confidence": Ein JSON-Objekt mit Feldnamen als Keys und Werten "high", "medium" oder "low"`;
    }

    const prompt = `Du bist ein deutscher Immobilienrechtsexperte und Gutachter.
Analysiere alle bereitgestellten Seiten (${maxPages} Seite${maxPages > 1 ? 'n' : ''}) dieses Dokuments: ${docTypeLabel}.

Extrahiere die folgenden Informationen als JSON:
${extraFields}

WICHTIG: 
- Antworte NUR mit validem JSON, keine Erklärungen davor oder danach.
- Felder, die nicht gefunden werden, mit leerem String "" befüllen, nicht weglassen.
- Zahlen ohne Währungssymbol, nur die Zahl (z.B. "1250" nicht "1.250 €").
- Datumsformat immer TT.MM.JJJJ (z.B. "01.01.2024").
- Das "confidence"-Objekt MUSS für jedes extrahierte Feld einen Eintrag haben.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              ...imageParts,
              { type: 'text', text: prompt },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'KI-Kontingent aufgebraucht. Bitte Credits aufladen.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Fehler bei der KI-Analyse', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const textContent = result.choices?.[0]?.message?.content || '';

    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse AI response as JSON:', textContent);
      return new Response(
        JSON.stringify({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: textContent }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compute totalRent if we have the component parts
    if (documentType === 'main-contract') {
      const cold = parseFloat(parsedData.coldRent) || 0;
      const nk = parseFloat(parsedData.nkAdvancePayment) || 0;
      const heating = parseFloat(parsedData.heatingCosts) || 0;
      if (cold > 0) {
        parsedData.totalRent = String(cold + nk + heating);
      } else {
        parsedData.totalRent = '';
      }
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
