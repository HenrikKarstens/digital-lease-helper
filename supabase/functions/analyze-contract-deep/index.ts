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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();

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

    const imageParts: any[] = [];
    const maxPages = Math.min(files.length, 8);

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

    const prompt = `Du bist ein deutscher Mietrechtsexperte und BGH-Kenner. Analysiere den folgenden Mietvertrag PARAGRAF FÜR PARAGRAF.

Für JEDEN Paragrafen/Abschnitt des Vertrags, erstelle einen Eintrag mit folgender Struktur:

Antworte NUR mit einem JSON-Array. Jedes Element hat:
- "paragraphRef": Der Paragraf im Vertrag (z.B. "§ 3 Abs. 1", "§ 16 Abs. 6")
- "title": Kurztitel der Klausel (z.B. "Mietbeginn", "Kaution", "Kleinreparaturen")
- "originalText": Der wesentliche Wortlaut der Klausel aus dem Vertrag (max 2 Sätze, wörtliches Zitat)
- "status": Einer von "SICHER", "KRITISCH", "UNWIRKSAM"
- "legalBasis": Der einschlägige BGB-Paragraf oder das BGH-Urteil (z.B. "§ 551 Abs. 1 BGB", "BGH VIII ZR 308/02")
- "reasoning": Juristische Begründung in 2-3 Sätzen, warum die Klausel so bewertet wird. Bei UNWIRKSAM: Nenne das konkrete BGH-Urteil und die Rechtsfolge.
- "riskLevel": 1-10 (1 = kein Risiko, 10 = höchstes Risiko für den Mieter)
- "category": Eine von "miete", "kaution", "nebenkosten", "reparaturen", "renovierung", "kuendigung", "nutzung", "sonstiges"

REGELN:
- Analysiere JEDEN Paragrafen, auch wenn er rechtlich unbedenklich ist.
- Starre Renovierungsfristen (z.B. "alle 3 Jahre") sind UNWIRKSAM nach BGH VIII ZR 308/02.
- Kaution über 3 Nettokaltmieten ist UNWIRKSAM nach § 551 Abs. 1 BGB.
- Kleinreparaturklauseln über 110-120€ Einzelobergrenze oder über 8% der Jahresmiete sind UNWIRKSAM.
- Schriftformheilungsklauseln sind nach BGH KRITISCH.
- Tierhaltungsverbote (außer Kleintiere) sind KRITISCH nach BGH VIII ZR 168/12.
- Kautionszahlungspflicht vor Schlüsselübergabe ist UNWIRKSAM.
- Antworte NUR mit einem validen JSON-Array, KEINE Erklärungen davor oder danach.
- Sortiere die Ergebnisse nach Reihenfolge im Vertrag.`;

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
        max_tokens: 8192,
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
      console.error('Failed to parse AI response:', textContent);
      return new Response(
        JSON.stringify({ error: 'KI-Antwort konnte nicht verarbeitet werden', raw: textContent }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure it's an array
    const clauses = Array.isArray(parsedData) ? parsedData : [];

    // Compute summary stats
    const stats = {
      total: clauses.length,
      safe: clauses.filter((c: any) => c.status === 'SICHER').length,
      critical: clauses.filter((c: any) => c.status === 'KRITISCH').length,
      invalid: clauses.filter((c: any) => c.status === 'UNWIRKSAM').length,
    };

    return new Response(
      JSON.stringify({ success: true, clauses, stats, pageCount: maxPages }),
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
