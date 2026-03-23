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
    const file = formData.get('file') as File | null;
    const context = formData.get('context') as string || 'evidence'; // 'evidence' | 'meter'
    const room = formData.get('room') as string || '';
    const isMoveIn = formData.get('isMoveIn') === 'true';

    if (!file) {
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

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    const base64Data = btoa(binary);
    const mimeType = file.type || 'image/jpeg';

    let prompt: string;

    if (context === 'utility-bill') {
      prompt = `Du bist ein Experte für deutsche Stromrechnungen und Versorgungsverträge.
Analysiere dieses Foto/Dokument und extrahiere folgende Informationen als JSON:

- "providerName": Name des Stromversorgers (z.B. "E.ON", "Vattenfall", "SWM")
- "customerNumber": Die Kundennummer
- "contractNumber": Vertragskonto- oder Vertragsnummer (falls vorhanden, sonst "")
- "meterNumber": Zählernummer (falls sichtbar, sonst "")
- "confidence": "high", "medium" oder "low"

WICHTIG: Antworte NUR mit validem JSON. Falls Werte nicht lesbar sind, verwende "".`;
    } else if (context === 'meter') {
      prompt = `Du bist ein Experte für Zählerablesung in deutschen Immobilien.
Analysiere dieses Foto eines oder mehrerer Zähler und extrahiere die Informationen als JSON.

WICHTIG: Auf einem Foto können MEHRERE Zähler sichtbar sein (z.B. Warm- und Kaltwasserzähler nebeneinander, oder Zähler an verschiedenen Stellen). Prüfe das Bild sorgfältig.

Falls NUR EIN Zähler erkennbar ist, antworte mit einem einzelnen JSON-Objekt:
{
  "medium": "Strom" | "Wasser" | "Gas" | "Wärmemengenzähler" | "Sonstiges",
  "meterNumber": "Zählernummer",
  "reading": "Zählerstand (z.B. 14.502,4)",
  "unit": "kWh" | "m³" etc.,
  "maloId": "MaLo-ID falls sichtbar, sonst leer",
  "confidence": "high" | "medium" | "low"
}

Falls MEHRERE Zähler erkennbar sind (z.B. Warmwasser + Kaltwasser, oder zwei Stromzähler), antworte mit:
{
  "multiple": true,
  "meters": [
    { "medium": "Wasser (kalt)", "meterNumber": "...", "reading": "...", "unit": "m³", "maloId": "", "confidence": "high" },
    { "medium": "Wasser (warm)", "meterNumber": "...", "reading": "...", "unit": "m³", "maloId": "", "confidence": "high" }
  ]
}

Bei Wasserzählern unterscheide IMMER zwischen:
- "Wasser (kalt)" – Kaltwasserzähler (oft blau markiert)
- "Wasser (warm)" – Warmwasserzähler (oft rot markiert)
Falls die Unterscheidung nicht möglich ist, verwende "Wasser".

WICHTIG: Antworte NUR mit validem JSON. Falls Werte nicht lesbar sind, verwende "".`;
    } else {
      const roomInfo = room ? `Das Foto wurde im Raum "${room}" aufgenommen.` : '';
      prompt = `Du bist ein deutscher Bausachverständiger und Immobiliengutachter.
Analysiere dieses Foto aus einer Wohnungsübergabe. ${roomInfo}

Extrahiere folgende Informationen als JSON:

- "material": Das erkannte Material/Oberfläche (z.B. "Eichenparkett", "Laminat", "Raufasertapete", "Fliesen (Feinsteinzeug)", "Kunststoff-Fensterrahmen"). Falls nicht erkennbar: "Nicht bestimmbar"
- "damageType": Art und Ausmaß des Schadens/Zustands in wenigen Worten (z.B. "Tiefer Kratzer, ca. 15cm", "Schimmelbildung, 10x15cm", "Abplatzung, 3cm"). Falls kein Schaden: "Kein Mangel erkennbar"
- "description": Eine detaillierte, sachliche Beschreibung in 1-2 Sätzen für das Übergabeprotokoll. Beschreibe genau was zu sehen ist, den Schweregrad und ggf. den Kontext (z.B. "Oberflächlicher Kratzer im Eichenparkett nahe der Terrassentür. Tiefe ca. 0,5mm, Länge ca. 15cm – vermutlich durch Möbelverschiebung entstanden.")
- "severity": Schweregrad als "gering", "mittel" oder "schwer"
- "suggestedRoom": Falls der Raum aus dem Bild erkennbar ist (z.B. Küchenfliesen → "Küche", Badewanne → "Bad"), sonst ""
${!isMoveIn ? `- "bghReference": Passende BGH-Rechtsprechung falls relevant (z.B. "BGH VIII ZR 222/15"), sonst ""
- "timeValueDeduction": Geschätzter Zeitwertabzug in Prozent (0-100), basierend auf normalem Verschleiß
- "recommendedWithholding": Geschätzter Kautionseinbehalt in Euro (0 wenn normaler Verschleiß)` : ''}
- "confidence": "high", "medium" oder "low"

WICHTIG: 
- Antworte NUR mit validem JSON.
- Sei spezifisch und sachlich – keine generischen Platzhalter.
- Beschreibe exakt was du siehst.`;
    }

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
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Data}` },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
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

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-photo:', error);
    return new Response(
      JSON.stringify({ error: 'Interner Serverfehler', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
