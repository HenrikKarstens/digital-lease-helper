import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scale, Shield, AlertTriangle, CheckCircle2, XCircle, 
  ChevronDown, ChevronUp, Strikethrough, BookOpen, Loader2, Gavel,
  Sparkles, PenTool, ArrowLeftRight, ShieldAlert, ShieldCheck, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover, DeepClause, DeltaComparison } from '@/context/HandoverContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  SICHER: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  KRITISCH: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  UNWIRKSAM: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
};

const DELTA_CONFIG = {
  pre_existing: { label: 'Bestandsschutz', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300', icon: ShieldCheck },
  new_damage: { label: 'Neuer Schaden', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300', icon: ShieldAlert },
  unchanged: { label: 'Unverändert', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  improved: { label: 'Verbessert', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800', badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300', icon: CheckCircle2 },
};

const CATEGORY_LABELS: Record<string, string> = {
  miete: 'Miete', kaution: 'Kaution', nebenkosten: 'Nebenkosten',
  reparaturen: 'Reparaturen', renovierung: 'Renovierung',
  kuendigung: 'Kündigung', nutzung: 'Nutzung', sonstiges: 'Sonstiges',
};

// ── Clause Card ─────────────────────────────────────────────────────
interface ClauseCardProps {
  clause: DeepClause;
  isStricken: boolean;
  onToggleStrike: () => void;
}

const ClauseCard = ({ clause, isStricken, onToggleStrike }: ClauseCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[clause.status] || STATUS_CONFIG.SICHER;
  const Icon = config.icon;

  return (
    <motion.div
      layout
      className={`rounded-xl border transition-all ${isStricken ? 'bg-muted/40 border-border opacity-60' : config.bg}`}
    >
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-3 flex items-start gap-2.5">
        <div className={`shrink-0 mt-0.5 ${isStricken ? 'text-muted-foreground' : config.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className={`text-xs font-semibold ${isStricken ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {clause.paragraphRef} – {clause.title}
            </h4>
            <div className="flex items-center gap-1 shrink-0">
              {clause.isHandwritten && (
                <span className="text-[9px] font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <PenTool className="w-2.5 h-2.5" />
                  Handschrift
                </span>
              )}
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${isStricken ? 'bg-muted text-muted-foreground' : config.badge}`}>
                {isStricken ? 'Gestrichen' : clause.status}
              </span>
              {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
            </div>
          </div>
          {!isStricken && (
            <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
              „{clause.originalText}"
            </p>
          )}
          {isStricken && (
            <p className="text-[10px] text-muted-foreground italic">Vom Nutzer als gestrichen markiert</p>
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && !isStricken && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/30">
              {/* Handwriting note */}
              {clause.isHandwritten && clause.handwrittenNote && (
                <div className="pt-2 flex items-start gap-1.5 p-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                  <PenTool className="w-3 h-3 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">Individualvereinbarung (§ 305b BGB)</span>
                    <p className="text-[10px] text-violet-800 dark:text-violet-200 leading-relaxed mt-0.5">{clause.handwrittenNote}</p>
                  </div>
                </div>
              )}
              
              <div className="pt-2">
                <div className="flex items-center gap-1 mb-1">
                  <Gavel className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary">Rechtliche Begründung</span>
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed">{clause.reasoning}</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-2.5 h-2.5" />
                  {clause.legalBasis}
                </span>
                <span className="flex items-center gap-1">
                  <Scale className="w-2.5 h-2.5" />
                  Risiko: {clause.riskLevel}/10
                </span>
                <span className="px-1.5 py-0.5 rounded bg-secondary text-[9px] font-medium">
                  {CATEGORY_LABELS[clause.category] || clause.category}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {expanded && (
        <div className="px-3 pb-2 flex justify-end" onClick={e => e.stopPropagation()}>
          <button
            onClick={onToggleStrike}
            className={`flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
              isStricken
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <Strikethrough className="w-3 h-3" />
            {isStricken ? 'Wiederherstellen' : 'Klausel streichen'}
          </button>
        </div>
      )}
    </motion.div>
  );
};

// ── Delta Card ──────────────────────────────────────────────────────
const DeltaCard = ({ item }: { item: DeltaComparison }) => {
  const [expanded, setExpanded] = useState(false);
  const config = DELTA_CONFIG[item.delta] || DELTA_CONFIG.unchanged;
  const Icon = config.icon;

  return (
    <motion.div layout className={`rounded-xl border transition-all ${config.bg}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-3 flex items-start gap-2.5">
        <div className={`shrink-0 mt-0.5 ${config.color}`}><Icon className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className="text-xs font-semibold text-foreground">{item.room} – {item.element}</h4>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${config.badge}`}>
                {config.label}
              </span>
              {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
            </div>
          </div>
          {item.delta === 'pre_existing' && (
            <p className="text-[10px] text-blue-700 dark:text-blue-300 italic flex items-center gap-1">
              <Info className="w-2.5 h-2.5" />
              Bereits beim Einzug dokumentiert – keine Haftung (§ 538 BGB)
            </p>
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2 border-t border-border/30">
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="p-2 rounded-lg bg-background/50">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Einzug</span>
                  <p className="text-[10px] text-foreground mt-0.5">{item.moveInCondition || '–'}</p>
                </div>
                <div className="p-2 rounded-lg bg-background/50">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Auszug</span>
                  <p className="text-[10px] text-foreground mt-0.5">{item.moveOutCondition || '–'}</p>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <Gavel className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-foreground/80 leading-relaxed">{item.reasoning}</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>Haftung: <strong>{item.liability === 'tenant' ? 'Mieter' : item.liability === 'landlord' ? 'Vermieter' : 'Keine'}</strong></span>
                <span>Schwere: {item.severity}/10</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Filter Tabs ─────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { key: 'all', label: 'Alle' },
  { key: 'UNWIRKSAM', label: 'Unwirksam' },
  { key: 'KRITISCH', label: 'Kritisch' },
  { key: 'SICHER', label: 'Sicher' },
  { key: 'handwritten', label: '✍ Handschrift' },
] as const;

type FilterKey = typeof FILTER_OPTIONS[number]['key'];

// ── Main Component ──────────────────────────────────────────────────
export const DeepParagraphCheck = () => {
  const { data, updateData } = useHandover();
  const [loading, setLoading] = useState(false);
  const [deltaLoading, setDeltaLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [activeTab, setActiveTab] = useState<'clauses' | 'delta'>('clauses');
  const stricken = data.strickenClauses || [];

  const hasDocs = data.capturedDocuments?.some(d => d.type === 'main-contract' && d.pages.length > 0);
  const hasProtocol = data.capturedDocuments?.some(d => d.type === 'handover-protocol' && d.pages.length > 0);
  const clauses = data.deepLegalClauses || [];
  const deltaResult = data.deltaCheckResult;

  const triggerDeepAnalysis = async () => {
    const mainContract = data.capturedDocuments?.find(d => d.type === 'main-contract');
    if (!mainContract || mainContract.pages.length === 0) {
      toast.error('Kein Mietvertrag vorhanden.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('mode', 'deep-check');
      for (let i = 0; i < mainContract.pages.length; i++) {
        const page = mainContract.pages[i];
        const resp = await fetch(page.dataUrl);
        const blob = await resp.blob();
        formData.append(`file_${i}`, blob, `page_${i}.${page.mimeType.includes('png') ? 'png' : 'jpg'}`);
      }

      const { data: result, error } = await supabase.functions.invoke('analyze-contract-deep', { body: formData });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Analyse fehlgeschlagen');

      updateData({ deepLegalClauses: result.clauses, deepAnalysisComplete: true });

      const stats = result.stats;
      const parts: string[] = [];
      if (stats.invalid > 0) parts.push(`${stats.invalid}× unwirksam`);
      if (stats.critical > 0) parts.push(`${stats.critical}× kritisch`);
      if (stats.handwritten > 0) parts.push(`${stats.handwritten}× Handschrift`);

      if (stats.invalid > 0) {
        toast.warning(`Analyse: ${parts.join(', ')}`);
      } else if (stats.critical > 0) {
        toast.info(`Analyse: ${parts.join(', ')}`);
      } else {
        toast.success('Alle Klauseln sind rechtlich unbedenklich!');
      }
    } catch (err: any) {
      console.error('Deep analysis error:', err);
      toast.error(err.message || 'Fehler bei der Tiefenanalyse');
    } finally {
      setLoading(false);
    }
  };

  const triggerDeltaCheck = async () => {
    const moveInProtocol = data.capturedDocuments?.find(d => d.type === 'handover-protocol');
    if (!moveInProtocol || moveInProtocol.pages.length === 0) {
      toast.error('Kein Einzugsprotokoll vorhanden.');
      return;
    }

    // For the move-out side, use the current findings as text or another protocol
    // For now we use the same protocol images as both sides for demo; 
    // in production, this should be two separate protocols
    setDeltaLoading(true);
    try {
      const formData = new FormData();
      formData.append('mode', 'delta-check');

      // Move-in protocol pages
      for (let i = 0; i < moveInProtocol.pages.length; i++) {
        const page = moveInProtocol.pages[i];
        const resp = await fetch(page.dataUrl);
        const blob = await resp.blob();
        formData.append(`movein_${i}`, blob, `movein_${i}.jpg`);
      }

      // Move-out: use main contract's handover protocol or same for comparison
      // In a real scenario, the user would upload a second protocol
      const moveOutProtocol = data.capturedDocuments?.find(d => d.type === 'handover-protocol');
      if (moveOutProtocol) {
        for (let i = 0; i < moveOutProtocol.pages.length; i++) {
          const page = moveOutProtocol.pages[i];
          const resp = await fetch(page.dataUrl);
          const blob = await resp.blob();
          formData.append(`moveout_${i}`, blob, `moveout_${i}.jpg`);
        }
      }

      const { data: result, error } = await supabase.functions.invoke('analyze-contract-deep', { body: formData });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Delta-Check fehlgeschlagen');

      updateData({
        deltaCheckResult: {
          comparisons: result.comparisons || [],
          summary: result.summary || { totalItems: 0, preExisting: 0, newDamages: 0, unchanged: 0, tenantLiabilityEstimate: '' },
        },
      });

      const s = result.summary;
      if (s?.preExisting > 0) {
        toast.info(`Delta-Check: ${s.preExisting} Vorschäden erkannt – keine Mieterhaftung (§ 538 BGB)`);
      } else {
        toast.success('Delta-Check abgeschlossen.');
      }
      setActiveTab('delta');
    } catch (err: any) {
      console.error('Delta-check error:', err);
      toast.error(err.message || 'Fehler beim Delta-Check');
    } finally {
      setDeltaLoading(false);
    }
  };

  const toggleClause = (clauseId: string) => {
    const updated = stricken.includes(clauseId)
      ? stricken.filter(c => c !== clauseId)
      : [...stricken, clauseId];
    updateData({ strickenClauses: updated });
    toast[updated.includes(clauseId) ? 'success' : 'info'](
      updated.includes(clauseId) ? 'Klausel als gestrichen markiert.' : 'Klausel wiederhergestellt.'
    );
  };

  const filteredClauses = clauses.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'handwritten') return c.isHandwritten;
    return c.status === filter;
  });

  const stats = {
    safe: clauses.filter(c => c.status === 'SICHER').length,
    critical: clauses.filter(c => c.status === 'KRITISCH').length,
    invalid: clauses.filter(c => c.status === 'UNWIRKSAM').length,
    handwritten: clauses.filter(c => c.isHandwritten).length,
  };

  if (!hasDocs && clauses.length === 0) return null;

  // ── No analysis yet ───────────────────────────────────────────────
  if (clauses.length === 0) {
    return (
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Deep Paragraph Check</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Sequenzieller Paragrafenscan: Jeder § wird einzeln gegen BGB & BGH-Rechtsprechung geprüft. Handschriftliche Ergänzungen erhalten höchste Priorität.
          </p>
          <Button onClick={triggerDeepAnalysis} disabled={loading} className="w-full rounded-xl gap-2" size="sm">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Analysiere §§ sequenziell...</>
            ) : (
              <><Scale className="w-4 h-4" />Paragrafenscan starten</>
            )}
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Tab switcher: Clauses vs Delta */}
        <div className="flex gap-1 mb-3 p-0.5 bg-secondary/40 rounded-xl">
          <button
            onClick={() => setActiveTab('clauses')}
            className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'clauses' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="w-3 h-3" />
            Vertragsanalyse ({clauses.length})
          </button>
          <button
            onClick={() => setActiveTab('delta')}
            className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'delta' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowLeftRight className="w-3 h-3" />
            Delta-Check {deltaResult ? `(${deltaResult.comparisons.length})` : ''}
          </button>
        </div>

        {/* ── Clauses Tab ──────────────────────────────────────────── */}
        {activeTab === 'clauses' && (
          <>
            {/* Stats */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" />
                Sequenzieller Paragrafenscan
              </h3>
              <div className="flex gap-1 flex-wrap justify-end">
                {stats.invalid > 0 && (
                  <span className="text-[9px] font-bold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-md">
                    {stats.invalid}× Unwirksam
                  </span>
                )}
                {stats.critical > 0 && (
                  <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-md">
                    {stats.critical}× Kritisch
                  </span>
                )}
                {stats.handwritten > 0 && (
                  <span className="text-[9px] font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                    <PenTool className="w-2 h-2" />
                    {stats.handwritten}× Handschrift
                  </span>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-3 flex-wrap">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                    filter === opt.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Clauses list */}
            <div className="space-y-2">
              {filteredClauses.map((clause, idx) => (
                <ClauseCard
                  key={`${clause.paragraphRef}-${idx}`}
                  clause={clause}
                  isStricken={stricken.includes(`deep-${clause.paragraphRef}`)}
                  onToggleStrike={() => toggleClause(`deep-${clause.paragraphRef}`)}
                />
              ))}
              {filteredClauses.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Keine Klauseln mit diesem Filter gefunden.
                </p>
              )}
            </div>

            <div className="mt-3">
              <button
                onClick={triggerDeepAnalysis}
                disabled={loading}
                className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {loading ? 'Analysiere...' : 'Erneut analysieren'}
              </button>
            </div>
          </>
        )}

        {/* ── Delta-Check Tab ──────────────────────────────────────── */}
        {activeTab === 'delta' && (
          <>
            {!deltaResult ? (
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowLeftRight className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Delta-Check: Einzug vs. Auszug</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Vergleiche das Einzugsprotokoll mit dem aktuellen Zustand. Vorschäden werden automatisch als „Bestandsschutz" markiert (§ 538 BGB).
                </p>
                {!hasProtocol && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Bitte lade zuerst ein Einzugsprotokoll im Dokumenten-Scanner hoch.
                  </p>
                )}
                <Button
                  onClick={triggerDeltaCheck}
                  disabled={deltaLoading || !hasProtocol}
                  className="w-full rounded-xl gap-2"
                  size="sm"
                >
                  {deltaLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Vergleiche Protokolle...</>
                  ) : (
                    <><ArrowLeftRight className="w-4 h-4" />Delta-Check starten</>
                  )}
                </Button>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="rounded-xl border border-border bg-card p-3 mb-3">
                  <h4 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    Delta-Zusammenfassung
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{deltaResult.summary.preExisting}</div>
                      <div className="text-[9px] text-blue-600 dark:text-blue-400">Bestandsschutz</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/30">
                      <div className="text-lg font-bold text-red-700 dark:text-red-300">{deltaResult.summary.newDamages}</div>
                      <div className="text-[9px] text-red-600 dark:text-red-400">Neue Schäden</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{deltaResult.summary.unchanged}</div>
                      <div className="text-[9px] text-emerald-600 dark:text-emerald-400">Unverändert</div>
                    </div>
                  </div>
                  {deltaResult.summary.tenantLiabilityEstimate && (
                    <div className="mt-2 text-[10px] text-center text-muted-foreground">
                      Geschätzte Mieterhaftung: <strong>{deltaResult.summary.tenantLiabilityEstimate}</strong>
                    </div>
                  )}
                </div>

                {/* Comparisons */}
                <div className="space-y-2">
                  {deltaResult.comparisons.map((item, idx) => (
                    <DeltaCard key={`${item.room}-${item.element}-${idx}`} item={item} />
                  ))}
                </div>

                <div className="mt-3">
                  <button
                    onClick={triggerDeltaCheck}
                    disabled={deltaLoading}
                    className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1"
                  >
                    {deltaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowLeftRight className="w-3 h-3" />}
                    {deltaLoading ? 'Vergleiche...' : 'Delta-Check wiederholen'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};
