

# Sicherheits- & Architektur-Update für die Pilotphase

## Zusammenfassung

Vier Sicherheits-Layer werden implementiert: JWT-Authentifizierung in allen Edge Functions, serverseitiges Rate-Limiting, Umstellung sensibler Caches auf sessionStorage, und Härtung der RLS-Policies.

---

## 1. KI-Schnittstellen-Schutz (JWT-Authentifizierung)

**Problem:** Alle drei Edge Functions (`analyze-photo`, `analyze-contract`, `analyze-contract-deep`) prüfen aktuell keine Benutzer-Identität. Jeder mit der URL kann sie aufrufen.

**Lösung:** In jeder Edge Function wird zu Beginn der Authorization-Header geprüft und `getClaims()` aufgerufen. Unauthentifizierte Anfragen werden mit 401 abgelehnt. Die User-ID wird für das Rate-Limiting verwendet.

**Betroffene Dateien:**
- `supabase/functions/analyze-photo/index.ts`
- `supabase/functions/analyze-contract/index.ts`
- `supabase/functions/analyze-contract-deep/index.ts`

---

## 2. Rate-Limiting (10 Anfragen/Minute pro Nutzer)

**Problem:** Kein Schutz gegen Missbrauch – ein Nutzer könnte unbegrenzt KI-Anfragen auslösen.

**Lösung:** Eine neue Datenbank-Tabelle `ai_rate_limits` speichert Zeitstempel pro User. Jede Edge Function prüft vor der KI-Anfrage, ob der Nutzer in den letzten 60 Sekunden weniger als 10 Anfragen hatte. Bei Überschreitung wird 429 zurückgegeben.

**Neue Tabelle:**
```sql
CREATE TABLE public.ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
-- Kein SELECT/UPDATE für Endnutzer nötig – nur Edge Functions mit Service Role Key greifen zu
CREATE INDEX idx_rate_limits_user_time ON public.ai_rate_limits (user_id, created_at);
```

Eine geteilte Hilfsfunktion in jeder Edge Function prüft und loggt die Anfrage via Supabase Service Role Client.

---

## 3. DSGVO: localStorage → sessionStorage

**Problem:** Vertragsanalyse-Ergebnisse und Klausel-Caches bleiben im `localStorage` auch nach dem Schließen des Browsers erhalten.

**Lösung:** 
- `DeepParagraphCheck.tsx`: Klausel-Cache (`estateturn_clause_cache`, `estateturn_clause_cache_version`) wird auf `sessionStorage` umgestellt.
- `HandoverContext.tsx`: Der Draft-Speicher (`estateturn_draft`) wird auf `sessionStorage` umgestellt.
- `useGuestStorage.ts`: Guest-Projekt-Daten werden auf `sessionStorage` umgestellt.
- `ThemeContext.tsx`: Theme-Einstellung bleibt in `localStorage` (kein sensibler Datensatz).

**Betroffene Dateien:**
- `src/components/steps/DeepParagraphCheck.tsx`
- `src/context/HandoverContext.tsx`
- `src/hooks/useGuestStorage.ts`

---

## 4. RLS-Policies härten

**Problem:** Laut Security-Scan nutzen `profiles` und `projects` die Rolle `public` statt `authenticated`. Angreifer könnten unauthentifiziert Anfragen stellen.

**Lösung:** Alle RLS-Policies für `profiles` und `projects` werden auf die Rolle `authenticated` umgestellt:

```sql
-- profiles: DROP + recreate alle 3 Policies mit 'authenticated'
-- projects: DROP + recreate alle 4 Policies mit 'authenticated'
```

---

## Technische Details

### Edge Function Auth-Pattern (wird in alle 3 Functions eingefügt):
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), 
    { status: 401, headers: corsHeaders });
}
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!, 
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
const userClient = createClient(
  Deno.env.get('SUPABASE_URL')!, 
  Deno.env.get('SUPABASE_ANON_KEY')!, 
  { global: { headers: { Authorization: authHeader } } }
);
const { data: claims, error: authErr } = await userClient.auth.getClaims(
  authHeader.replace('Bearer ', '')
);
if (authErr || !claims?.claims?.sub) {
  return new Response(JSON.stringify({ error: 'Ungültiges Token' }), 
    { status: 401, headers: corsHeaders });
}
const userId = claims.claims.sub;

// Rate-limit check
const since = new Date(Date.now() - 60000).toISOString();
const { count } = await supabaseAdmin
  .from('ai_rate_limits')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .gte('created_at', since);
if ((count ?? 0) >= 10) {
  return new Response(JSON.stringify({ error: 'Rate-Limit: max. 10 Anfragen/Minute' }), 
    { status: 429, headers: corsHeaders });
}
await supabaseAdmin.from('ai_rate_limits').insert({ user_id: userId, function_name: 'analyze-photo' });
```

### Client-seitige Anpassung:
Alle `fetch()`-Aufrufe an Edge Functions senden bereits den Authorization-Header – dies muss für `analyze-photo`-Aufrufe in 5 Dateien ergänzt werden, da einige aktuell keinen Auth-Header senden.

### Reihenfolge der Implementierung:
1. DB-Migration (Rate-Limit-Tabelle + RLS-Policy-Updates)
2. Edge Functions updaten (Auth + Rate-Limiting)
3. Client-Code updaten (Auth-Header + sessionStorage)
4. Deploy & Test

