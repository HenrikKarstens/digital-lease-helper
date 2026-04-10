import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileText, Loader2, Printer, X } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Button } from '@/components/ui/button';

GlobalWorkerOptions.workerSrc = workerSrc;

type PdfPreviewModalProps = {
  badgeText?: string;
  onClose: () => void;
  onPrint: () => void;
  pdfBlob: Blob | null;
  title?: string;
  watermarkText?: string;
};

const revokeUrls = (urls: string[]) => {
  urls.forEach((url) => URL.revokeObjectURL(url));
};

export const PdfPreviewModal = ({
  badgeText,
  onClose,
  onPrint,
  pdfBlob,
  title = 'Protokoll-Vorschau',
  watermarkText,
}: PdfPreviewModalProps) => {
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!pdfBlob) return;

    let cancelled = false;

    const renderPdf = async () => {
      setIsLoading(true);
      setError(null);
      revokeUrls(imageUrlsRef.current);
      imageUrlsRef.current = [];
      setPageImages([]);

      try {
        const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
        const pdf = await getDocument({ data: pdfBytes }).promise;
        const nextImages: string[] = [];
        const scale = 1.35 * Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) {
            throw new Error('Canvas-Kontext konnte nicht erstellt werden.');
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvas, canvasContext: context, viewport }).promise;

          const imageBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
                return;
              }
              reject(new Error('PDF-Seite konnte nicht gerendert werden.'));
            }, 'image/png');
          });

          const imageUrl = URL.createObjectURL(imageBlob);
          nextImages.push(imageUrl);
          page.cleanup();
          canvas.width = 0;
          canvas.height = 0;
        }

        if (cancelled) {
          revokeUrls(nextImages);
          return;
        }

        imageUrlsRef.current = nextImages;
        setPageImages(nextImages);
      } catch (renderError) {
        if (!cancelled) {
          setError('Die PDF-Vorschau konnte auf diesem Gerät nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      revokeUrls(imageUrlsRef.current);
      imageUrlsRef.current = [];
    };
  }, [pdfBlob]);

  if (!pdfBlob) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/90 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">{title}</span>
          {badgeText ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
              {badgeText}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onPrint} className="gap-1.5 rounded-xl">
            <Printer className="h-4 w-4" />
            Drucken / Speichern
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} className="rounded-xl">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p>Mehrseitige Vorschau wird geladen…</p>
          </div>
        ) : error ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-border bg-card px-5 py-6 text-center shadow-sm">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium">Vorschau aktuell nicht verfügbar</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {pageImages.map((pageImage, index) => (
              <div key={pageImage} className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <img
                  src={pageImage}
                  alt={`Protokoll Seite ${index + 1}`}
                  className="h-auto w-full"
                  loading="lazy"
                />
                {watermarkText ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                    <div
                      className="select-none whitespace-nowrap text-2xl font-black text-destructive/15 sm:text-4xl"
                      style={{
                        letterSpacing: '0.05em',
                        textShadow: '0 0 20px hsl(var(--destructive) / 0.1)',
                        transform: 'rotate(-35deg)',
                      }}
                    >
                      {watermarkText}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};