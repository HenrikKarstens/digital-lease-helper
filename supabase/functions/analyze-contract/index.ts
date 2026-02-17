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
    const transactionType = formData.get('transactionType') as string || 'rental';

    if (!file) {
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

    // Read file as base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const mimeType = file.type || 'application/pdf';
    const isSale = transactionType === 'sale';

    const prompt = `Du bist ein deutscher Immobilienrechtsexperte. Analysiere dieses Dokument (${isSale ? 'Kaufvertrag' : 'Mietvertrag'}) und extrahiere die folgenden Informationen als JSON.

Extrahiere:
- "propertyAddress": Die vollständige Objektadresse
- "landlordName": Name ${isSale ? 'des Verkäufers' : 'des Vermieters'} 
- "landlordEmail": E-Mail ${isSale ? 'des Verkäufers' : 'des Vermieters'} (falls vorhanden, sonst "")
- "tenantName": Name ${isSale ? 'des Käufers' : 'des Mieters'}
- "tenantEmail": E-Mail ${isSale ? 'des Käufers' : 'des Mieters'} (falls vorhanden, sonst "")
- "depositAmount": ${isSale ? 'Anzahlung/Kaufpreisanteil' : 'Kautionshöhe'} als Zahl in Euro (nur die Zahl, z.B. "2400")
- "contractStart": Vertragsbeginn im Format YYYY-MM-DD
- "contractEnd": Vertragsende im Format YYYY-MM-DD (falls unbefristet, dann "")
- "depositLegalCheck": Prüfung der ${isSale ? 'Zahlungsbedingungen' : 'Kaution gegen § 551 BGB'} - ist die Höhe zulässig? (max. 3 Nettokaltmieten bei Miete)
- "renovationClauseAnalysis": Analyse der Schönheitsreparaturklauseln nach aktueller BGH-Rechtsprechung. Sind starre Fristen enthalten? Ist die Klausel wirksam?

Antworte NUR mit validem JSON, keine Erklärungen davor oder danach.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              }
            },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
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

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

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
      JSON.stringify({ success: true, data: parsedData }),
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
