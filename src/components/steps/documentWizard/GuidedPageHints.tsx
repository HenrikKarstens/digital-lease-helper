import { motion } from 'framer-motion';
import { FileText, Coins, PenLine, BookOpen } from 'lucide-react';

interface PageHint {
  page: number;
  label: string;
  description: string;
  icon: React.ReactNode;
  fields: string[];
}

const PAGE_HINTS: PageHint[] = [
  {
    page: 1,
    label: 'Stammdaten',
    description: 'Seite mit Vertragsparteien, Adresse & Objektdaten',
    icon: <FileText className="w-4 h-4" />,
    fields: ['Vermieter', 'Mieter', 'Adresse', 'Zimmeranzahl'],
  },
  {
    page: 2,
    label: 'Miete & Kaution',
    description: 'Seite mit Kaltmiete, Nebenkosten & Kautionshöhe',
    icon: <Coins className="w-4 h-4" />,
    fields: ['Kaltmiete', 'NK-Vorauszahlung', 'Heizkosten', 'Kaution'],
  },
  {
    page: 3,
    label: 'Unterschriften',
    description: 'Letzte Seite mit Datum & Unterschriften',
    icon: <PenLine className="w-4 h-4" />,
    fields: ['Vertragsbeginn', 'Unterzeichnungsdatum'],
  },
];

interface Props {
  currentPage: number;
  totalCaptured: number;
}

export const GuidedPageHints = ({ currentPage, totalCaptured }: Props) => {
  const hint = PAGE_HINTS[Math.min(currentPage, PAGE_HINTS.length - 1)];
  const isExtraPage = currentPage >= PAGE_HINTS.length;

  return (
    <motion.div
      key={currentPage}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-4 mb-3 border border-primary/20"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {isExtraPage ? <BookOpen className="w-4 h-4" /> : hint.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wide">
              Seite {currentPage + 1}
            </span>
            <span className="text-xs text-muted-foreground">
              {isExtraPage ? 'Zusätzliche Seite' : hint.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            {isExtraPage
              ? 'Weitere relevante Vertragsseiten scannen'
              : hint.description}
          </p>
        </div>
      </div>

      {!isExtraPage && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {hint.fields.map(field => (
            <span
              key={field}
              className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium"
            >
              {field}
            </span>
          ))}
        </div>
      )}

      {/* Progress dots */}
      <div className="flex gap-1.5 mt-3">
        {PAGE_HINTS.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i < totalCaptured
                ? 'bg-primary w-6'
                : i === currentPage
                ? 'bg-primary/50 w-4 animate-pulse'
                : 'bg-muted w-4'
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
};
