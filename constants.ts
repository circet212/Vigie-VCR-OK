
import { DepartmentMapping } from './types';

export const DEPARTMENT_TO_AGENCY: DepartmentMapping = {
  // Provided Mapping
  '1': 'CTA', '01': 'CTA',
  '2': 'INE', '02': 'INE',
  '4': 'PACA', '04': 'PACA',
  '5': 'PACA', '05': 'PACA',
  '6': 'PACA', '06': 'PACA',
  '7': 'CTA', '07': 'CTA',
  '8': 'INE', '08': 'INE',
  '10': 'INE',
  '13': 'PACA',
  '16': 'SO',
  '18': 'INE',
  '20': 'Corse', '2A': 'Corse', '2B': 'Corse',
  '21': 'CTA',
  '30': 'SO',
  '31': 'SO',
  '32': 'SO',
  '33': 'SO',
  '34': 'SO',
  '38': 'CTA',
  '39': 'CTA',
  '45': 'INE',
  '46': 'SO',
  '47': 'SO',
  '51': 'INE',
  '52': 'INE',
  '54': 'INE',
  '55': 'INE',
  '57': 'INE',
  '58': 'CTA',
  '59': 'INE',
  '60': 'INE',
  '69': 'CTA',
  '71': 'CTA',
  '73': 'CTA',
  '74': 'CTA',
  '77': 'INE',
  '81': 'SO',
  '82': 'SO',
  '83': 'PACA',
  '87': 'SO',
  '88': 'INE',
  '89': 'INE',
  '93': 'INE',
  '94': 'INE',
};

// Heuristics to find columns in the messy CSV/Excel
export const COLUMN_MATCHERS = {
  id: ['id', 'reference', 'ref', 'number', 'numero'],
  date: ['debut inter', 'u_datedebutinter', 'date_debut', 'planifie'], 
  department: ['departement', 'dept', 'cp', 'zip', 'code_postal', 'u_dpt'],
  technician: ['technicien', 'u_technicien'], 
  comments: ['commentaire 2', 'u_commentaire_2', 'comments', 'resume'],
  validator: ['closed by', 'ferme par', 'u_closed_by', 'cloture par', 'validateur'],
  // Updated to include specific requested column name
  installTypeCA: ['type d\'installation validé par la ca', 'type d\'installation valide', 'type installation valide', 'type valide par la ca', 'u_type_install_valide']
};

// Strict order of values inside [[...]] in Comment 2
export const EXPORT_COLUMNS_ORDER = [
  'TYPE', 
  'STATUT VALIDATION', 
  'CONTACT', 
  'CHGT PRESTA', 
  'VALIDATION ROP', 
  'CHGT DESSERTE', 
  'DÉCHETS PM', 
  'CADRAGE PM', 
  'RÉF JARR.', 
  'MESURE PM', 
  'PTO CONFORME', 
  'ÉTIQUETTE PTO', 
  'SUSPICION FRAUDE', 
  'MESURE PTO AVANT', 
  'MESURE PTO', 
  'PHOTO PTO', 
  'CADRAGE PTO', 
  'RÉF CABLE', 
  'RÉF PB', 
  'PHOTO PBO AVANT', 
  'PHOTO PBO APRÈS', 
  'CADRAGE PB', 
  'MESURE E2', 
  'PÉNÉTRATION', 
  'GÉOLOCALISATION', 
  'CHECKVOISINAGE', 
  'VOISIN PERTURBÉ', 
  'INC', 
  'NACELLE', 
  'POTEAU'
];

export const AGENCY_COLORS: Record<string, string> = {
    'CTA': '#2563eb', // blue-600
    'INE': '#9333ea', // purple-600
    'PACA': '#f97316', // orange-500
    'SO': '#0891b2', // cyan-600 (formerly MED)
    'CORSE': '#dc2626', // red-600
    'DEFAULT': '#374151' // slate-700
};

export const getAgencyColor = (agency: string) => {
    return AGENCY_COLORS[agency?.toUpperCase()] || AGENCY_COLORS.DEFAULT;
};