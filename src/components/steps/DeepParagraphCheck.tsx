import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scale, Shield, AlertTriangle, CheckCircle2, XCircle, 
  ChevronDown, ChevronUp, Strikethrough, BookOpen, Loader2, Gavel,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover, DeepClause } from '@/context/HandoverContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  SICHER: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  KRITISCH: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  UNWIRKSAM: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' },
};

const CATEGORY_LABELS: Record<string, string> = {
  miete: 'Miete',
  kaution: 'Kaution',
  nebenkosten: 'Nebenkosten',
  reparaturen: 'Reparaturen',
  renovierung: 'Renovierung',
  kuendigung: 'Kündigung',
  nutzung: 'Nutzung',
  sonstiges: 'Sonstiges',
};

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
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 flex items-start gap-2.5"
      >
        <div className={`shrink-0 mt-0.5 ${isStricken ? 'text-muted-foreground' : config.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className={`text-xs font-semibold ${isStricken ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {clause.paragraphRef} – {clause.title}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
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

      {/* Expanded: Legal reasoning */}
      <AnimatePresence>
        {expanded && !isStricken && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/30 mt-0">
              <div className="pt-2">
                <div className="flex items-center gap-1 mb-1">
                  <Gavel className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary">Rechtliche Begründung</span>
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  {clause.reasoning}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
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

      {/* Strike action */}
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

// ── Filter Tabs ─────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { key: 'all', label: 'Alle' },
  { key: 'UNWIRKSAM', label: 'Unwirksam' },
  { key: 'KRITISCH', label: 'Kritisch' },
  { key: 'SICHER', label: 'Sicher' },
] as const;

type FilterKey = typeof FILTER_OPTIONS[number]['key'];

export const DeepParagraphCheck = () => {
  const { data, updateData } = useHandover();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const stricken = data.strickenClauses || [];

  const hasDocs = data.capturedDocuments?.some(d => d.type === 'main-contract' && d.pages.length > 0);
  const clauses = data.deepLegalClauses || [];

  const triggerDeepAnalysis = async () => {
    const mainContract = data.capturedDocuments?.find(d => d.type === 'main-contract');
    if (!mainContract || mainContract.pages.length === 0) {
      toast.error('Kein Mietvertrag vorhanden. Bitte lade zuerst einen Vertrag hoch.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < mainContract.pages.length; i++) {
        const page = mainContract.pages[i];
        const resp = await fetch(page.dataUrl);
        const blob = await resp.blob();
        formData.append(`file_${i}`, blob, `page_${i}.${page.mimeType.includes('png') ? 'png' : 'jpg'}`);
      }

      const { data: result, error } = await supabase.functions.invoke('analyze-contract-deep', {
        body: formData,
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Analyse fehlgeschlagen');

      updateData({
        deepLegalClauses: result.clauses,
        deepAnalysisComplete: true,
      });

      const stats = result.stats;
      if (stats.invalid > 0) {
        toast.warning(`Analyse abgeschlossen: ${stats.invalid} unwirksame Klausel${stats.invalid > 1 ? 'n' : ''} gefunden!`);
      } else if (stats.critical > 0) {
        toast.info(`Analyse abgeschlossen: ${stats.critical} kritische Klausel${stats.critical > 1 ? 'n' : ''} zur Prüfung.`);
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

  const toggleClause = (clauseId: string) => {
    const current = stricken;
    const updated = current.includes(clauseId)
      ? current.filter(c => c !== clauseId)
      : [...current, clauseId];
    updateData({ strickenClauses: updated });

    if (updated.includes(clauseId)) {
      toast.success('Klausel als gestrichen markiert.');
    } else {
      toast.info('Klausel wiederhergestellt.');
    }
  };

  const filteredClauses = clauses.filter(c => filter === 'all' || c.status === filter);

  const stats = {
    safe: clauses.filter(c => c.status === 'SICHER').length,
    critical: clauses.filter(c => c.status === 'KRITISCH').length,
    invalid: clauses.filter(c => c.status === 'UNWIRKSAM').length,
  };

  // No docs available → show nothing
  if (!hasDocs && clauses.length === 0) return null;

  // Docs available but no analysis yet
  if (clauses.length === 0) {
    return (
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Deep Paragraph Check</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Analysiere jeden Paragrafen deines Mietvertrags gegen das BGB (§§ 535–580a) und aktuelle BGH-Rechtsprechung.
          </p>
          <Button
            onClick={triggerDeepAnalysis}
            disabled={loading}
            className="w-full rounded-xl gap-2"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysiere Vertrag...
              </>
            ) : (
              <>
                <Scale className="w-4 h-4" />
                Vollständige Vertragsanalyse starten
              </>
            )}
          </Button>
        </motion.div>
      </div>
    );
  }

  // Show results
  return (
    <div className="w-full max-w-md">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header with stats */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5" />
            Deep Paragraph Check ({clauses.length} Klauseln)
          </h3>
          <div className="flex gap-1.5">
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
            <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md">
              {stats.safe}× Sicher
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-3">
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
              Keine Klauseln mit Status „{FILTER_OPTIONS.find(o => o.key === filter)?.label}" gefunden.
            </p>
          )}
        </div>

        {/* Re-analyze button */}
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
      </motion.div>
    </div>
  );
};
