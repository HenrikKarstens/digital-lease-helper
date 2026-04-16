import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function authenticateAndRateLimit(req: Request, functionName: string): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: authErr } = await userClient.auth.getClaims(token);
  if (authErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'Ungültiges Token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const userId = claims.claims.sub as string;
  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const since = new Date(Date.now() - 60000).toISOString();
  const { count } = await supabaseAdmin.from('ai_rate_limits').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
  if ((count ?? 0) >= 10) {
    return new Response(JSON.stringify({ error: 'Rate-Limit: max. 10 Anfragen/Minute. Bitte warten.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  await supabaseAdmin.from('ai_rate_limits').insert({ user_id: userId, function_name: functionName });
  return { userId };
}

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

function robustJsonParse(textContent: string, isArray = true) {
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  const startChar = isArray ? '[' : '{';
  const startIdx = jsonStr.indexOf(startChar);
  if (startIdx !== -1) jsonStr = jsonStr.substring(startIdx);

  // Clean control characters
  jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ');

  try {
    const endChar = isArray ? ']' : '}';
    const endIdx = jsonStr.lastIndexOf(endChar);
    if (endIdx > 0) {
      return JSON.parse(jsonStr.substring(0, endIdx + 1).replace(/,\s*]/g, ']').replace(/,\s*}/g, '}'));
    }
    throw new Error('No closing bracket');
  } catch {
    // Recovery for arrays: strip trailing incomplete objects
    if (isArray) {
      let recoverable = jsonStr;
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
      return JSON.parse(recoverable);
    }
    // Recovery for objects
    let recoverable = jsonStr;
    recoverable = recoverable.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/s, '');
    recoverable = recoverable.replace(/,\s*"[^"]*$/s, '');
    recoverable = recoverable.replace(/,\s*$/s, '');
    const openB = (recoverable.match(/{/g) || []).length;
    const closeB = (recoverable.match(/}/g) || []).length;
    for (let b = 0; b < openB - closeB; b++) recoverable += '}';
    recoverable = recoverable.replace(/,\s*}/g, '}').replace(/[\x00-\x1F\x7F]/g, ' ');
    return JSON.parse(recoverable);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await authenticateAndRateLimit(req, 'analyze-contract-deep');
    if (authResult instanceof Response) return authResult;
    const formData = await req.formData();
    const mode = (formData.get('mode') as string) || 'deep-check';

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY nicht konfiguriert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // Mode: TOC-SCAN – Lightweight paragraph listing + strike detection
    // Uses flash-lite for minimal token cost
    // ══════════════════════════════════════════════════════════════════
    if (mode === 'toc-scan') {
      const files = await extractFiles(formData, 'file');
      if (files.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Keine Datei hochgeladen' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imageParts = await filesToImageParts(files, 8);
      console.log(`TOC-SCAN: Processing ${imageParts.length} pages with flash-lite...`);

      const tocPrompt = `Du bist ein deutscher Dokumentenanalyst. Scanne ALLE Seiten dieses Mietvertrags.

AUFGABE: Erstelle ein Inhaltsverzeichnis aller Paragraphen (§§). Für JEDEN Paragraphen:
1. Identifiziere die Paragraphen-Nummer und den Titel
2. Notiere auf welcher Seite (1-basiert) der Paragraph beginnt
3. Prüfe ob der Paragraph (ganz oder teilweise) visuell DURCHGESTRICHEN ist
4. Erkenne ob handschriftliche Ergänzungen vorhanden sind
5. Ordne eine Kategorie zu

Antworte NUR mit einem JSON-Array. Jedes Element:
{
  "paragraphRef": "§ X" oder "§ X Abs. Y",
  "title": "Kurztitel",
  "pageIndex": 0-basierter Seitenindex (0 = erste Seite),
  "category": "miete"|"kaution"|"nebenkosten"|"reparaturen"|"renovierung"|"kuendigung"|"nutzung"|"sonstiges",
  "isHandwritten": true/false,
  "visuallyStricken": true/false,
  "strikeNote": "Beschreibung der Streichung" (leer wenn nicht gestrichen),
  "strikeConfidence": "high"|"medium"|"low"
}

REGELN:
- Liste JEDEN Paragraphen auf, auch wenn er nicht durchgestrichen ist
- Teilstreichungen melden (z.B. "Option a) durchgestrichen, Option b) aktiv")
- Unterstreichungen sind KEINE Streichungen
- Sortiere nach Paragraphen-Reihenfolge
- Antworte NUR mit reinem JSON-Array, KEIN Markdown`;

      const tocResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              { type: 'text', text: tocPrompt },
            ],
          }],
          temperature: 0.05,
          max_tokens: 4096,
        }),
      });

      if (!tocResponse.ok) {
        const errorText = await tocResponse.text();
        console.error('TOC-SCAN error:', tocResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Fehler beim TOC-Scan', details: errorText }),
          { status: tocResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tocResult = await tocResponse.json();
      const tocText = tocResult.choices?.[0]?.message?.content || '';

      let tocData;
      try {
        tocData = robustJsonParse(tocText, true);
      } catch {
        console.error('TOC parse failed:', tocText.substring(0, 300));
        return new Response(
          JSON.stringify({ error: 'TOC-Scan konnte nicht verarbeitet werden', raw: tocText.substring(0, 300) }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const entries = Array.isArray(tocData) ? tocData : [];
      // Filter only medium/high confidence strikes
      for (const entry of entries) {
        if (entry.visuallyStricken && entry.strikeConfidence === 'low') {
          entry.visuallyStricken = false;
          entry.strikeNote = '';
        }
      }

      const strickenCount = entries.filter((e: any) => e.visuallyStricken).length;
      console.log(`TOC-SCAN complete: ${entries.length} paragraphs, ${strickenCount} stricken`);

      return new Response(
        JSON.stringify({ success: true, mode: 'toc-scan', entries, pageCount: imageParts.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // Mode: CLAUSE-DETAIL – Deep analysis of a single paragraph
    // Sends only ONE page image, uses flash for focused analysis
    // ══════════════════════════════════════════════════════════════════
    if (mode === 'clause-detail') {
      const paragraphRef = (formData.get('paragraphRef') as string) || '';
      const isStrickenHint = formData.get('isStricken') === 'true';
      const strikeNoteHint = (formData.get('strikeNote') as string) || '';
      
      const files = await extractFiles(formData, 'file');
      if (files.length === 0 || !paragraphRef) {
        return new Response(
          JSON.stringify({ error: 'Seitenbild und Paragraphen-Referenz erforderlich' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imageParts = await filesToImageParts(files, 1);
      console.log(`CLAUSE-DETAIL: Analyzing ${paragraphRef}...`);

      const strikeContext = isStrickenHint
        ? `\nHINWEIS: Dieser Paragraph wurde als visuell durchgestrichen erkannt: "${strikeNoteHint}". Setze visuallyStricken=true.`
        : '';

      const clausePrompt = `Du bist ein deutscher Mietrechtsexperte. Analysiere NUR den Paragraphen "${paragraphRef}" auf diesem Bild.

Antworte mit EINEM JSON-Objekt:
{
  "paragraphRef": "${paragraphRef}",
  "title": "Kurztitel",
  "originalText": "Wesentlicher Wortlaut (max 2 Sätze). Bei handschriftlichen Ergänzungen: [HANDSCHRIFTLICH: ...]",
  "status": "SICHER" | "KRITISCH" | "UNWIRKSAM",
  "legalBasis": "BGB-Paragraf oder BGH-Urteil",
  "reasoning": "Juristische Begründung in 2-3 Sätzen",
  "riskLevel": 1-10,
  "category": "miete"|"kaution"|"nebenkosten"|"reparaturen"|"renovierung"|"kuendigung"|"nutzung"|"sonstiges",
  "isHandwritten": true/false,
  "handwrittenNote": "Beschreibung handschriftlicher Änderung (falls vorhanden, sonst '')",
  "visuallyStricken": true/false,
  "strikeNote": "Beschreibung der Streichung (falls vorhanden, sonst '')"
}
${strikeContext}

STATUS-REGELN:
- "SICHER" = Rechtlich unbedenklich. Wenn die Klausel im gesetzlichen Rahmen liegt → SICHER.
  Beispiel: Kündigungsverzicht 2 Jahre = SICHER (Grenze: 4 Jahre).
- "KRITISCH" = Grenzwertig, echte Zweifel bestehen.
- "UNWIRKSAM" = Verstößt eindeutig gegen Gesetz/BGH.
WICHTIG: Wenn die Begründung ergibt "rechtlich ok" → Status MUSS "SICHER" sein!

PFLICHTPRÜFUNGEN:
- Schönheitsreparaturen: Starre Fristen = UNWIRKSAM (BGH VIII ZR 308/02)
- Kleinreparaturen: >110-120€/Einzelfall oder >8% Jahresmiete = UNWIRKSAM
- Kündigungsverzicht >4 Jahre = UNWIRKSAM
- Kaution >3 Nettokaltmieten = UNWIRKSAM (§ 551 Abs. 1 BGB)

HANDSCHRIFTLICHE ERGÄNZUNGEN (§ 305b BGB):
- Individualvereinbarungen gehen AGB-Klauseln VOR
- Analysiere den INHALT handschriftlicher Notizen detailliert

Antworte NUR mit validem JSON-Objekt. Kein Markdown.`;

      const clauseResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              imageParts[0],
              { type: 'text', text: clausePrompt },
            ],
          }],
          temperature: 0.1,
          max_tokens: 2048,
        }),
      });

      if (!clauseResponse.ok) {
        const errorText = await clauseResponse.text();
        console.error('CLAUSE-DETAIL error:', clauseResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Fehler bei der Klausel-Analyse', details: errorText }),
          { status: clauseResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const clauseResult = await clauseResponse.json();
      const clauseText = clauseResult.choices?.[0]?.message?.content || '';

      let clauseData;
      try {
        clauseData = robustJsonParse(clauseText, false);
      } catch {
        console.error('CLAUSE-DETAIL parse failed:', clauseText.substring(0, 300));
        return new Response(
          JSON.stringify({ error: 'Klausel-Analyse konnte nicht verarbeitet werden' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`CLAUSE-DETAIL complete: ${paragraphRef} → ${clauseData.status}`);

      return new Response(
        JSON.stringify({ success: true, mode: 'clause-detail', clause: clauseData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // Mode: Delta-Check (move-in vs move-out protocol comparison)
    // ══════════════════════════════════════════════════════════════════
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
      "room": "Raum-Name",
      "element": "Element",
      "moveInCondition": "Zustand laut Einzugsprotokoll",
      "moveOutCondition": "Zustand laut Auszugsprotokoll",
      "delta": "unchanged" | "new_damage" | "pre_existing" | "improved",
      "liability": "tenant" | "none" | "landlord",
      "reasoning": "Kurze Begründung (1-2 Sätze).",
      "severity": 1-10
    }
  ],
  "summary": {
    "totalItems": Zahl,
    "preExisting": Zahl,
    "newDamages": Zahl,
    "unchanged": Zahl,
    "tenantLiabilityEstimate": "Geschätzter Haftungsbetrag"
  }
}

REGELN:
- Schäden im Einzugsprotokoll → delta="pre_existing", liability="none"
- § 538 BGB: Mieter haftet NICHT für vertragsgemäßen Gebrauch
- Nur NEUE Schäden → delta="new_damage"
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

      let parsedData;
      try {
        parsedData = robustJsonParse(textContent, false);
      } catch {
        console.error('Failed to parse delta-check response:', textContent.substring(0, 300));
        return new Response(JSON.stringify({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: textContent.substring(0, 300) }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(
        JSON.stringify({ success: true, mode: 'delta-check', ...parsedData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // Mode: DEEP-CHECK (legacy full analysis – kept as fallback)
    // ══════════════════════════════════════════════════════════════════
    const files = await extractFiles(formData, 'file');

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Keine Datei hochgeladen' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageParts = await filesToImageParts(files, 8);

    // Single-pass combined analysis (simplified from 2-pass for cost saving)
    const prompt = `Du bist ein deutscher Mietrechtsexperte und visueller Dokumentenanalyst.

AUFGABE: Führe einen SEQUENZIELLEN PARAGRAFENSCAN durch. Gehe den Vertrag von § 1 bis zum letzten Paragrafen durch und analysiere JEDEN einzeln. Prüfe dabei AUCH auf visuelle Streichungen.

Antworte NUR mit einem JSON-Array. Jedes Element hat:
- "paragraphRef": Der Paragraf (z.B. "§ 3 Abs. 1")
- "title": Kurztitel
- "originalText": Wesentlicher Wortlaut (max 2 Sätze)
- "status": "SICHER", "KRITISCH" oder "UNWIRKSAM"
- "legalBasis": BGB-Paragraf oder BGH-Urteil
- "reasoning": Juristische Begründung in 2-3 Sätzen
- "riskLevel": 1-10
- "category": "miete"|"kaution"|"nebenkosten"|"reparaturen"|"renovierung"|"kuendigung"|"nutzung"|"sonstiges"
- "isHandwritten": true/false
- "handwrittenNote": Beschreibung (falls vorhanden, sonst "")
- "visuallyStricken": true/false
- "strikeNote": Beschreibung der Streichung (falls vorhanden, sonst "")

STATUS-REGELN:
- "SICHER" = Rechtlich unbedenklich. Im gesetzlichen Rahmen → SICHER.
- "KRITISCH" = Grenzwertig, echte Zweifel.
- "UNWIRKSAM" = Verstößt eindeutig gegen Gesetz/BGH.
WICHTIG: Begründung "rechtlich ok" → Status MUSS "SICHER" sein!

Antworte NUR mit validem JSON-Array.`;

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
        return new Response(JSON.stringify({ error: 'Zu viele Anfragen.' }),
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

    let parsedData;
    try {
      parsedData = robustJsonParse(textContent, true);
    } catch {
      console.error('Failed to parse legal analysis:', textContent.substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: textContent.substring(0, 500) }),
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
      stricken: clauses.filter((c: any) => c.visuallyStricken).length,
    };

    console.log(`Deep analysis complete: ${stats.total} clauses, ${stats.stricken} stricken, ${stats.invalid} invalid`);

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
