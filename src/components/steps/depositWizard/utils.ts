/**
 * Amtliche Durchschnittszinssätze (Spareinlagen 3-monatige Kündigungsfrist)
 * Quelle: Deutsche Bundesbank – Zinsstatistik
 */
export const BUNDESBANK_RATES: { year: number; rate: number }[] = [
  { year: 2000, rate: 1.25 },
  { year: 2001, rate: 1.19 },
  { year: 2002, rate: 1.02 },
  { year: 2003, rate: 1.48 },
  { year: 2004, rate: 2.13 },
  { year: 2005, rate: 2.05 },
  { year: 2006, rate: 2.08 },
  { year: 2007, rate: 2.38 },
  { year: 2008, rate: 2.52 },
  { year: 2009, rate: 1.83 },
  { year: 2010, rate: 1.43 },
  { year: 2011, rate: 1.52 },
  { year: 2012, rate: 1.33 },
  { year: 2013, rate: 0.99 },
  { year: 2014, rate: 0.77 },
  { year: 2015, rate: 0.45 },
  { year: 2016, rate: 0.29 },
  { year: 2017, rate: 0.20 },
  { year: 2018, rate: 0.16 },
  { year: 2019, rate: 0.13 },
  { year: 2020, rate: 0.10 },
  { year: 2021, rate: 0.09 },
  { year: 2022, rate: 0.09 },
  { year: 2023, rate: 0.41 },
  { year: 2024, rate: 0.74 },
  { year: 2025, rate: 0.69 },
  { year: 2026, rate: 0.69 },
];

export function getBundesbankRate(year: number): number {
  const entry = BUNDESBANK_RATES.find(r => r.year === year);
  if (entry) return entry.rate;
  const sorted = [...BUNDESBANK_RATES].sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year));
  return sorted[0]?.rate ?? 0.5;
}

export function getWeightedAverageRate(startDate: Date, endDate: Date): number {
  if (startDate >= endDate) return 0;
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (totalDays <= 0) return 0;
  let weightedSum = 0;
  let current = new Date(startDate);
  while (current < endDate) {
    const year = current.getFullYear();
    const rate = getBundesbankRate(year);
    const yearEnd = new Date(year + 1, 0, 1);
    const periodEnd = yearEnd < endDate ? yearEnd : endDate;
    const periodDays = Math.floor((periodEnd.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    weightedSum += rate * periodDays;
    current = periodEnd;
  }
  return weightedSum / totalDays;
}

export interface InterestBreakdown {
  year: number;
  rate: number;
  days: number;
  interest: number;
  capitalAfter: number;
}

export interface CompoundResult {
  interest: number;
  days: number;
  breakdown: InterestBreakdown[];
}

export function calcCompoundInterest(amount: number, startDateStr: string, endDate: Date = new Date()): CompoundResult {
  if (!amount || !startDateStr) return { interest: 0, days: 0, breakdown: [] };
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return { interest: 0, days: 0, breakdown: [] };
  if (start >= endDate) return { interest: 0, days: 0, breakdown: [] };
  const totalDays = Math.floor((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  let capital = amount;
  let current = new Date(start);
  const breakdown: InterestBreakdown[] = [];
  while (current < endDate) {
    const year = current.getFullYear();
    const rate = getBundesbankRate(year);
    const yearEnd = new Date(year + 1, 0, 1);
    const periodEnd = yearEnd < endDate ? yearEnd : endDate;
    const periodDays = Math.floor((periodEnd.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    const periodInterest = capital * (rate / 100) * (periodDays / 365);
    if (yearEnd <= endDate) capital += periodInterest;
    breakdown.push({ year, rate, days: periodDays, interest: periodInterest, capitalAfter: capital + (yearEnd > endDate ? periodInterest : 0) });
    current = periodEnd;
  }
  const sumInterest = breakdown.reduce((s, b) => s + b.interest, 0);
  return { interest: sumInterest, days: totalDays, breakdown };
}

export interface InstallmentRateResult {
  amount: number;
  date: string;
  days: number;
  interest: number;
  breakdown: InterestBreakdown[];
}

export function calcInstallmentInterest(
  totalDeposit: number,
  dates: [string, string, string]
): { perRate: InstallmentRateResult[]; totalInterest: number } {
  const rateAmount = totalDeposit / 3;
  const now = new Date();
  const perRate = dates.map((dateStr) => {
    const result = calcCompoundInterest(rateAmount, dateStr, now);
    return { amount: rateAmount, date: dateStr, days: result.days, interest: result.interest, breakdown: result.breakdown };
  });
  return { perRate, totalInterest: perRate.reduce((s, r) => s + r.interest, 0) };
}

export function daysBetween(dateStr: string): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  if (isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function calcPaymentDeadline(weeksFromNow: number = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + weeksFromNow * 7);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const AI_COST_ESTIMATES: Record<string, number> = {
  'Kratzer': 80, 'Loch': 120, 'Riss': 150, 'Fleck': 60,
  'Schimmel': 350, 'Wasserschaden': 500, 'Bohrloch': 25,
  'Abplatzung': 90, 'Verfärbung': 70, 'Bruch': 200,
};

export const LEGAL_REASONING: Record<string, string> = {
  'Kratzer': 'Mieterschuld gem. § 280 Abs. 1 BGB – übermäßige Abnutzung, nicht durch normalen Gebrauch (§ 538 BGB) gedeckt.',
  'Loch': 'Substanzbeschädigung gem. § 280 BGB i.V.m. § 241 Abs. 2 BGB – Schadensersatzpflicht wegen Verletzung der Obhutspflicht.',
  'Riss': 'Strukturelle Beschädigung – Mieterschuld bei Nachweis vertragswidrigen Gebrauchs (§ 538 BGB Umkehrschluss).',
  'Fleck': 'Bewertung: Ggf. normale Gebrauchsspur (§ 538 BGB). Abzug nur bei nachweislich unsachgemäßem Verhalten.',
  'Schimmel': 'Einzelfallprüfung nötig: Baumangel (§ 536 BGB) vs. falsches Lüftungsverhalten (§ 280 BGB). BGH VIII ZR 182/06.',
  'Wasserschaden': 'Mieterhaftung nur bei schuldhafter Verursachung (§ 280 BGB). Beweislast liegt beim Vermieter (BGH VIII ZR 195/03).',
  'Bohrloch': 'Vertragsmäßiger Gebrauch gem. § 535 BGB – bis zu einer angemessenen Anzahl zulässig (BGH VIII ZR 10/92). Nur Rückbau geschuldet.',
  'Abplatzung': 'Mieterschuld bei mechanischer Einwirkung gem. § 280 BGB. Alterungsbedingter Verschleiß ist ausgenommen (§ 538 BGB).',
  'Verfärbung': 'Normale Abnutzung gem. § 538 BGB, sofern keine unsachgemäße Einwirkung vorliegt. Abzug nur bei Nachweispflicht.',
  'Bruch': 'Schadensersatz gem. § 280 Abs. 1 BGB wegen Pflichtverletzung. Zeitwertabzug je nach Alter der Mietsache.',
};

export function getAiEstimate(damageType: string): number {
  const lower = damageType.toLowerCase();
  for (const [key, val] of Object.entries(AI_COST_ESTIMATES)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return 100;
}

export function getLegalReasoning(damageType: string): string {
  const lower = damageType.toLowerCase();
  for (const [key, val] of Object.entries(LEGAL_REASONING)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return 'Schadensersatzpflicht gem. § 280 Abs. 1 BGB – Prüfung auf vertragswidrigen Gebrauch erforderlich.';
}
