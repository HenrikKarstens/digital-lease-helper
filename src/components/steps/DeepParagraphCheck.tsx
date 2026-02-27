import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scale, Shield, AlertTriangle, CheckCircle2, XCircle, 
  ChevronDown, ChevronUp, Strikethrough, BookOpen, Loader2, Gavel,
  Sparkles, PenTool, ArrowLeftRight, ShieldAlert, ShieldCheck, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useHandover, DeepClause, DeltaComparison } from '@/context/HandoverContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Cache helpers ──────────────────────────────────────────────────
const CLAUSE_CACHE_KEY = 'estateturn_clause_cache';
const CLAUSE_CACHE_VERSION_KEY = 'estateturn_clause_cache_version';

function getDocumentHash(pages: Array<{ dataUrl: string }>): string {
  // Simple hash based on page count + first few chars of first page
  const first = pages[0]?.dataUrl || '';
  return `${pages.length}-${first.substring(0, 100).length}-${first.substring(first.length - 20)}`;
}

function getClauseCache(docHash: string): Record<string, DeepClause> {
  try {
    const version = localStorage.getItem(CLAUSE_CACHE_VERSION_KEY);
    if (version !== docHash) return {};
    return JSON.parse(localStorage.getItem(CLAUSE_CACHE_KEY) || '{}');
  } catch { return {}; }
}

function setCachedClause(docHash: string, ref: string, clause: DeepClause) {
  try {
    localStorage.setItem(CLAUSE_CACHE_VERSION_KEY, docHash);
    const cache = getClauseCache(docHash);
    cache[ref] = clause;
    localStorage.setItem(CLAUSE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    console.warn('Could not cache clause detail');
  }
}

function clearClauseCache() {
  try {
    localStorage.removeItem(CLAUSE_CACHE_KEY);
    localStorage.removeItem(CLAUSE_CACHE_VERSION_KEY);
  } catch {}
}

// ── Status config ──────────────────────────────────────────────────
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
  isPendingConfirmation: boolean;
  isLoadingDetail: boolean;
  onToggleStrike: () => void;
  onOpenConfirmDialog: () => void;
  onOpenManualStrikeDialog: () => void;
  onRequestDetail: () => void;
}

const ClauseCard = ({ clause, isStricken, isPendingConfirmation, isLoadingDetail, onToggleStrike, onOpenConfirmDialog, onOpenManualStrikeDialog, onRequestDetail }: ClauseCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = clause.detailLoaded || !!clause.reasoning;
  const config = STATUS_CONFIG[clause.status] || STATUS_CONFIG.SICHER;
  const Icon = config.icon;

  const handleExpand = () => {
    if (isPendingConfirmation) {
      onOpenConfirmDialog();
      return;
    }
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    // Lazy-load detail when expanding for the first time
    if (newExpanded && !hasDetail && !isLoadingDetail) {
      onRequestDetail();
    }
  };

  return (
    <motion.div
      layout
      className={`rounded-xl border transition-all ${
        isStricken
          ? 'bg-muted/40 border-border opacity-60'
          : isPendingConfirmation
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 ring-1 ring-amber-300 dark:ring-amber-700'
            : config.bg
      }`}
    >
      <button onClick={handleExpand} className="w-full text-left p-3 flex items-start gap-2.5">
        <div className={`shrink-0 mt-0.5 ${isStricken ? 'text-muted-foreground' : isPendingConfirmation ? 'text-amber-600 dark:text-amber-400' : config.color}`}>
          {isPendingConfirmation ? <AlertTriangle className="w-4 h-4" /> : isStricken ? <Strikethrough className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
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
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                isStricken
                  ? 'bg-muted text-muted-foreground'
                  : isPendingConfirmation
                    ? 'bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 animate-pulse'
                    : !hasDetail
                      ? 'bg-secondary text-muted-foreground'
                      : config.badge
              }`}>
                {isStricken ? 'Gestrichen' : isPendingConfirmation ? '⚠ Bestätigung nötig' : !hasDetail ? 'Tippen für Details' : clause.status}
              </span>
              {!isPendingConfirmation && (expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />)}
            </div>
          </div>
          {isStricken && (
            <p className="text-[10px] text-muted-foreground italic">Vom Nutzer als gestrichen verifiziert – kein Einfluss auf Gesamtbewertung</p>
          )}
          {isPendingConfirmation && (
            <p className="text-[10px] text-amber-700 dark:text-amber-300 italic flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Streichung erkannt – Bitte bestätigen
            </p>
          )}
          {!isStricken && !isPendingConfirmation && hasDetail && (
            <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
              „{clause.originalText}"
            </p>
          )}
        </div>
        {!isPendingConfirmation && (
          <div className="shrink-0 ml-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={isStricken ? onToggleStrike : onOpenManualStrikeDialog}
              className={`p-1 rounded-md transition-colors ${
                isStricken
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary'
              }`}
              title={isStricken ? 'Wiederherstellen' : 'Klausel manuell streichen'}
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </button>

      {isPendingConfirmation && !expanded && (
        <div className="px-3 pb-2 flex gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={onOpenConfirmDialog}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <AlertTriangle className="w-3 h-3" />
            Streichung prüfen
          </button>
        </div>
      )}

      <AnimatePresence>
        {expanded && !isStricken && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/30">
              {isLoadingDetail && (
                <div className="flex items-center gap-2 py-3 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-[11px] text-muted-foreground">Analysiere {clause.paragraphRef}...</span>
                </div>
              )}
              {!isLoadingDetail && hasDetail && (
                <>
                  {clause.visuallyStricken && clause.strikeNote && (
                    <div className="pt-2 flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <Strikethrough className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">KI-Streichungserkennung</span>
                        <p className="text-[10px] text-amber-800 dark:text-amber-200 leading-relaxed mt-0.5">{clause.strikeNote}</p>
                      </div>
                    </div>
                  )}
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
                </>
              )}
              {!isLoadingDetail && !hasDetail && (
                <div className="py-3 text-center">
                  <button
                    onClick={onRequestDetail}
                    className="text-[11px] text-primary font-medium hover:underline flex items-center gap-1 mx-auto"
                  >
                    <Sparkles className="w-3 h-3" />
                    Detailanalyse laden
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  { key: 'actionable', label: '⚡ Prüfbedarf' },
  { key: 'pending', label: '⚠ Offen' },
  { key: 'all', label: 'Alle' },
  { key: 'UNWIRKSAM', label: 'Unwirksam' },
  { key: 'KRITISCH', label: 'Kritisch' },
  { key: 'SICHER', label: 'Sicher' },
  { key: 'handwritten', label: '✍ Handschrift' },
  { key: 'stricken', label: '✕ Gestrichen' },
] as const;

type FilterKey = typeof FILTER_OPTIONS[number]['key'];

// ── Main Component ──────────────────────────────────────────────────
export const DeepParagraphCheck = () => {
  const { data, updateData } = useHandover();
  const [loading, setLoading] = useState(false);
  const [deltaLoading, setDeltaLoading] = useState(false);
  const [loadingClauseRef, setLoadingClauseRef] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('actionable');
  const [activeTab, setActiveTab] = useState<'clauses' | 'delta'>('clauses');
  const [confirmDialogClause, setConfirmDialogClause] = useState<DeepClause | null>(null);
  const [manualStrikeClause, setManualStrikeClause] = useState<DeepClause | null>(null);
  const autoScanStartedRef = useRef(false);
  const stricken = data.strickenClauses || [];

  const mainContract = data.capturedDocuments?.find(d => d.type === 'main-contract');
  const hasDocs = mainContract && mainContract.pages.length > 0;
  const hasProtocol = data.capturedDocuments?.some(d => d.type === 'handover-protocol' && d.pages.length > 0);
  const clauses = data.deepLegalClauses || [];
  const deltaResult = data.deltaCheckResult;

  const docHash = hasDocs ? getDocumentHash(mainContract.pages) : '';

  const isClauseStricken = (c: DeepClause) => stricken.includes(`deep-${c.paragraphRef}`);
  
  const isPendingConfirmation = (c: DeepClause) => {
    if (!c.visuallyStricken) return false;
    const key = `deep-${c.paragraphRef}`;
    if (stricken.includes(key)) return false;
    if (stricken.includes(`deny-${c.paragraphRef}`)) return false;
    return true;
  };

  const pendingCount = clauses.filter(isPendingConfirmation).length;

  const handleConfirmStrike = (clause: DeepClause) => {
    const key = `deep-${clause.paragraphRef}`;
    const denyKey = `deny-${clause.paragraphRef}`;
    const updated = stricken.filter(c => c !== denyKey);
    updateData({ strickenClauses: [...updated, key] });
    toast.success(`${clause.paragraphRef} als gestrichen bestätigt – keine rechtliche Relevanz mehr.`);
    setConfirmDialogClause(null);
  };

  const handleDenyStrike = (clause: DeepClause) => {
    const denyKey = `deny-${clause.paragraphRef}`;
    if (!stricken.includes(denyKey)) {
      updateData({ strickenClauses: [...stricken, denyKey] });
    }
    toast.info(`${clause.paragraphRef} bleibt aktiv.`);
    setConfirmDialogClause(null);
  };

  // ── TOC-SCAN: Lightweight initial scan ────────────────────────────
  const triggerTocScan = useCallback(async () => {
    if (!mainContract || mainContract.pages.length === 0) {
      toast.error('Kein Mietvertrag vorhanden.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('mode', 'toc-scan');
      for (let i = 0; i < mainContract.pages.length; i++) {
        const page = mainContract.pages[i];
        const resp = await fetch(page.dataUrl);
        const blob = await resp.blob();
        formData.append(`file_${i}`, blob, `page_${i}.${page.mimeType.includes('png') ? 'png' : 'jpg'}`);
      }

      const { data: result, error } = await supabase.functions.invoke('analyze-contract-deep', { body: formData });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'TOC-Scan fehlgeschlagen');

      // Convert TOC entries to partial DeepClauses (without detail)
      const tocClauses: DeepClause[] = (result.entries || []).map((entry: any) => ({
        paragraphRef: entry.paragraphRef || '',
        title: entry.title || '',
        originalText: '',
        status: 'SICHER' as const, // placeholder until detail loaded
        legalBasis: '',
        reasoning: '',
        riskLevel: 0,
        category: entry.category || 'sonstiges',
        isHandwritten: entry.isHandwritten || false,
        handwrittenNote: '',
        visuallyStricken: entry.visuallyStricken || false,
        strikeNote: entry.strikeNote || '',
        pageIndex: entry.pageIndex ?? 0,
        detailLoaded: false,
      }));

      updateData({ deepLegalClauses: tocClauses, deepAnalysisComplete: true });

      const strikes = tocClauses.filter(c => c.visuallyStricken).length;
      if (strikes > 0) {
        toast.warning(`${strikes} Streichung(en) erkannt – Bitte bestätigen`, { duration: 6000 });
        setFilter('pending');
      } else {
        toast.success(`${tocClauses.length} Paragraphen erkannt. Tippe auf einen § für die Detailanalyse.`);
      }
    } catch (err: any) {
      console.error('TOC scan error:', err);
      toast.error(err.message || 'Fehler beim Scan');
    } finally {
      setLoading(false);
    }
  }, [mainContract, updateData]);

  // ── CLAUSE-DETAIL: On-demand per-clause analysis ──────────────────
  const loadClauseDetail = useCallback(async (clause: DeepClause) => {
    if (!mainContract || !clause.paragraphRef) return;

    // Check cache first
    const cache = getClauseCache(docHash);
    if (cache[clause.paragraphRef]) {
      const cached = cache[clause.paragraphRef];
      const updatedClauses = clauses.map(c =>
        c.paragraphRef === clause.paragraphRef ? { ...c, ...cached, detailLoaded: true } : c
      );
      updateData({ deepLegalClauses: updatedClauses });
      return;
    }

    setLoadingClauseRef(clause.paragraphRef);
    try {
      const pageIdx = clause.pageIndex ?? 0;
      const page = mainContract.pages[pageIdx];
      if (!page) {
        toast.error('Seite nicht gefunden');
        return;
      }

      const formData = new FormData();
      formData.append('mode', 'clause-detail');
      formData.append('paragraphRef', clause.paragraphRef);
      if (clause.visuallyStricken) {
        formData.append('isStricken', 'true');
        formData.append('strikeNote', clause.strikeNote || '');
      }

      const resp = await fetch(page.dataUrl);
      const blob = await resp.blob();
      formData.append('file_0', blob, `page_${pageIdx}.${page.mimeType.includes('png') ? 'png' : 'jpg'}`);

      const { data: result, error } = await supabase.functions.invoke('analyze-contract-deep', { body: formData });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Analyse fehlgeschlagen');

      const detail = result.clause;
      const enrichedClause: DeepClause = {
        ...clause,
        ...detail,
        pageIndex: clause.pageIndex,
        detailLoaded: true,
      };

      // Cache the result
      setCachedClause(docHash, clause.paragraphRef, enrichedClause);

      // Update global state
      const updatedClauses = clauses.map(c =>
        c.paragraphRef === clause.paragraphRef ? enrichedClause : c
      );
      updateData({ deepLegalClauses: updatedClauses });
    } catch (err: any) {
      console.error('Clause detail error:', err);
      toast.error(`Fehler bei ${clause.paragraphRef}: ${err.message}`);
    } finally {
      setLoadingClauseRef(null);
    }
  }, [mainContract, clauses, docHash, updateData]);

  // Auto-start TOC scan
  useEffect(() => {
    if (!hasDocs) {
      autoScanStartedRef.current = false;
      return;
    }
    const shouldAutoStart = !autoScanStartedRef.current && !loading && clauses.length === 0 && !data.deepAnalysisComplete;
    if (!shouldAutoStart) return;
    autoScanStartedRef.current = true;
    void triggerTocScan();
  }, [hasDocs, loading, clauses.length, data.deepAnalysisComplete, triggerTocScan]);

  // ── Delta Check ───────────────────────────────────────────────────
  const triggerDeltaCheck = async () => {
    const moveInProtocol = data.capturedDocuments?.find(d => d.type === 'handover-protocol');
    if (!moveInProtocol || moveInProtocol.pages.length === 0) {
      toast.error('Kein Einzugsprotokoll vorhanden.');
      return;
    }

    setDeltaLoading(true);
    try {
      const formData = new FormData();
      formData.append('mode', 'delta-check');
      for (let i = 0; i < moveInProtocol.pages.length; i++) {
        const page = moveInProtocol.pages[i];
        const resp = await fetch(page.dataUrl);
        const blob = await resp.blob();
        formData.append(`movein_${i}`, blob, `movein_${i}.jpg`);
      }
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
    if (filter === 'stricken') return isClauseStricken(c);
    if (filter === 'pending') return isPendingConfirmation(c);
    if (filter === 'actionable') {
      // For clauses without detail yet, only show if strike-pending
      if (!c.detailLoaded) return isPendingConfirmation(c) || c.visuallyStricken;
      return c.status === 'KRITISCH' || c.status === 'UNWIRKSAM' || isPendingConfirmation(c) || c.visuallyStricken;
    }
    if (filter === 'all') return true;
    if (filter === 'handwritten') return c.isHandwritten;
    if (!c.detailLoaded) return false; // Can't filter by status without detail
    return c.status === filter;
  });

  // Stats based on detail-loaded clauses only
  const detailedClauses = clauses.filter(c => c.detailLoaded && !isClauseStricken(c));
  const strickenCount = clauses.filter(c => isClauseStricken(c)).length;
  const stats = {
    safe: detailedClauses.filter(c => c.status === 'SICHER').length,
    critical: detailedClauses.filter(c => c.status === 'KRITISCH').length,
    invalid: detailedClauses.filter(c => c.status === 'UNWIRKSAM').length,
    handwritten: clauses.filter(c => c.isHandwritten && !isClauseStricken(c)).length,
    detailLoaded: detailedClauses.length,
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
            Sequenzieller Paragrafenscan: Jeder § wird einzeln gegen BGB & BGH-Rechtsprechung geprüft.
          </p>
          <Button onClick={triggerTocScan} disabled={loading} className="w-full rounded-xl gap-2" size="sm">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Scanne Paragraphen...</>
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
      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmDialogClause} onOpenChange={(open) => { if (!open) setConfirmDialogClause(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Strikethrough className="w-5 h-5" />
              Streichung erkannt
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-sm">
                In <strong>{confirmDialogClause?.paragraphRef}</strong> ({confirmDialogClause?.title}) wurden Streichungen erkannt.
              </p>
              {confirmDialogClause?.strikeNote && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-[11px] text-amber-800 dark:text-amber-200 italic">
                    „{confirmDialogClause.strikeNote}"
                  </p>
                </div>
              )}
              <p className="text-sm font-medium text-foreground">
                Ist dieser Abschnitt im Originaldokument offiziell gestrichen?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => confirmDialogClause && handleDenyStrike(confirmDialogClause)}>
              Nein, aktiv
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialogClause && handleConfirmStrike(confirmDialogClause)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Strikethrough className="w-4 h-4 mr-1" />
              Ja, gestrichen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Strike Dialog */}
      <AlertDialog open={!!manualStrikeClause} onOpenChange={(open) => { if (!open) setManualStrikeClause(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Strikethrough className="w-5 h-5" />
              Klausel manuell streichen
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="text-sm">
                Möchten Sie <strong>{manualStrikeClause?.paragraphRef}</strong> ({manualStrikeClause?.title}) als gestrichen markieren?
              </p>
              <p className="text-xs text-muted-foreground">
                Die Klausel wird aus der rechtlichen Bewertung ausgeschlossen.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (manualStrikeClause) {
                  toggleClause(`deep-${manualStrikeClause.paragraphRef}`);
                  setManualStrikeClause(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Strikethrough className="w-4 h-4 mr-1" />
              Ja, streichen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Pending confirmation banner */}
        {pendingCount > 0 && activeTab === 'clauses' && (
          <div className="mb-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                {pendingCount} Streichung(en) erkannt – Bestätigung erforderlich
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300">
                Bitte bestätigen oder ablehnen, bevor die Analyse abgeschlossen wird.
              </p>
            </div>
            <button
              onClick={() => setFilter('pending')}
              className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Anzeigen
            </button>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 mb-3 p-0.5 bg-secondary/40 rounded-xl">
          <button
            onClick={() => setActiveTab('clauses')}
            className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'clauses' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="w-3 h-3" />
            Vertragsanalyse ({clauses.length})
            {pendingCount > 0 && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
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
            <div className="mb-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" />
                  Paragrafenscan
                </h3>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {stats.detailLoaded}/{clauses.length} analysiert
                </span>
              </div>
              {stats.detailLoaded > 0 && (
                <>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden flex">
                    {stats.safe > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(stats.safe / clauses.length) * 100}%` }} />}
                    {stats.critical > 0 && <div className="h-full bg-amber-500 transition-all" style={{ width: `${(stats.critical / clauses.length) * 100}%` }} />}
                    {stats.invalid > 0 && <div className="h-full bg-red-500 transition-all" style={{ width: `${(stats.invalid / clauses.length) * 100}%` }} />}
                    {strickenCount > 0 && <div className="h-full bg-muted-foreground/30 transition-all" style={{ width: `${(strickenCount / clauses.length) * 100}%` }} />}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {pendingCount > 0 && (
                      <span className="text-[9px] font-bold bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-md animate-pulse">
                        {pendingCount}× Bestätigung nötig
                      </span>
                    )}
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
                    {strickenCount > 0 && (
                      <span className="text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">
                        {strickenCount}× Gestrichen
                      </span>
                    )}
                  </div>
                </>
              )}
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
                      : opt.key === 'pending' && pendingCount > 0
                        ? 'bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 animate-pulse'
                        : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                  {opt.key === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                </button>
              ))}
            </div>

            {/* Clauses list */}
            <div className="space-y-2">
              {filteredClauses.map((clause, idx) => (
                <ClauseCard
                  key={`${clause.paragraphRef}-${idx}`}
                  clause={clause}
                  isStricken={isClauseStricken(clause)}
                  isPendingConfirmation={isPendingConfirmation(clause)}
                  isLoadingDetail={loadingClauseRef === clause.paragraphRef}
                  onToggleStrike={() => toggleClause(`deep-${clause.paragraphRef}`)}
                  onOpenConfirmDialog={() => setConfirmDialogClause(clause)}
                  onOpenManualStrikeDialog={() => setManualStrikeClause(clause)}
                  onRequestDetail={() => loadClauseDetail(clause)}
                />
              ))}
              {filteredClauses.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {filter === 'actionable' && clauses.length > 0 && clauses.every(c => !c.detailLoaded)
                    ? 'Tippe auf einen Paragraphen, um die Rechtsanalyse zu laden.'
                    : 'Keine Klauseln mit diesem Filter gefunden.'}
                </p>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { clearClauseCache(); updateData({ deepLegalClauses: [], deepAnalysisComplete: false }); autoScanStartedRef.current = false; }}
                className="flex-1 text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Erneut scannen
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
                  Vergleiche das Einzugsprotokoll mit dem aktuellen Zustand.
                </p>
                {!hasProtocol && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Bitte lade zuerst ein Einzugsprotokoll hoch.
                  </p>
                )}
                <Button onClick={triggerDeltaCheck} disabled={deltaLoading || !hasProtocol} className="w-full rounded-xl gap-2" size="sm">
                  {deltaLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Vergleiche Protokolle...</>
                  ) : (
                    <><ArrowLeftRight className="w-4 h-4" />Delta-Check starten</>
                  )}
                </Button>
              </div>
            ) : (
              <>
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
