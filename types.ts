
export interface Intervention {
  id: string;
  date: Date;
  week: number; // Calculated from Date, not read from file
  month: number;
  department: string;
  agency: string;
  technician: string;
  validator: string;
  status: string; // Simplified: OK, KO, NC
  validationStatus: string; // Detailed: CONF, COR PND, COR APR, NC, KO...
  installType: string; // From CA column or Comment
  contactStatus: 'Avec Contact' | 'Sans Contact';
  ncReason?: string; // e.g., "Suspicion Fraude", "Photo Floue"
  isIgnored: boolean; // True if no comments/parsing failed
  ignoreReason: 'VALID' | 'EMPTY' | 'TAG_ABSENT' | 'TAG_MISPLACED'; // Categorization of ignored lines
  originalRow: any;
  // Fields extracted from comments for export
  extractedFields: Record<string, string>;
}

export interface CallData {
  agency: string;
  offered: number;   // Appels Reçus (Offre)
  answered: number;  // Appels Traités (Réponse)
  abandoned: number; // Appels Abandonnés (Abandon)
  shortAbandoned: number; // < 10s
  qs: number;        // QS (calculé ou lu)
  qsNet: number;     // QS Net (hors abd court)
  dmr: number;       // ASA (seconds)
  dmt: number;       // Moy. traitem (seconds)
  mea: number;       // Temps moyen MEA (seconds)
}

export interface TechStat {
  tech: string;
  totalInterventions: number;
  targetCount: number; // Count of the specific metric (Sans Contact or NC)
  individualRate: number; // target / totalInterventions
  globalRate: number; // target / agencyTotalTarget
}

export interface NcSansContactStat {
  tech: string;
  countNC: number;
  rateNC: number;
  topReasons: string[]; // Motifs of NCs
  countOK: number; // CONF + COR
  rateOK: number;
  total: number;
}

export interface CorrectionStat {
  installType: string;
  countPnd: number;
  motifsPnd: string[];
  countApr: number;
  motifsApr: string[];
  totalCor: number;
}

export interface IgnoredLineStat {
  validator: string;
  tagAbsent: number;
  tagMisplaced: number;
  emptyLine: number;
  total: number;
}

export interface ValidatorPerformance {
  validator: string;
  totalCases: number;
  withContact: number;
  withoutContact: number;
  typesBreakdown: Record<string, number>;
}

export interface TagNcStat {
  tagName: string;
  totalNC: number;
  reasons: string[]; // Formatted strings like "Illisible (1)", "Absent (3)"
}

export interface AgencyStats {
  agencyName: string;
  totalInterventions: number;

  // CALL STATS (Optional)
  callStats?: CallData;

  // Table 0: General Contact Stats
  byContact: {
    withContact: number;
    withoutContact: number;
  };
  
  // Table 1: Install Types
  byInstallType: Record<string, { with: number; without: number; total: number }>;
  
  // Table 2: Tech Sans Contact
  techSansContactStats: TechStat[];
  totalSansContact: number;
  nbTechsWithSansContact: number; // New

  // Table 3: Tech NC
  techNcStats: TechStat[];
  totalNC: number;
  nbTechsWithNc: number; // New

  // Table 4: NC detected per Tech (Sans Contact subset)
  ncSansContactDetails: NcSansContactStat[];

  // Table 5: Corrections
  correctionStats: CorrectionStat[];
  totalCorrections: number; // New
  nbTechsWithCorrection: number; // New

  // Table 6: Ignored
  ignoredLines: IgnoredLineStat[];
}

export type DepartmentMapping = Record<string, string>;