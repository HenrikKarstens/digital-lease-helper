import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function extractFiles(formData: FormData, prefix: string): Promise<File[]> {
  const files: File[] = [];
  let i = 0;
  while (true) {
    const f = formData.get(`${prefix}_${i}`) as File | null;
    if (!f) {
      const single = formData.get(prefix) as File | null;
      if (single && i === 0) files.push(single);
      break;
    }
    files.push(f);
    i++;
  }
  return files;
}

async function filesToImageParts(files: File[], maxPages: number): Promise<any[]> {
  const parts: any[] = [];
  const limit = Math.min(files.length, maxPages);
  for (let idx = 0; idx < limit; idx++) {
    const file = files[idx];
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = uint8ToBase64(new Uint8Array(arrayBuffer));
    const mimeType = file.type || 'application/pdf';
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${base64Data}` }
    });
  }
  return parts;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const mode = (formData.get('mode') as string) || 'deep-check';

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Mode: Delta-Check (move-in vs move-out protocol comparison) ──
    if (mode === 'delta-check') {
      const moveInFiles = await extractFiles(formData, 'movein');
      const moveOutFiles = await extractFiles(formData, 'moveout');

      if (moveInFiles.length === 0 || moveOutFiles.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Beide Protokolle (Einzug + Auszug) werden benötigt.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const moveInParts = await filesToImageParts(moveInFiles, 5);
      const moveOutParts = await filesToImageParts(moveOutFiles, 5);

      const deltaPrompt = `Du bist ein deutscher Mietrechtsexperte. Dir liegen zwei Übergabeprotokolle vor:
- TEIL 1 (erste ${moveInParts.length} Bilder): Das EINZUGSPROTOKOLL (Zustand bei Mietbeginn)
- TEIL 2 (nächste ${moveOutParts.length} Bilder): Das AUSZUGSPROTOKOLL (aktueller Zustand bei Auszug)

Führe einen DELTA-CHECK durch: Vergleiche Raum für Raum und Element für Element.

Antworte NUR mit einem JSON-Objekt mit folgender Struktur:
{
  "comparisons": [
    {
      "room": "Raum-Name (z.B. 'Küche', 'Bad', 'Wohnzimmer')",
      "element": "Element (z.B. 'Boden', 'Wände', 'Fenster', 'Herd')",
      "moveInCondition": "Zustand laut Einzugsprotokoll (wörtlich zitieren wenn möglich)",
      "moveOutCondition": "Zustand laut Auszugsprotokoll (wörtlich zitieren wenn möglich)",
      "delta": "unchanged" | "new_damage" | "pre_existing" | "improved",
      "liability": "tenant" | "none" | "landlord",
      "reasoning": "Kurze Begründung (1-2 Sätze). Bei 'pre_existing': Verweis auf § 538 BGB (vertragsgemäßer Gebrauch).",
      "severity": 1-10
    }
  ],
  "summary": {
    "totalItems": Zahl,
    "preExisting": Zahl,
    "newDamages": Zahl,
    "unchanged": Zahl,
    "tenantLiabilityEstimate": "Geschätzter Haftungsbetrag in Euro oder 'keine Haftung'"
  }
}

REGELN:
- Schäden, die BEREITS im Einzugsprotokoll dokumentiert sind, erhalten delta="pre_existing" und liability="none".
- Gemäß § 538 BGB haftet der Mieter NICHT für Veränderungen durch vertragsgemäßen Gebrauch.
- Nur NEUE Schäden, die nicht im Einzugsprotokoll stehen, erhalten delta="new_damage".
- Antworte NUR mit validem JSON.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: [
              ...moveInParts,
              ...moveOutParts,
              { type: 'text', text: deltaPrompt },
            ],
          }],
          temperature: 0.1,
          max_tokens: 8192,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'KI-Kontingent aufgebraucht.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Fehler bei der KI-Analyse', details: errorText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
        console.error('Failed to parse delta-check response:', textContent);
        return new Response(JSON.stringify({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: textContent }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(
        JSON.stringify({ success: true, mode: 'delta-check', ...parsedData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Mode: Deep Paragraph Check ──────────────────────────────────
    const files = await extractFiles(formData, 'file');

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Keine Datei hochgeladen' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageParts = await filesToImageParts(files, 8);

    // ── PASS 1: Dedicated Strike Detection Scan (per page) ──────────
    console.log(`Starting strike detection scan across ${imageParts.length} pages...`);
    
    const strikeDetectionPrompt = `Du bist ein visueller Dokumentenanalyst. Deine EINZIGE Aufgabe ist es, durchgestrichene Textpassagen in diesem Dokument zu erkennen.

AUFGABE: Scanne JEDE Zeile und JEDEN Paragraphen auf diesem Bild nach visuellen Streichungsmerkmalen:
- Horizontale Linien, die über Textblöcke gezogen wurden (handschriftlich oder gedruckt)
- Diagonale Durchstreichungen über Absätze oder einzelne Wörter/Sätze
- X-förmige Markierungen über Textblöcken
- Mehrere parallele Linien über Text
- Einzelne durchgehende Linien durch einen gesamten Absatz oder Teilabschnitt
- Teilweise Streichungen: Auch wenn nur ein TEIL eines Paragraphen durchgestrichen ist (z.B. nur Absatz 2 von § 8, oder nur Option a) in § 9), melde das als Streichung mit genauer Beschreibung welcher Teil betroffen ist

Für JEDEN Paragraphen auf der Seite: Prüfe ob der Text (ganz oder teilweise) visuell durchgestrichen ist.

Antworte NUR mit einem JSON-Array. Jedes Element:
{
  "paragraphRef": "§ X Abs. Y" (der betroffene Paragraph, so genau wie möglich),
  "isStricken": true/false,
  "strikeDescription": "Beschreibung der Streichung" (z.B. "Horizontale Linie durch Absatz 2", "Option a) durchgestrichen, Option b) aktiv", "Gesamter Paragraph mit Kugelschreiber durchgestrichen"). Leer wenn isStricken=false.
  "confidence": "high" | "medium" | "low"
}

WICHTIG:
- Liste JEDEN sichtbaren Paragraphen auf, auch wenn er NICHT durchgestrichen ist (dann isStricken=false).
- Prüfe BESONDERS §§ 7-12 sehr genau – dort kommen häufig Teilstreichungen vor (z.B. bei Wahloptionen a/b).
- Sei bei der Erkennung SEHR GENAU. Unterstreichungen sind KEINE Streichungen.
- Achte besonders auf handschriftliche Linien über gedrucktem Text.
- Auch TEILWEISE Streichungen innerhalb eines Paragraphen sind relevant!
- Antworte NUR mit validem JSON-Array.`;

    // Run strike detection for each page individually for better accuracy
    const allStrikeResults: Array<{ paragraphRef: string; isStricken: boolean; strikeDescription: string; confidence: string }> = [];
    
    for (let pageIdx = 0; pageIdx < imageParts.length; pageIdx++) {
      try {
        const strikeResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [{
              role: 'user',
              content: [
                imageParts[pageIdx],
                { type: 'text', text: `Seite ${pageIdx + 1} von ${imageParts.length}.\n\n${strikeDetectionPrompt}` },
              ],
            }],
            temperature: 0.05,
            max_tokens: 4096,
          }),
        });

        if (strikeResponse.ok) {
          const strikeResult = await strikeResponse.json();
          const strikeText = strikeResult.choices?.[0]?.message?.content || '';
          let strikeJson = strikeText;
          const strikeMatch = strikeText.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (strikeMatch) strikeJson = strikeMatch[1].trim();
          
          // Find JSON array boundaries
          const arrStart = strikeJson.indexOf('[');
          const arrEnd = strikeJson.lastIndexOf(']');
          if (arrStart !== -1 && arrEnd > arrStart) {
            strikeJson = strikeJson.substring(arrStart, arrEnd + 1);
          }
          
          try {
            const pageStrikes = JSON.parse(strikeJson);
            if (Array.isArray(pageStrikes)) {
              allStrikeResults.push(...pageStrikes);
              const strickenOnPage = pageStrikes.filter((s: any) => s.isStricken).length;
              if (strickenOnPage > 0) {
                console.log(`Page ${pageIdx + 1}: ${strickenOnPage} strike(s) detected`);
              }
            }
          } catch (e) {
            console.warn(`Strike detection parse failed for page ${pageIdx + 1}:`, e);
          }
        } else {
          console.warn(`Strike detection request failed for page ${pageIdx + 1}: ${strikeResponse.status}`);
        }
      } catch (e) {
        console.warn(`Strike detection error for page ${pageIdx + 1}:`, e);
      }
    }

    // Build a map of detected strikes (only confirmed ones with medium/high confidence)
    const strikeMap = new Map<string, string>();
    for (const sr of allStrikeResults) {
      if (sr.isStricken && (sr.confidence === 'high' || sr.confidence === 'medium')) {
        // Normalize paragraph ref (e.g. "§ 9" -> "§ 9")
        strikeMap.set(sr.paragraphRef.replace(/\s+/g, ' ').trim(), sr.strikeDescription || 'Streichung erkannt');
      }
    }
    
    console.log(`Strike scan complete: ${strikeMap.size} stricken paragraph(s) detected across ${imageParts.length} pages`);

    // ── PASS 2: Legal Analysis ──────────────────────────────────────
    // Inject strike detection results into the legal analysis prompt
    const strikeContext = strikeMap.size > 0
      ? `\n\nVORHERIGE STREICHUNGSANALYSE (Vision-Scan):\nFolgende Paragraphen wurden als visuell durchgestrichen erkannt:\n${
          Array.from(strikeMap.entries()).map(([ref, desc]) => `- ${ref}: ${desc}`).join('\n')
        }\nSetze für diese Paragraphen visuallyStricken=true und übernimm die Beschreibung in strikeNote.`
      : '\n\nVORHERIGE STREICHUNGSANALYSE: Keine visuellen Streichungen erkannt.';

    const prompt = `Du bist ein deutscher Mietrechtsexperte, BGH-Kenner und Gutachter für Mietverträge.

AUFGABE: Führe einen SEQUENZIELLEN PARAGRAFENSCAN durch. Gehe den Vertrag von § 1 bis zum letzten Paragrafen durch und analysiere JEDEN einzeln.

Antworte NUR mit einem JSON-Array. Jedes Element hat:
- "paragraphRef": Der Paragraf im Vertrag (z.B. "§ 3 Abs. 1", "§ 16 Abs. 6")
- "title": Kurztitel der Klausel
- "originalText": Der wesentliche Wortlaut (max 2 Sätze). Bei handschriftlichen Ergänzungen: [HANDSCHRIFTLICH: ...]
- "status": "SICHER", "KRITISCH" oder "UNWIRKSAM"
- "legalBasis": BGB-Paragraf oder BGH-Urteil
- "reasoning": Juristische Begründung in 2-3 Sätzen
- "riskLevel": 1-10
- "category": "miete"|"kaution"|"nebenkosten"|"reparaturen"|"renovierung"|"kuendigung"|"nutzung"|"sonstiges"
- "isHandwritten": true/false
- "handwrittenNote": Beschreibung handschriftlicher Änderung (falls vorhanden, sonst "")
- "visuallyStricken": true/false – ÜBERNIMM die Ergebnisse der vorherigen Streichungsanalyse
- "strikeNote": Beschreibung der Streichung (falls vorhanden, sonst "")
${strikeContext}

STATUS-REGELN (STRIKT EINHALTEN):
- "SICHER" = Die Klausel ist rechtlich unbedenklich und wirksam. Auch wenn eine Klausel theoretisch ein Risiko birgt, aber im konkreten Fall INNERHALB der gesetzlichen Grenzen liegt, ist sie SICHER.
  Beispiel: Ein Kündigungsverzicht von 2 Jahren ist SICHER (Grenze ist 4 Jahre).
- "KRITISCH" = Die Klausel ist GRENZWERTIG und könnte je nach Auslegung problematisch sein. Nur verwenden wenn echte Zweifel bestehen.
- "UNWIRKSAM" = Die Klausel verstößt eindeutig gegen Gesetz oder BGH-Rechtsprechung.
WICHTIG: Wenn deine Begründung ergibt, dass die Klausel rechtlich in Ordnung ist, MUSS der Status "SICHER" sein – NICHT "KRITISCH"!

KRITISCHE KLAUSELN – PFLICHTPRÜFUNG:
1. §§ 15, 27 (Schönheitsreparaturen): Starre Fristen = UNWIRKSAM (BGH VIII ZR 308/02)
2. § 16 (Kleinreparaturen): >110-120€/Einzelfall oder >8% Jahresmiete = UNWIRKSAM
3. § 22 (Kündigungsverzicht >4 Jahre = UNWIRKSAM, § 557a Abs. 3 BGB)
4. Kaution >3 Nettokaltmieten = UNWIRKSAM (§ 551 Abs. 1 BGB)
5. Generelles Tierhaltungsverbot = KRITISCH (BGH VIII ZR 168/12)

HANDSCHRIFTLICHE ERGÄNZUNGEN (§ 305b BGB – Individualvereinbarung):
- Individualvereinbarungen haben HÖCHSTE PRIORITÄT und gehen AGB-Klauseln VOR.
- Bei § 27 oder anderen Paragraphen mit handschriftlichen Notizen: Analysiere den INHALT der handschriftlichen Ergänzung detailliert.
- Beschreibe in "handwrittenNote" WAS genau handschriftlich ergänzt wurde und welche rechtliche BEDEUTUNG das hat.
- Beispiel: Wenn bei § 27 handschriftlich "Wohnung muss weiß gestrichen zurückgegeben werden" steht, analysiere ob diese Individualvereinbarung wirksam ist (Farbwahlklausel: BGH VIII ZR 198/10).
- Leere handschriftliche Felder (nur Lücken zum Ausfüllen) sind KEINE relevanten Individualvereinbarungen.

REGELN:
- Analysiere JEDEN Paragrafen, auch rechtlich unbedenkliche.
- Sortiere nach Reihenfolge im Vertrag.
- Antworte NUR mit validem JSON-Array.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            ...imageParts,
            { type: 'text', text: prompt },
          ],
        }],
        temperature: 0.1,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'KI-Kontingent aufgebraucht. Bitte Credits aufladen.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Fehler bei der KI-Analyse', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = await response.json();
    const textContent = result.choices?.[0]?.message?.content || '';
    const finishReason = result.choices?.[0]?.finish_reason;

    // Robust JSON parsing with truncation recovery
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const arrStart = jsonStr.indexOf('[');
    if (arrStart !== -1) jsonStr = jsonStr.substring(arrStart);

    let parsedData;
    try {
      const arrEnd = jsonStr.lastIndexOf(']');
      if (arrEnd > 0) {
        parsedData = JSON.parse(jsonStr.substring(0, arrEnd + 1).replace(/,\s*]/g, ']').replace(/[\x00-\x1F\x7F]/g, ' '));
      } else {
        throw new Error('No closing bracket');
      }
    } catch {
      // Recovery: strip trailing incomplete objects and close array
      try {
        let recoverable = jsonStr;
        // Remove last incomplete object
        const lastCompleteObj = recoverable.lastIndexOf('},');
        const lastCompleteObj2 = recoverable.lastIndexOf('}]');
        const cutPoint = Math.max(lastCompleteObj, lastCompleteObj2);
        if (cutPoint > 0) {
          recoverable = recoverable.substring(0, cutPoint + 1) + ']';
        } else {
          recoverable = recoverable.replace(/,\s*\{[^}]*$/s, '').replace(/,\s*$/s, '');
          if (!recoverable.endsWith(']')) recoverable += ']';
        }
        recoverable = recoverable.replace(/,\s*]/g, ']').replace(/[\x00-\x1F\x7F]/g, ' ');
        parsedData = JSON.parse(recoverable);
        console.log(`Recovered truncated legal analysis (finish_reason=${finishReason})`);
      } catch {
        console.error('Failed to parse legal analysis:', textContent.substring(0, 500));
        return new Response(
          JSON.stringify({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: textContent.substring(0, 500) }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let clauses = Array.isArray(parsedData) ? parsedData : [];

    // ── MERGE: Ensure strike scan results override legal analysis ────
    // The legal analysis might miss strikes that the dedicated vision scan caught
    for (const clause of clauses) {
      const ref = (clause.paragraphRef || '').replace(/\s+/g, ' ').trim();
      // Check all strike map keys for partial matches (e.g. "§ 9" matches "§ 9 Abs. 1")
      for (const [strikeRef, strikeDesc] of strikeMap.entries()) {
        if (ref.startsWith(strikeRef) || strikeRef.startsWith(ref) || ref === strikeRef) {
          if (!clause.visuallyStricken) {
            clause.visuallyStricken = true;
            clause.strikeNote = strikeDesc;
            console.log(`Merged strike detection for ${ref}: ${strikeDesc}`);
          }
          break;
        }
      }
    }

    const strickenCount = clauses.filter((c: any) => c.visuallyStricken).length;
    const stats = {
      total: clauses.length,
      safe: clauses.filter((c: any) => c.status === 'SICHER').length,
      critical: clauses.filter((c: any) => c.status === 'KRITISCH').length,
      invalid: clauses.filter((c: any) => c.status === 'UNWIRKSAM').length,
      handwritten: clauses.filter((c: any) => c.isHandwritten).length,
      stricken: strickenCount,
    };

    console.log(`Deep analysis complete: ${stats.total} clauses, ${strickenCount} stricken, ${stats.invalid} invalid`);

    return new Response(
      JSON.stringify({ success: true, mode: 'deep-check', clauses, stats, pageCount: imageParts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-contract-deep:', error);
    return new Response(
      JSON.stringify({ error: 'Interner Serverfehler', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
