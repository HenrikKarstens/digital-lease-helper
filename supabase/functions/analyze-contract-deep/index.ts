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

    const prompt = `Du bist ein deutscher Mietrechtsexperte, BGH-Kenner und Gutachter für Mietverträge.

AUFGABE: Führe einen SEQUENZIELLEN PARAGRAFENSCAN durch. Gehe den Vertrag von § 1 bis zum letzten Paragrafen durch und analysiere JEDEN einzeln.

Antworte NUR mit einem JSON-Array. Jedes Element hat:
- "paragraphRef": Der Paragraf im Vertrag (z.B. "§ 3 Abs. 1", "§ 16 Abs. 6")
- "title": Kurztitel der Klausel (z.B. "Mietbeginn", "Kaution", "Kleinreparaturen")
- "originalText": Der wesentliche Wortlaut der Klausel aus dem Vertrag (max 2 Sätze, wörtliches Zitat). Bei handschriftlichen Ergänzungen: kennzeichne mit [HANDSCHRIFTLICH: ...]
- "status": Einer von "SICHER", "KRITISCH", "UNWIRKSAM"
- "legalBasis": Der einschlägige BGB-Paragraf oder das BGH-Urteil (z.B. "§ 551 Abs. 1 BGB", "BGH VIII ZR 308/02")
- "reasoning": Juristische Begründung in 2-3 Sätzen, warum die Klausel so bewertet wird. Bei UNWIRKSAM: Nenne das konkrete BGH-Urteil und die Rechtsfolge.
- "riskLevel": 1-10 (1 = kein Risiko, 10 = höchstes Risiko für den Mieter)
- "category": Eine von "miete", "kaution", "nebenkosten", "reparaturen", "renovierung", "kuendigung", "nutzung", "sonstiges"
- "isHandwritten": true/false – ob die Klausel handschriftliche Ergänzungen oder Streichungen enthält
- "handwrittenNote": Falls isHandwritten=true: Beschreibung der handschriftlichen Änderung und deren rechtliche Bedeutung als Individualvereinbarung (1-2 Sätze). Sonst "".
- "visuallyStricken": true/false – ob du im Bild eine horizontale Durchstreichung (Streichlinie) über dem gesamten Textblock dieser Klausel erkennst. Dies bedeutet, dass die Vertragsparteien diese Klausel manuell gestrichen haben.
- "strikeNote": Falls visuallyStricken=true: Beschreibung der erkannten Streichung (z.B. "Gesamter Absatz 3b mit durchgehender Linie gestrichen"). Sonst "".

KRITISCHE KLAUSELN – PFLICHTPRÜFUNG:
1. §§ 15, 27 (Schönheitsreparaturen): Prüfe auf "starre Fristen" (z.B. "Küche alle 3 Jahre", "Bad alle 5 Jahre"). Solche Klauseln sind UNWIRKSAM nach BGH VIII ZR 308/02. Prüfe auch auf unzulässige Endrenovierungsklauseln, insbesondere handschriftliche Ergänzungen wie "weiß gestrichen".
2. § 16 (Kleinreparaturen): Prüfe die Kostenobergrenze pro Einzelfall. Über 110-120€ ist KRITISCH/UNWIRKSAM. Prüfe auch die Jahreshöchstgrenze (über 8% der Jahresmiete = UNWIRKSAM).
3. § 22 (Kündigung/Kündigungsverzicht): Ein Kündigungsverzicht über 4 Jahre ist UNWIRKSAM nach § 557a Abs. 3 BGB / BGH VIII ZR 27/04. Prüfe die vereinbarte Dauer.
4. Kaution: Über 3 Nettokaltmieten ist UNWIRKSAM nach § 551 Abs. 1 BGB. Kautionszahlung VOR Schlüsselübergabe ist UNWIRKSAM.
5. Tierhaltung: Generelles Tierhaltungsverbot (außer Kleintiere) ist KRITISCH nach BGH VIII ZR 168/12.
6. Schriftformheilungsklauseln sind nach BGH KRITISCH.

VISUELLE STREICHUNGSERKENNUNG:
- Prüfe JEDES Bild genau auf horizontale Linien, die über Textblöcke gezogen wurden.
- Eine solche Durchstreichung bedeutet, dass die Vertragsparteien diese Klausel bewusst gestrichen haben.
- Setze visuallyStricken=true für JEDE Klausel, deren Text visuell durchgestrichen ist.
- Typische Muster: Durchgehende horizontale Linie über einen Absatz, Kreuzungen, oder mehrere parallele Linien.

HANDSCHRIFT-PRIORITÄT:
- Handschriftliche Ergänzungen, Streichungen und Randbemerkungen haben HÖCHSTE PRIORITÄT.
- Sie stellen potenzielle INDIVIDUALVEREINBARUNGEN dar, die AGB-Klauseln gemäß § 305b BGB verdrängen.
- Jede handschriftliche Änderung MUSS als eigener Eintrag oder als Ergänzung zum betroffenen Paragrafen erfasst werden.
- Achte besonders auf durchgestrichene Passagen – diese gelten als abbedungen.

REGELN:
- Analysiere JEDEN Paragrafen, auch wenn er rechtlich unbedenklich ist.
- Sortiere die Ergebnisse nach Reihenfolge im Vertrag (§ 1, § 2, ...).
- Antworte NUR mit einem validen JSON-Array, KEINE Erklärungen davor oder danach.`;

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
        return new Response(JSON.stringify({ error: 'KI-Kontingent aufgebraucht. Bitte Credits aufladen.' }),
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
      console.error('Failed to parse AI response:', textContent);
      return new Response(
        JSON.stringify({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: textContent }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clauses = Array.isArray(parsedData) ? parsedData : [];

    const stats = {
      total: clauses.length,
      safe: clauses.filter((c: any) => c.status === 'SICHER').length,
      critical: clauses.filter((c: any) => c.status === 'KRITISCH').length,
      invalid: clauses.filter((c: any) => c.status === 'UNWIRKSAM').length,
      handwritten: clauses.filter((c: any) => c.isHandwritten).length,
    };

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
