import { motion } from 'framer-motion';
import { MapPin, AlertTriangle, Euro, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHandover } from '@/context/HandoverContext';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const Step11DefectsList = () => {
  const { data, setCurrentStep } = useHandover();
  const { isMoveIn } = useTransactionLabels();
  const totalCost = data.findings.reduce((sum, f) => sum + f.recommendedWithholding, 0);

  return (
    <div className="min-h-[80vh] flex flex-col items-center px-4 py-8">
      <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-center">
        {isMoveIn ? 'Zustandsdokumentation' : 'Mängelübersicht'}
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-muted-foreground text-center mb-6 text-sm">
        {isMoveIn ? 'Alle dokumentierten Zustände bei Einzug' : 'Alle dokumentierten Mängel aus der Beweissicherung'}
      </motion.p>

      <div className="w-full max-w-md space-y-4">
        {data.findings.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <p className="font-semibold">{isMoveIn ? 'Keine Befunde dokumentiert' : 'Keine Mängel erfasst'}</p>
            <p className="text-sm text-muted-foreground mt-1">{isMoveIn ? 'Es wurden keine Befunde bei der Zustandsdokumentation erfasst.' : 'Es wurden keine Mängel in der Beweissicherung dokumentiert.'}</p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Raum</TableHead>
                  <TableHead className="text-xs">Schaden</TableHead>
                  <TableHead className="text-xs">Material</TableHead>
                  <TableHead className="text-xs text-right">Kosten</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.findings.map((f, i) => (
                  <motion.tr key={f.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-destructive" />
                        {f.room}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{f.damageType}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.material}</TableCell>
                    <TableCell className="text-sm text-right font-semibold">
                      {f.recommendedWithholding > 0 ? `${f.recommendedWithholding} €` : '–'}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>

            <div className="p-4 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold">Gesamtkosten Mängel</span>
              </div>
              <div className="flex items-center gap-1">
                <Euro className="w-4 h-4 text-primary" />
                <span className="text-lg font-bold text-primary">{totalCost} €</span>
              </div>
            </div>
          </motion.div>
        )}

        {data.findings.map((f, i) => (
          <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
            className="glass-card rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{f.room} – {f.material}</span>
              <span className="text-xs font-mono text-muted-foreground">{f.bghReference}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{f.description}</p>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Zeitwert-Abzug: {f.timeValueDeduction}%</span>
              <span className="font-semibold text-primary">{f.recommendedWithholding > 0 ? `${f.recommendedWithholding} € Einbehalt` : 'Kein Einbehalt'}</span>
            </div>
          </motion.div>
        ))}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Button onClick={() => setCurrentStep(isMoveIn ? 13 : 12)} className="w-full h-12 rounded-2xl font-semibold" size="lg">
            {isMoveIn ? 'Weiter zur Finalisierung' : 'Weiter zur Kautionsberechnung'}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
