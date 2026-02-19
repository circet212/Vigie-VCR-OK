import { getWeek, getMonth, isValid } from 'date-fns';
import parse from 'date-fns/parse';
import { DEPARTMENT_TO_AGENCY, COLUMN_MATCHERS, EXPORT_COLUMNS_ORDER } from '../constants';
import { Intervention, AgencyStats, CallData, IgnoredLineStat, ValidatorPerformance, TagNcStat } from '../types';

// Helper to normalize strings (remove accents, lowercase)
const normalizeStr = (str: string) => 
  str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

// Robust Key Finder
const findKey = (row: any, matchers: string[]) => {
  const keys = Object.keys(row);
  return keys.find(key => {
      const kLow = key.toLowerCase();
      const kNorm = normalizeStr(key);
      
      return matchers.some(m => {
          const mLow = m.toLowerCase();
          const mNorm = normalizeStr(m);
          return kLow.includes(mLow) || kNorm.includes(mNorm);
      });
  });
};

// --- CONSTANTS FOR CALL PROCESSING ---
const CALL_MATCHERS = {
    queueName: ['nom de la file', 'nom file', 'queue name'],
    offered: ['offre', 'appels recus', 'reçus', 'recus', 'presentes'],
    answered: ['reponse', 'réponse', 'rÃ©ponse', 'appels traites', 'traités', 'traites', 'servis'],
    abandoned: ['abandon', 'perdus'],
    short: ['abandons courts', 'court', '< 10', 'dissuade'],
    dmr: ['asa', 'vitesse', 'dmr', 'temps de reponse'],
    dmt: ['moy. traitement', 'dmt', 'duree moy'],
    mea: ['temps moyen de mise en attente', 'mise en attente', 'mea']
};

// --- ROBUST PARSING HELPERS ---

const parseFlexibleDuration = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') {
        if (val < 100) return Math.round(val * 86400); // Excel fraction
        if (val > 5000) return Math.round(val / 1000); // Milliseconds
        return Math.round(val); // Seconds
    }
    const strVal = String(val).trim();
    if (strVal === '-' || strVal === '') return 0;
    if (/[hms]/.test(strVal) && !/:/.test(strVal)) {
        let totalSeconds = 0;
        const h = strVal.match(/(\d+)\s*h/i);
        const m = strVal.match(/(\d+)\s*m/i);
        const s = strVal.match(/(\d+)\s*s/i);
        if (h) totalSeconds += parseInt(h[1]) * 3600;
        if (m) totalSeconds += parseInt(m[1]) * 60;
        if (s) totalSeconds += parseInt(s[1]);
        return totalSeconds;
    }
    if (strVal.includes(':')) {
        const parts = strVal.split(':').map(p => parseFloat(p));
        if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
        if (parts.length === 2) return (parts[0] * 60) + parts[1];
    }
    const floatVal = parseFloat(strVal.replace(',', '.'));
    if (!isNaN(floatVal)) {
        if (floatVal < 1) return Math.round(floatVal * 86400);
        return Math.round(floatVal);
    }
    return 0;
};

const parseFlexibleNumber = (val: any, isRatio: boolean = false): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') {
        if (isRatio && val <= 1 && val > 0) return val * 100; 
        return val;
    }
    let strVal = String(val).replace(',', '.').replace('%', '').trim();
    if (strVal === '-') return 0;
    const floatVal = parseFloat(strVal);
    if (isNaN(floatVal)) return 0;
    if (isRatio && floatVal <= 1 && floatVal > 0 && !String(val).includes('%')) {
        return floatVal * 100;
    }
    return floatVal;
};

// --- NEW INTERVENTION PARSING LOGIC ---

/**
 * Parses the encoded comment string: [[Val1\Val2\Val3...]]
 */
const parseCommentData = (raw: string): Record<string, string> => {
    if (!raw) return {};
    
    // Look for content between [[ and ]] - updated to handle newlines with [\s\S]*?
    const match = raw.match(/\[\[([\s\S]*?)\]\]/);
    if (!match) return {}; // Return empty if format doesn't match

    const content = match[1];
    // Split by backslash '\'
    const values = content.split('\\');
    
    const data: Record<string, string> = {};
    
    // Map values to headers based on strict order in EXPORT_COLUMNS_ORDER
    EXPORT_COLUMNS_ORDER.forEach((header, index) => {
        if (values[index] !== undefined) {
            data[header] = values[index].trim();
        } else {
            data[header] = 'NA';
        }
    });

    return data;
};

/**
 * Extracts specific reason for NC or Correction.
 */
const identifyNCReason = (parsedData: Record<string, string>, isCorrectionContext: boolean = false): string | undefined => {
    const IGNORED_COLS = ['TYPE', 'STATUT VALIDATION', 'CONTACT', 'CHGT PRESTA', 'VALIDATION ROP', 'CHGT DESSERTE'];
    const OK_VALUES = ['1', 'OK', 'NA', 'RAS', 'CONFORME', 'YES', 'OUI', '', '-', 'N/A', '0 (RAS)', '1 (RAS)', '2'];

    const formatReason = (key: string, val: string) => {
        const reasonMatch = val.match(/\((.*?)\)/);
        if (reasonMatch && reasonMatch[1] && reasonMatch[1].trim().length > 0) {
            const comment = reasonMatch[1].trim();
            if (['RAS', 'OK', 'CONFORME', 'NA'].includes(comment.toUpperCase())) return key;
            return `${key} (${comment})`;
        }
        return key;
    };

    for (const [key, val] of Object.entries(parsedData)) {
        if (IGNORED_COLS.includes(key)) continue;
        const vUpper = val.toUpperCase().trim();
        
        if (vUpper.startsWith('COR') || vUpper.startsWith('0') || vUpper === 'NC' || vUpper === 'KO') {
            return formatReason(key, val);
        }
    }

    if (isCorrectionContext) {
        for (const [key, val] of Object.entries(parsedData)) {
            if (IGNORED_COLS.includes(key)) continue;
            const vClean = val.trim();
            const vUpper = vClean.toUpperCase();
            if (vClean.length > 0 && !OK_VALUES.includes(vUpper)) {
                 return formatReason(key, val);
            }
        }
    }

    if (parsedData['SUSPICION FRAUDE'] && !OK_VALUES.includes(parsedData['SUSPICION FRAUDE'].toUpperCase())) return 'SUSPICION FRAUDE';
    if (parsedData['RACC SAUVAGE'] && !OK_VALUES.includes(parsedData['RACC SAUVAGE'].toUpperCase())) return 'RACC SAUVAGE';

    return undefined;
};

export const normalizeData = (rawData: any[]): Intervention[] => {
  if (rawData.length === 0) return [];
  const firstRow = rawData[0];
  const map: Record<string, string | undefined> = {
    id: findKey(firstRow, COLUMN_MATCHERS.id),
    date: findKey(firstRow, COLUMN_MATCHERS.date),
    dept: findKey(firstRow, COLUMN_MATCHERS.department),
    tech: findKey(firstRow, COLUMN_MATCHERS.technician),
    comments: findKey(firstRow, COLUMN_MATCHERS.comments),
    validator: findKey(firstRow, COLUMN_MATCHERS.validator),
    installTypeCA: findKey(firstRow, COLUMN_MATCHERS.installTypeCA),
  };

  return rawData.map((row, index) => {
    const id = map.id ? String(row[map.id]) : `ROW-${index}`;
    let date = new Date();
    const dateVal = map.date ? row[map.date] : null;
    if (dateVal) {
        if (typeof dateVal === 'number') {
            date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
        } else if (typeof dateVal === 'string') {
             let cleanDate = dateVal.trim();
             const d1 = parse(cleanDate, 'dd/MM/yyyy HH:mm:ss', new Date());
             const d2 = parse(cleanDate, 'dd/MM/yyyy', new Date());
             const d3 = parse(cleanDate, 'yyyy-MM-dd', new Date());
             if (isValid(d1)) date = d1;
             else if (isValid(d2)) date = d2;
             else if (isValid(d3)) date = d3;
             else {
                 const d4 = new Date(cleanDate);
                 if (isValid(d4)) date = d4;
             }
        }
    }

    let dept = map.dept ? String(row[map.dept]).trim() : '99';
    const deptMatch = dept.match(/(\d+)/);
    if (deptMatch) dept = deptMatch[0];
    let agency = 'Unknown';
    const padDept = dept.padStart(2, '0');
    const unpadDept = String(parseInt(dept, 10));
    if (DEPARTMENT_TO_AGENCY[dept]) agency = DEPARTMENT_TO_AGENCY[dept];
    else if (DEPARTMENT_TO_AGENCY[padDept]) agency = DEPARTMENT_TO_AGENCY[padDept];
    else if (DEPARTMENT_TO_AGENCY[unpadDept]) agency = DEPARTMENT_TO_AGENCY[unpadDept];

    const technician = map.tech ? String(row[map.tech]).trim() : 'Unknown';
    const validator = map.validator ? String(row[map.validator]).trim() : 'System';
    const rawComment = map.comments ? String(row[map.comments]).trim() : '';
    
    // STRICT FORMAT VALIDATION LOGIC
    let ignoreReason: 'VALID' | 'EMPTY' | 'TAG_ABSENT' | 'TAG_MISPLACED' = 'VALID';
    let parsedData: Record<string, string> = {};

    if (rawComment === '') {
        ignoreReason = 'EMPTY';
    } else if (rawComment.includes('[[')) {
        parsedData = parseCommentData(rawComment);
        if (rawComment.startsWith('[[')) {
             if (Object.keys(parsedData).length === 0) ignoreReason = 'TAG_ABSENT';
             else ignoreReason = 'VALID';
        } else {
             ignoreReason = 'TAG_MISPLACED';
        }
    } else {
        ignoreReason = 'TAG_ABSENT';
    }

    const isIgnored = ignoreReason !== 'VALID';
    let installType = 'Inconnu';
    if (map.installTypeCA && row[map.installTypeCA]) {
        const caValue = String(row[map.installTypeCA]).trim();
        if (caValue.length > 0) installType = caValue;
    }
    if (installType === 'Inconnu' && parsedData['TYPE'] && parsedData['TYPE'] !== 'NA') {
        installType = parsedData['TYPE'];
    }

    let contactStatus: 'Avec Contact' | 'Sans Contact' = 'Avec Contact';
    const contactVal = parsedData['CONTACT'] ? parsedData['CONTACT'].toUpperCase() : '';
    if (contactVal.includes('NON') || contactVal.includes('SANS') || contactVal === '0') {
        contactStatus = 'Sans Contact';
    }

    const validationStatus = parsedData['STATUT VALIDATION'] ? parsedData['STATUT VALIDATION'].toUpperCase() : 'INCONNU';
    let status = 'INCONNU';
    if (validationStatus.includes('CONF')) status = 'OK';
    else if (validationStatus.includes('COR')) status = 'OK';
    else if (validationStatus.includes('NC') || validationStatus.includes('KO')) status = 'NC';

    let ncReason = undefined;
    if (status === 'NC' || validationStatus.includes('COR')) {
        ncReason = identifyNCReason(parsedData, validationStatus.includes('COR'));
    }

    const extractedFields: Record<string, string> = {};
    EXPORT_COLUMNS_ORDER.forEach(col => {
        extractedFields[col] = parsedData[col] || '';
    });

    return {
      id,
      date,
      week: getWeek(date, { weekStartsOn: 1 }),
      month: getMonth(date) + 1,
      department: dept,
      agency,
      technician,
      validator,
      status,
      validationStatus,
      installType,
      contactStatus,
      ncReason,
      isIgnored,
      ignoreReason,
      originalRow: row,
      extractedFields
    };
  }).filter(i => i.agency !== 'Unknown' || i.validator !== 'System');
};

export const normalizeCallData = (rawData: any[], selectedAgency: string = 'INE'): CallData[] => {
    // ... (Keep existing call processing logic identical)
    if (rawData.length === 0) return [];
    
    const firstRow = rawData[0];
    const colQueue = findKey(firstRow, CALL_MATCHERS.queueName);
    const colOffre = findKey(firstRow, CALL_MATCHERS.offered);
    const colReponse = findKey(firstRow, CALL_MATCHERS.answered);
    const colAbandon = findKey(firstRow, CALL_MATCHERS.abandoned);
    const colCourt = findKey(firstRow, CALL_MATCHERS.short);
    const colDmr = findKey(firstRow, CALL_MATCHERS.dmr);
    const colDmt = findKey(firstRow, CALL_MATCHERS.dmt);
    const colMea = findKey(firstRow, CALL_MATCHERS.mea);

    let totalOffered = 0;
    let totalAnswered = 0;
    let totalAbandon = 0;
    let totalShort = 0;
    let totalDmrWeighted = 0; 
    let totalDmtWeighted = 0;
    let totalMeaWeighted = 0;
    let countRows = 0;
    const selectedAgencyUpper = selectedAgency.toUpperCase();

    rawData.forEach(row => {
        if (colQueue && selectedAgency) {
            const queueName = String(row[colQueue]).toUpperCase();
            let isAgencyMatch = false;
            
            // Special handling for Agencies sharing naming conventions
            if (selectedAgencyUpper === 'PACA' || selectedAgencyUpper === 'CORSE') {
                if (queueName.includes('PACA') || queueName.includes('CORSE')) isAgencyMatch = true;
            } else if (selectedAgencyUpper === 'SO') {
                // SO also accepts MED
                if (queueName.includes('SO') || queueName.includes('MED')) isAgencyMatch = true;
            } else {
                if (queueName.includes(selectedAgencyUpper)) isAgencyMatch = true;
            }
            if (!isAgencyMatch) return;
        }
        
        const off = parseFlexibleNumber(row[colOffre!]);
        const ans = parseFlexibleNumber(row[colReponse!]);
        const abd = parseFlexibleNumber(row[colAbandon!]);
        const sh = parseFlexibleNumber(row[colCourt!]);
        const dmr = parseFlexibleDuration(row[colDmr!]);
        const dmt = parseFlexibleDuration(row[colDmt!]);
        const mea = parseFlexibleDuration(row[colMea!]);

        totalOffered += off;
        totalAnswered += ans;
        totalAbandon += abd;
        totalShort += sh;

        const weight = ans > 0 ? ans : (off > 0 ? off : 1);
        totalDmrWeighted += dmr * weight;
        totalDmtWeighted += dmt * weight;
        totalMeaWeighted += mea * weight;
        countRows++;
    });

    if (totalOffered === 0 && countRows === 0) return [];
    const qs = totalOffered > 0 ? (totalAnswered / totalOffered) * 100 : 0;
    const validOffered = Math.max(0, totalOffered - totalShort);
    const qsNet = validOffered > 0 ? (totalAnswered / validOffered) * 100 : 0;
    const totalWeight = totalAnswered > 0 ? totalAnswered : (totalOffered > 0 ? totalOffered : countRows);
    
    return [{
        agency: selectedAgency,
        offered: totalOffered,
        answered: totalAnswered,
        abandoned: totalAbandon,
        shortAbandoned: totalShort,
        qs,
        qsNet,
        dmr: totalWeight > 0 ? totalDmrWeighted / totalWeight : 0,
        dmt: totalWeight > 0 ? totalDmtWeighted / totalWeight : 0,
        mea: totalWeight > 0 ? totalMeaWeighted / totalWeight : 0,
    }];
};

// ... (Keep getCallFileDebugInfo identical)
export const getCallFileDebugInfo = (rawData: any[], selectedAgency: string) => {
    if (!rawData || rawData.length === 0) return { error: "Fichier vide" };
    const firstRow = rawData[0];
    const columnsFound: Record<string, string | undefined> = {};
    const columnsMissing: string[] = [];
    Object.entries(CALL_MATCHERS).forEach(([key, matchers]) => {
        const found = findKey(firstRow, matchers);
        if (found) columnsFound[key] = found;
        else columnsMissing.push(key);
    });
    const colQueue = columnsFound.queueName;
    let matchingRows = 0;
    let agencyMismatchCount = 0;
    const firstFiveRows = rawData.slice(0, 5).map(r => ({
        queue: colQueue ? r[colQueue] : 'N/A',
        offered: columnsFound.offered ? r[columnsFound.offered] : 'N/A',
        matched: false,
        reason: ''
    }));
    const selectedAgencyUpper = selectedAgency.toUpperCase();
    rawData.forEach((row, idx) => {
        let isAgencyMatch = true;
        if (colQueue && selectedAgency) {
            const q = String(row[colQueue]).toUpperCase();
            let strictMatch = false;
            
            if (selectedAgencyUpper === 'PACA' || selectedAgencyUpper === 'CORSE') {
                if (q.includes('PACA') || q.includes('CORSE')) strictMatch = true;
            } else if (selectedAgencyUpper === 'SO') {
                if (q.includes('SO') || q.includes('MED')) strictMatch = true;
            } else {
                if (q.includes(selectedAgencyUpper)) strictMatch = true;
            }

            if (!strictMatch) isAgencyMatch = false;
        }
        if (!isAgencyMatch) agencyMismatchCount++;
        if (isAgencyMatch) matchingRows++;
        if (idx < 5) {
            firstFiveRows[idx].matched = isAgencyMatch;
            if (!isAgencyMatch) firstFiveRows[idx].reason = `Agence '${row[colQueue]}' != '${selectedAgency}' (PACA/CORSE/SO handled)`;
            else firstFiveRows[idx].reason = 'OK';
        }
    });
    return {
        totalRows: rawData.length,
        headers: Object.keys(firstRow),
        columnsFound,
        columnsMissing,
        selectedAgency,
        matchingRows,
        agencyMismatchCount,
        sampleData: firstFiveRows
    };
};

export const calculateGlobalValidatorStats = (data: Intervention[]): { stats: ValidatorPerformance[], allTypes: string[] } => {
    // ... (Keep identical)
    const map = new Map<string, ValidatorPerformance>();
    const typesSet = new Set<string>();
    data.forEach(item => {
        if (!map.has(item.validator)) {
            map.set(item.validator, { validator: item.validator, totalCases: 0, withContact: 0, withoutContact: 0, typesBreakdown: {} });
        }
        const stat = map.get(item.validator)!;
        stat.totalCases++;
        if (item.contactStatus === 'Avec Contact') stat.withContact++;
        else stat.withoutContact++;
        let type = 'Non Tagué';
        if (item.extractedFields && item.extractedFields['TYPE'] && item.extractedFields['TYPE'] !== 'NA' && item.extractedFields['TYPE'] !== '') {
            type = item.extractedFields['TYPE'];
        }
        if (!stat.typesBreakdown[type]) stat.typesBreakdown[type] = 0;
        stat.typesBreakdown[type]++;
        typesSet.add(type);
    });
    return {
        stats: Array.from(map.values()).sort((a, b) => b.totalCases - a.totalCases),
        allTypes: Array.from(typesSet).sort()
    };
};

export const calculateGlobalIgnoredStats = (data: Intervention[]): IgnoredLineStat[] => {
    // ... (Keep identical)
    const map = new Map<string, IgnoredLineStat>();
    data.forEach(item => {
        if (item.isIgnored) {
            if (!map.has(item.validator)) {
                map.set(item.validator, { validator: item.validator, tagAbsent: 0, tagMisplaced: 0, emptyLine: 0, total: 0 });
            }
            const stat = map.get(item.validator)!;
            stat.total++;
            if (item.ignoreReason === 'EMPTY') stat.emptyLine++;
            else if (item.ignoreReason === 'TAG_ABSENT') stat.tagAbsent++;
            else if (item.ignoreReason === 'TAG_MISPLACED') stat.tagMisplaced++;
        }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

// NEW FUNCTION: Calculate Top 5 NC by Tag
export const calculateGlobalTagNCs = (data: Intervention[], selectedAgency?: string): TagNcStat[] => {
    const map = new Map<string, { count: number, reasonsMap: Map<string, number> }>();
    
    // Specific Logic provided by user:
    // NC if 0. Exception: INC and VOISIN PERTURBÉ where NC if OUI.
    const EXCEPTION_TAGS = ['INC', 'VOISIN PERTURBÉ', 'VOISIN PERTURBE']; 
    
    data.forEach(item => {
        if (item.isIgnored) return;
        if (selectedAgency && item.agency !== selectedAgency) return;

        Object.entries(item.extractedFields).forEach(([tagName, val]) => {
            const upperVal = val.trim().toUpperCase();
            if (!upperVal || upperVal === 'NA' || upperVal === '-') return;

            let isNC = false;
            let comment = '';

            // Check Exceptions
            if (EXCEPTION_TAGS.includes(tagName)) {
                if (['OUI', 'YES', '1'].includes(upperVal)) {
                    isNC = true;
                    // Usually no comment in parenthesis for OUI/NON tags, but check anyway
                    const match = val.match(/\((.*?)\)/);
                    if (match) comment = match[1].trim();
                }
            } else {
                // Standard: 0 means NC
                if (upperVal.startsWith('0')) {
                    isNC = true;
                    const match = val.match(/\((.*?)\)/);
                    if (match) comment = match[1].trim();
                }
            }

            if (isNC) {
                if (!map.has(tagName)) {
                    map.set(tagName, { count: 0, reasonsMap: new Map() });
                }
                const entry = map.get(tagName)!;
                entry.count++;
                
                if (comment) {
                    // Clean comment
                    const cleanComment = comment.charAt(0).toUpperCase() + comment.slice(1).toLowerCase();
                    entry.reasonsMap.set(cleanComment, (entry.reasonsMap.get(cleanComment) || 0) + 1);
                }
            }
        });
    });

    const result: TagNcStat[] = [];
    map.forEach((value, key) => {
        const sortedReasons = Array.from(value.reasonsMap.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by freq
            .map(([reason, count]) => `${reason} (${count})`);
        
        result.push({
            tagName: key,
            totalNC: value.count,
            reasons: sortedReasons
        });
    });

    return result.sort((a, b) => b.totalNC - a.totalNC).slice(0, 5); // Top 5
};

export const aggregateStats = (data: Intervention[], agencyName: string, callDataRaw?: any[]): AgencyStats => {
    // ... (Keep identical)
  const filtered = data.filter(d => d.agency === agencyName);

  let callStats: CallData | undefined = undefined;
  if (callDataRaw && callDataRaw.length > 0) {
      const normalizedCalls = normalizeCallData(callDataRaw, agencyName);
      if (normalizedCalls.length > 0) {
          callStats = normalizedCalls[0];
      }
  }

  const stats: AgencyStats = {
    agencyName,
    totalInterventions: 0,
    callStats, 
    byContact: { withContact: 0, withoutContact: 0 },
    byInstallType: {},
    techSansContactStats: [],
    totalSansContact: 0,
    techNcStats: [],
    totalNC: 0,
    nbTechsWithNc: 0,
    nbTechsWithSansContact: 0,
    ncSansContactDetails: [],
    correctionStats: [],
    totalCorrections: 0,
    nbTechsWithCorrection: 0,
    ignoredLines: []
  };

  const ignoredStatsMap = new Map<string, IgnoredLineStat>();
  const techMap = new Map<string, { total: number; sansContact: number; nc: number; sansContactNc: number; sansContactOk: number; ncReasons: Set<string>; correction: number }>();
  const installTypeMap = new Map<string, { with: number; without: number; total: number }>();
  const correctionMap = new Map<string, { pnd: number; pndReasons: Set<string>; apr: number; aprReasons: Set<string> }>();

  filtered.forEach(item => {
    if (item.isIgnored) {
        if (!ignoredStatsMap.has(item.validator)) {
            ignoredStatsMap.set(item.validator, { validator: item.validator, tagAbsent: 0, tagMisplaced: 0, emptyLine: 0, total: 0 });
        }
        const stat = ignoredStatsMap.get(item.validator)!;
        stat.total++;
        if (item.ignoreReason === 'EMPTY') stat.emptyLine++;
        else if (item.ignoreReason === 'TAG_ABSENT') stat.tagAbsent++;
        else if (item.ignoreReason === 'TAG_MISPLACED') stat.tagMisplaced++;
        return;
    }

    stats.totalInterventions++;

    if (item.contactStatus === 'Avec Contact') stats.byContact.withContact++;
    else stats.byContact.withoutContact++;

    if (!installTypeMap.has(item.installType)) {
        installTypeMap.set(item.installType, { with: 0, without: 0, total: 0 });
    }
    const typeStat = installTypeMap.get(item.installType)!;
    typeStat.total++;
    if (item.contactStatus === 'Avec Contact') typeStat.with++;
    else typeStat.without++;

    if (!techMap.has(item.technician)) {
        techMap.set(item.technician, { total: 0, sansContact: 0, nc: 0, sansContactNc: 0, sansContactOk: 0, ncReasons: new Set(), correction: 0 });
    }
    const tStat = techMap.get(item.technician)!;
    tStat.total++;

    if (item.contactStatus === 'Sans Contact') {
        tStat.sansContact++;
        stats.totalSansContact++;
    }

    const isStrictNC = item.validationStatus.includes('NC') || item.validationStatus.includes('KO');
    if (isStrictNC) {
        tStat.nc++;
        stats.totalNC++;
    }

    const isOk = item.validationStatus.includes('CONF') || item.validationStatus.includes('COR');
    
    if (item.contactStatus === 'Sans Contact') {
        if (isStrictNC) {
            tStat.sansContactNc++;
            if (item.ncReason) tStat.ncReasons.add(item.ncReason);
        }
        else if (isOk) tStat.sansContactOk++;
    }

    const isCorPnd = item.validationStatus.includes('COR PND');
    const isCorApr = item.validationStatus.includes('COR APR');

    if (isCorPnd || isCorApr) {
        stats.totalCorrections++;
        tStat.correction++; 
        
        if (!correctionMap.has(item.installType)) {
            correctionMap.set(item.installType, { pnd: 0, pndReasons: new Set(), apr: 0, aprReasons: new Set() });
        }
        const cStat = correctionMap.get(item.installType)!;
        const reason = item.ncReason || 'Inconnu';

        if (isCorPnd) {
            cStat.pnd++;
            if (reason) cStat.pndReasons.add(reason);
        }
        if (isCorApr) {
            cStat.apr++;
            if (reason) cStat.aprReasons.add(reason);
        }
    }
  });

  stats.byInstallType = Object.fromEntries(installTypeMap);

  const techValues = Array.from(techMap.values());
  stats.nbTechsWithCorrection = techValues.filter(t => t.correction > 0).length;
  stats.nbTechsWithNc = techValues.filter(t => t.nc > 0).length;
  stats.nbTechsWithSansContact = techValues.filter(t => t.sansContact > 0).length;

  stats.techSansContactStats = Array.from(techMap.entries())
    .filter(([_, val]) => val.sansContact > 0)
    .map(([tech, val]) => ({
        tech,
        totalInterventions: val.total,
        targetCount: val.sansContact,
        individualRate: (val.sansContact / val.total) * 100,
        globalRate: stats.totalSansContact > 0 ? (val.sansContact / stats.totalSansContact) * 100 : 0
    }))
    .sort((a, b) => b.targetCount - a.targetCount)
    .slice(0, 10); 

  stats.techNcStats = Array.from(techMap.entries())
    .filter(([_, val]) => val.nc > 0)
    .map(([tech, val]) => ({
        tech,
        totalInterventions: val.total,
        targetCount: val.nc,
        individualRate: (val.nc / val.total) * 100,
        globalRate: stats.totalNC > 0 ? (val.nc / stats.totalNC) * 100 : 0
    }))
    .sort((a, b) => b.targetCount - a.targetCount)
    .slice(0, 10);

  stats.ncSansContactDetails = Array.from(techMap.entries())
    .filter(([_, val]) => val.sansContact > 0)
    .map(([tech, val]) => {
        const totalSubset = val.sansContact; 
        return {
            tech,
            countNC: val.sansContactNc,
            rateNC: totalSubset > 0 ? (val.sansContactNc / totalSubset) * 100 : 0,
            topReasons: Array.from(val.ncReasons),
            countOK: val.sansContactOk,
            rateOK: totalSubset > 0 ? (val.sansContactOk / totalSubset) * 100 : 0,
            total: totalSubset
        };
    })
    .sort((a, b) => b.total - a.total);

  stats.correctionStats = Array.from(correctionMap.entries())
    .map(([type, val]) => ({
        installType: type,
        countPnd: val.pnd,
        motifsPnd: Array.from(val.pndReasons),
        countApr: val.apr,
        motifsApr: Array.from(val.aprReasons),
        totalCor: val.pnd + val.apr
    }))
    .sort((a, b) => b.totalCor - a.totalCor);

  stats.ignoredLines = Array.from(ignoredStatsMap.values())
    .sort((a, b) => b.total - a.total);

  return stats;
};