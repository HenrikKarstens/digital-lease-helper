import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import type { PagePhoto } from './types';

interface Props {
  pages: PagePhoto[];
  onRemove: (id: string) => void;
  onAdd: () => void;
  maxPages?: number;
}

export const PageGallery = ({ pages, onRemove, onAdd, maxPages = 20 }: Props) => {
  if (pages.length === 0) return null;

  return (
    <div className="w-full">
      <p className="text-xs text-muted-foreground mb-2 font-medium">
        {pages.length} Seite{pages.length !== 1 ? 'n' : ''} erfasst
      </p>
      <div className="flex gap-2 flex-wrap">
        <AnimatePresence>
          {pages.map((page, idx) => (
            <motion.div
              key={page.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative group"
            >
              <div className="w-16 h-20 rounded-xl overflow-hidden border border-border">
                <img
                  src={page.dataUrl}
                  alt={`Seite ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {idx + 1}
              </div>
              <button
                onClick={() => onRemove(page.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {pages.length < maxPages && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onAdd}
            className="w-16 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-medium">Seite</span>
          </motion.button>
        )}
      </div>
    </div>
  );
};
