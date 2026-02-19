import React, { useMemo, useState } from 'react';
import { AgencyStats, Intervention } from '../types';
import { aggregateStats, calculateGlobalValidatorStats, calculateGlobalIgnoredStats, calculateGlobalTagNCs } from '../utils/dataProcessing';
import { AnalysisTable } from './AnalysisTable';
import { Copy, FileWarning, Download, Users, AlertTriangle, CheckCircle, Mail, BarChart2, Check, LayoutGrid, Phone, RotateCcw, Bug, PhoneIncoming, Wrench, Camera, ClipboardCheck, TrendingUp } from 'lucide-react';
import { DebugPanel } from './DebugPanel';
import { format, differenceInCalendarDays } from 'date-fns';
import startOfDay from 'date-fns/startOfDay';
import fr from 'date-fns/locale/fr';
// @ts-ignore
import * as htmlToImage from 'html-to-image';
import { getAgencyColor } from '../constants';

interface DashboardProps {
  data: Intervention[];
  callData: any[] | null;
  selectedAgency: string; // Received from App
  onBack: () => void;
}

// --- UTILS ---

const getHeatmapHex = (ratio: number) => {
  const rSafe = Math.max(0, Math.min(1, ratio));
  const start = { r: 255, g: 255, b: 255 };
  const end = { r: 239, g: 68, b: 68 };
  const r = Math.round(start.r + (end.r - start.r) * rSafe);
  const g = Math.round(start.g + (end.g - start.g) * rSafe);
  const b = Math.round(start.b + (end.b - start.b) * rSafe);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const formatSeconds = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

const getPeriodLabel = (data: Intervention[]) => {
    if (!data.length) return "Période Inconnue";

    // Extract unique dates (ignoring time)
    const dates = Array.from(new Set(data.map(d => startOfDay(d.date).getTime()))).sort();
    
    if (dates.length === 1) {
        const date = new Date(dates[0]);
        const today = startOfDay(new Date());
        const diff = differenceInCalendarDays(today, date);
        if (diff === 1) return "J-1";
        return format(date, "dd/MM", { locale: fr });
    }

    // Check if multiple dates are within the same week
    const weeks = new Set(data.map(d => d.week));
    if (weeks.size === 1) {
        return `S-${Array.from(weeks)[0]}`;
    }

    // Fallback to Month Name if multiple weeks
    const months = new Set(data.map(d => d.month));
    if (months.size === 1) {
        return format(new Date(dates[0]), "MMMM", { locale: fr });
    }

    return "Période Multiple";
};

// --- VISUAL DASHBOARD COMPONENTS ---

interface DashboardKpiProps {
    title: string;
    value: string;
    subtext: string;
    theme: 'genesys' | 'tecnow';
    statusIndicator?: string; // CSS class for the dot color (e.g. "bg-red-500")
}

const DashboardKpi = ({ title, value, subtext, theme, statusIndicator }: DashboardKpiProps) => {
    const themes = {
        genesys: "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-200",
        tecnow: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-200",
    };
    
    return (
        <div className={`
            flex-1 min-w-[140px] h-full min-h-[110px]
            rounded-xl shadow-lg p-3 flex flex-col justify-center gap-2 items-center text-center 
            ${themes[theme]} 
            transition-transform hover:scale-[1.02] duration-200 border border-white/10 relative overflow-hidden
            dashboard-kpi-card
        `}>
            {statusIndicator && (
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${statusIndicator} shadow-sm ring-2 ring-white/30`} title="Indicateur Qualité"></div>
            )}
            
            {/* Title */}
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-90 leading-tight">{title}</p>

            {/* Value */}
            <h3 className="text-xl md:text-2xl font-extrabold tracking-tight drop-shadow-sm whitespace-nowrap leading-normal kpi-value">{value}</h3>
            
            {/* Subtext */}
            <div className="text-[9px] font-medium bg-black/20 px-2 py-0.5 rounded-full border border-white/10 truncate max-w-full">
                {subtext}
            </div>
        </div>
    );
};

interface StackedBarData {
    label: string;
    withContact: number;
    withoutContact: number;
    total: number;
}

const StackedHorizontalBarChart = ({ data }: { data: StackedBarData[] }) => {
    const maxTotal = Math.max(...data.map(d => d.total), 1);

    return (
        <div className="flex flex-col gap-3 w-full">
            {data.map((item, idx) => {
                const widthPercent = (item.total / maxTotal) * 100;
                const withPercent = item.total > 0 ? (item.withContact / item.total) * 100 : 0;
                const withoutPercent = item.total > 0 ? (item.withoutContact / item.total) * 100 : 0;

                return (
                    <div key={idx} className="flex items-center gap-3 text-sm group">
                        <div className="w-32 font-bold text-slate-700 shrink-0 truncate text-right" title={item.label}>
                            {item.label}
                        </div>
                        <div className="flex-1 h-8 bg-slate-50 rounded-lg overflow-hidden flex relative shadow-inner border border-slate-100">
                             <div style={{ width: `${Math.max(widthPercent, 1)}%` }} className="flex h-full rounded-r-lg overflow-hidden transition-all duration-500 ease-out">
                                {item.withContact > 0 && (
                                    <div 
                                        style={{ width: `${withPercent}%` }} 
                                        className="bg-emerald-400 h-full flex items-center justify-center text-emerald-950 text-xs font-bold relative group/segment"
                                        title={`Avec Contact: ${item.withContact}`}
                                    >
                                        {withPercent > 10 && <span className="drop-shadow-sm">{item.withContact}</span>}
                                    </div>
                                )}
                                {item.withoutContact > 0 && (
                                    <div 
                                        style={{ width: `${withoutPercent}%` }} 
                                        className="bg-orange-400 h-full flex items-center justify-center text-orange-950 text-xs font-bold relative group/segment"
                                        title={`Sans Contact: ${item.withoutContact}`}
                                    >
                                        {withoutPercent > 10 && <span className="drop-shadow-sm">{item.withoutContact}</span>}
                                    </div>
                                )}
                             </div>
                        </div>
                        <div className="w-12 text-left font-bold text-slate-800 shrink-0">
                            {item.total}
                        </div>
                    </div>
                );
            })}
             <div className="flex justify-end gap-4 mt-2 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-400 rounded-sm"></div> Avec Contact</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-400 rounded-sm"></div> Sans Contact</div>
            </div>
        </div>
    );
};

interface HorizontalBarRowProps {
    label: string;
    value: number;
    max: number;
    rank: number;
    colorClass?: string;
    shadowClass?: string;
}

const HorizontalBarRow: React.FC<HorizontalBarRowProps> = ({ label, value, max, rank, colorClass = "bg-orange-500", shadowClass = "shadow-[0_0_10px_rgba(249,115,22,0.4)]" }) => {
    const width = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold text-slate-400 w-4">#{rank}</span>
            <span className="text-xs font-medium text-slate-700 w-32 truncate" title={label}>{label}</span>
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                    style={{ width: `${width}%` }} 
                    className={`h-full rounded-full ${colorClass} ${shadowClass}`}
                ></div>
            </div>
            <span className="text-xs font-bold text-slate-700 w-8 text-right">{value}</span>
        </div>
    );
};

// --- STANDARD COMPONENTS ---

const HeatmapCell = ({ value, max, suffix = '', isZeroGreen = false }: { value: number, max: number, suffix?: string, isZeroGreen?: boolean }) => {
  if (value === 0 && isZeroGreen) {
    return <div className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded inline-block">0{suffix}</div>;
  }
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const backgroundColor = `rgba(239, 68, 68, ${ratio * 0.85})`;
  const color = ratio > 0.5 ? 'white' : 'inherit';
  const fontWeight = ratio > 0.5 ? '600' : '500';

  return (
    <div 
      className="-mx-4 -my-3 px-4 py-3 h-full flex items-center"
      style={{ backgroundColor, color, fontWeight }}
    >
      {value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}{suffix}
    </div>
  );
};

// --- EMAIL SPECIFIC COMPONENTS ---

const EMAIL_STYLES = {
  table: { borderCollapse: 'collapse' as const, width: '100%', fontFamily: 'Arial, sans-serif', fontSize: '13px', marginBottom: '15px' },
  th: { border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', padding: '8px', textAlign: 'left' as const, fontSize: '12px', color: '#374151' },
  td: { border: '1px solid #d1d5db', padding: '8px', color: '#111827' },
  footerTd: { border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold', backgroundColor: '#f9fafb' },
  qsCell: { border: '1px solid #d1d5db', padding: '8px', backgroundColor: '#d1fae5', color: '#065f46', fontWeight: 'bold' }
};

const EmailHeatmapCell = ({ value, max, suffix = '', isZeroGreen = false }: { value: number, max: number, suffix?: string, isZeroGreen?: boolean }) => {
  if (value === 0 && isZeroGreen) {
    return <span style={{ color: '#059669', fontWeight: 'bold' }}>0</span>;
  }
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const backgroundColor = getHeatmapHex(ratio * 0.85); 
  const color = ratio > 0.5 ? '#FFFFFF' : '#000000';
  
  return (
    <div style={{ backgroundColor, color, padding: '4px 8px', borderRadius: '4px', textAlign: 'center', display: 'inline-block', minWidth: '40px' }}>
      {value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}{suffix}
    </div>
  );
};

const EmailTable = ({ headers, rows, footer }: { headers: string[], rows: any[][], footer?: any[] }) => (
  <table style={EMAIL_STYLES.table} border={1} cellPadding={5} cellSpacing={0}>
    <thead>
      <tr>
        {headers.map((h, i) => (
          <th key={i} style={EMAIL_STYLES.th}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, idx) => (
        <tr key={idx}>
          {row.map((cell, cIdx) => (
            <td key={cIdx} style={EMAIL_STYLES.td}>{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
    {footer && (
      <tfoot>
        <tr>
          {footer.map((f, i) => (
            <td key={i} style={EMAIL_STYLES.footerTd}>{f}</td>
          ))}
        </tr>
      </tfoot>
    )}
  </table>
);

// --- MAIN COMPONENT ---

const TabButton = ({ active, onClick, icon, label, theme = 'neutral', className }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, theme?: 'genesys' | 'tecnow' | 'neutral' | 'danger', className?: string }) => {
    let activeClass = 'border-blue-600 text-blue-700 bg-blue-50/50';
    if (theme === 'genesys') activeClass = 'border-orange-500 text-orange-700 bg-orange-50/50';
    if (theme === 'tecnow') activeClass = 'border-emerald-500 text-emerald-700 bg-emerald-50/50';
    if (theme === 'danger') activeClass = 'border-amber-500 text-amber-700 bg-amber-50/50';

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-all duration-200 ${
                active 
                ? activeClass
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            } ${className || ''}`}
        >
            {icon}
            {label}
        </button>
    );
};

const SectionHeader = ({ icon, title, theme }: { icon: React.ReactNode, title: string, theme: 'genesys' | 'tecnow' }) => (
    <div className={`flex items-center gap-2 mb-4 pb-2 border-b ${theme === 'genesys' ? 'border-orange-100' : 'border-emerald-100'}`}>
        <div className={`p-1.5 rounded-lg ${theme === 'genesys' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {icon}
        </div>
        <h3 className={`font-bold text-lg ${theme === 'genesys' ? 'text-orange-900' : 'text-emerald-900'}`}>{title}</h3>
    </div>
);

const Toast = ({ message, onClose }: { message: string, onClose: () => void }) => (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <div className="bg-green-500 rounded-full p-1">
                <Check size={14} className="text-white" />
            </div>
            <span className="font-medium text-sm">{message}</span>
        </div>
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ data, callData, selectedAgency, onBack }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'appels' | 'overview' | 'techs' | 'email' | 'performance'>('dashboard');
  const [showToast, setShowToast] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [visualDiagnostics, setVisualDiagnostics] = useState<any>(null);

  // No week filter anymore
  const stats: AgencyStats = useMemo(() => 
    aggregateStats(data, selectedAgency, callData || []), 
  [data, callData, selectedAgency]);

  // Global Performance Stats (Ignoring Agency Filter)
  const globalPerf = useMemo(() => calculateGlobalValidatorStats(data), [data]);
  // Global Ignored Stats (Ignoring Agency Filter)
  const globalIgnored = useMemo(() => calculateGlobalIgnoredStats(data), [data]);
  // Top 5 Tags NC (Filtered by selected Agency)
  const topTagsNC = useMemo(() => calculateGlobalTagNCs(data, selectedAgency), [data, selectedAgency]);

  const totalGlobal = stats.totalInterventions || 1; 
  // Calculate period label based on all data for the agency, not just selected week
  const periodLabel = useMemo(() => getPeriodLabel(data.filter(d => d.agency === selectedAgency)), [data, selectedAgency]);

  // Calculations
  const maxSansContactCount = Math.max(...Object.values(stats.byInstallType).map(v => v.without), 1);
  const maxGlobalRateSansContact = Math.max(...stats.techSansContactStats.map(i => i.globalRate), 0.1);
  const maxGlobalRateNc = Math.max(...stats.techNcStats.map(i => i.globalRate), 0.1);
  const percentSansContact = ((stats.byContact.withoutContact / totalGlobal) * 100).toFixed(1);
  const percentNC = ((stats.totalNC / totalGlobal) * 100).toFixed(1); 
  const qualityService = (100 - (stats.totalNC / totalGlobal * 100)).toFixed(2);

  // Calls
  const calls = stats.callStats;
  const getQsColor = (val: number) => {
      if (val >= 95) return { color: "bg-emerald-400", label: "Excellent" };
      if (val >= 93) return { color: "bg-lime-400", label: "Bon" };
      if (val >= 90) return { color: "bg-yellow-400", label: "Moyen" };
      return { color: "bg-red-500", label: "Critique" };
  };

  let qsIndicator = "bg-slate-300";
  let qsLabel = "-";
  let qsNetIndicator = "bg-slate-300";
  let qsNetLabel = "-";

  if (calls) {
      const qsObj = getQsColor(calls.qs);
      qsIndicator = qsObj.color;
      qsLabel = qsObj.label;

      const qsNetObj = getQsColor(calls.qsNet);
      qsNetIndicator = qsNetObj.color;
      qsNetLabel = qsNetObj.label;
  }

  // --- ROWS PREPARATION ---
  const chartStackedData: StackedBarData[] = Object.entries(stats.byInstallType)
    .map(([type, val]) => ({
      label: type,
      withContact: val.with,
      withoutContact: val.without,
      total: val.total
    }))
    .sort((a, b) => b.total - a.total);
  
  const mergedInstallTypeRows = Object.entries(stats.byInstallType).map(([type, counts]) => {
      const pctWith = counts.total > 0 ? ((counts.with / counts.total) * 100).toFixed(1) : '0.0';
      const pctWithout = counts.total > 0 ? ((counts.without / counts.total) * 100).toFixed(1) : '0.0';
      return [type, `${counts.with} (${pctWith}%)`, <HeatmapCell value={counts.without} max={maxSansContactCount} isZeroGreen={true} suffix={` (${pctWithout}%)`} />, `${counts.total} (100%)`];
  });

  const mergedInstallTypeFooter = [
    'Total Général', `${stats.byContact.withContact} (${((stats.byContact.withContact / totalGlobal) * 100).toFixed(1)}%)`,
    <span className={stats.byContact.withoutContact > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>{stats.byContact.withoutContact} ({percentSansContact}%)</span>,
    stats.totalInterventions
  ];

  const techSansContactRows = stats.techSansContactStats.map(item => [
    item.tech, item.targetCount, `${item.individualRate.toFixed(2)}%`, <HeatmapCell value={item.globalRate} max={maxGlobalRateSansContact} suffix="%" />
  ]);
  const techNcRows = stats.techNcStats.map(item => [
    item.tech, item.targetCount, `${item.individualRate.toFixed(2)}%`, <HeatmapCell value={item.globalRate} max={maxGlobalRateNc} suffix="%" />
  ]);
  const ncSansContactRows = stats.ncSansContactDetails.filter(item => item.countNC > 0).map(item => [
      item.tech, <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">{item.countNC} <span className="text-xs font-normal">({item.rateNC.toFixed(1)}%)</span></span>,
      <span className="text-xs text-slate-600 italic block max-w-xs">{item.topReasons.join(', ') || '-'}</span>, `${item.countOK} (${item.rateOK.toFixed(1)}%)`, item.total
    ]);
  const correctionRows = stats.correctionStats.map(item => [
    item.installType, item.countPnd, item.motifsPnd.join(', ') || '-', item.countApr, item.motifsApr.join(', ') || '-', item.totalCor
  ]);
  
  const topTagNcRows = topTagsNC.map(item => [
      item.tagName,
      <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-100">{item.totalNC} NC</span>,
      <span className="text-slate-600 italic text-xs">{item.reasons.join(', ')}</span>
  ]);

  // Use globalIgnored instead of stats.ignoredLines to show all errors regardless of agency selected
  const ignoredRows = globalIgnored.map(item => [
      item.validator, 
      <span className="text-red-600 font-bold">{item.tagAbsent > 0 ? item.tagAbsent : '-'}</span>,
      <span className="text-orange-600 font-bold">{item.tagMisplaced > 0 ? item.tagMisplaced : '-'}</span>,
      <span className="text-slate-400 italic">{item.emptyLine > 0 ? item.emptyLine : '-'}</span>,
      <span className="font-bold">{item.total}</span>
  ]);

  // Performance Table Rows
  // Custom Order: Non Tagué, RACC, PLP, E2, E3
  const preferredOrder = ['Non Tagué', 'RACC', 'PLP', 'E2', 'E3'];
  const otherTypes = globalPerf.allTypes.filter(t => !preferredOrder.includes(t));
  const displayTypes = [...preferredOrder, ...otherTypes];

  const perfHeaders = ['Validateur', 'Total Cas', 'Avec Contact', 'Sans Contact', ...displayTypes];
  const perfRows = globalPerf.stats.map(s => {
      const typeCells = displayTypes.map(t => s.typesBreakdown[t] || 0);
      return [
          s.validator, 
          <span className="font-bold">{s.totalCases}</span>,
          <span className="text-green-600 font-medium">{s.withContact}</span>,
          <span className="text-orange-600 font-medium">{s.withoutContact}</span>,
          ...typeCells.map(val => val === 0 ? <span className="text-slate-300">-</span> : val)
      ];
  });

  const callRows = calls ? [
      ['Appels Reçus', calls.offered], ['Appels traités', calls.answered], ['Appels Abandonnés', calls.abandoned], ['Appels abandonnés courts < 10s', calls.shortAbandoned],
      ['QS', `${calls.qs.toFixed(2)}%`], ['QS Nette (hors ABD court)', `${calls.qsNet.toFixed(2)}%`], ['DMR', formatSeconds(calls.dmr)], ['DMT', formatSeconds(calls.dmt)], ['Temps moyen MEA', formatSeconds(calls.mea)]
  ] : [];

  const emailCallRows = calls ? [
    ['Appels Reçus', calls.offered], ['Appels traités', calls.answered], ['Appels Abandonnés', calls.abandoned], ['Appels abandonnés courts < 10s', calls.shortAbandoned],
    ['QS', <span style={EMAIL_STYLES.qsCell}>{calls.qs.toFixed(2)}%</span>], ['QS Nette (hors ABD court)', <span style={EMAIL_STYLES.qsCell}>{calls.qsNet.toFixed(2)}%</span>], ['DMR', formatSeconds(calls.dmr)], ['DMT', formatSeconds(calls.dmt)], ['Temps moyen MEA', formatSeconds(calls.mea)]
    ] : [];

  // Handlers
  const copyToClipboard = () => {
    const el = document.getElementById('email-view-content');
    if (!el) { alert("Veuillez aller sur l'onglet 'Aperçu Email' pour copier le rapport."); setActiveTab('email'); return; }
    const range = document.createRange(); range.selectNode(el); window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range); document.execCommand('copy'); window.getSelection()?.removeAllRanges();
    setShowToast(true); setTimeout(() => setShowToast(false), 3000);
  };

  const collectRenderDiagnostics = () => {
      const container = document.getElementById('global-view-container');
      const kpiCard = container?.querySelector('.dashboard-kpi-card');
      const kpiValue = container?.querySelector('.kpi-value');

      const diag = {
          browser: {
              userAgent: navigator.userAgent,
              devicePixelRatio: window.devicePixelRatio,
              scrollY: window.scrollY,
              innerHeight: window.innerHeight
          },
          container: container ? {
              width: container.offsetWidth,
              height: container.offsetHeight,
              offsetTop: container.offsetTop,
              rect: container.getBoundingClientRect()
          } : "Not Found",
          kpiSample: kpiCard ? {
              computedStyles: {
                 // @ts-ignore
                 lineHeight: window.getComputedStyle(kpiCard).lineHeight,
                 // @ts-ignore
                 fontFamily: window.getComputedStyle(kpiCard).fontFamily,
                 // @ts-ignore
                 display: window.getComputedStyle(kpiCard).display,
                 // @ts-ignore
                 justifyContent: window.getComputedStyle(kpiCard).justifyContent
              },
              rect: kpiCard.getBoundingClientRect()
          } : "Not Found",
          kpiValueText: kpiValue ? {
              // @ts-ignore
              computedLineHeight: window.getComputedStyle(kpiValue).lineHeight,
              // @ts-ignore
              fontSize: window.getComputedStyle(kpiValue).fontSize
          } : "Not Found"
      };
      setVisualDiagnostics(diag);
  };

  const handleScreenshot = async () => {
      const element = document.getElementById('global-view-container');
      if (!element) return;
      
      try {
          // html-to-image is much more robust for vertical alignment and webfonts
          const dataUrl = await htmlToImage.toPng(element, { backgroundColor: '#ffffff', pixelRatio: 2 });
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `Vigie_${selectedAgency}_${periodLabel}.png`;
          link.click();
      } catch (e) {
          console.error("Screenshot failed", e);
          alert("Erreur lors de la capture d'écran.");
      }
  };

  const handleCopyImage = async () => {
      const element = document.getElementById('global-view-container');
      if (!element) return;
      
      try {
          const blob = await htmlToImage.toBlob(element, { backgroundColor: '#ffffff', pixelRatio: 2 });
          if (blob) {
              navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': blob })
              ]).then(() => {
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
              });
          }
      } catch (e) {
          console.error("Copy image failed", e);
          alert("Erreur lors de la copie de l'image.");
      }
  };


  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {showToast && <Toast message="Copié dans le presse-papier !" onClose={() => setShowToast(false)} />}
      
      {showDebug && (
          <DebugPanel 
              callDataRaw={callData} 
              selectedAgency={selectedAgency} 
              visualDiagnostics={visualDiagnostics}
              onClose={() => setShowDebug(false)} 
          />
      )}

      {/* NEW HEADER WITHOUT INTERNAL CONTROLS - NOW IN APP BAR */}
      <div className="hidden">
         {/* Spacer if needed or completely remove header div */}
      </div>
      
      {/* Floating Debug Button (if user really wants it on dashboard, but it is in navbar now) */}
      <button onClick={() => { collectRenderDiagnostics(); setShowDebug(true); }} className="fixed bottom-6 left-6 p-3 bg-white text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-full shadow-lg border border-slate-200 z-50 transition-colors" title="Diagnostic Technique">
         <Bug size={18} />
      </button>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 gap-1 bg-white rounded-t-xl px-2 pt-2 shadow-sm mt-4">
        <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutGrid size={16}/>} label="Vue Globale" />
        {calls && <TabButton active={activeTab === 'appels'} onClick={() => setActiveTab('appels')} icon={<PhoneIncoming size={16}/>} label="Genesys (Appels)" theme="genesys" />}
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart2 size={16}/>} label="Synthèse TecNow" theme="tecnow" />
        <TabButton active={activeTab === 'techs'} onClick={() => setActiveTab('techs')} icon={<Users size={16}/>} label="Techniciens" theme="tecnow" />
        <TabButton active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} icon={<TrendingUp size={16}/>} label="Performance Agents" theme="danger" />
        <TabButton active={activeTab === 'email'} onClick={() => setActiveTab('email')} icon={<Mail size={16}/>} label="Email" />
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-slate-100 p-6 min-h-[400px]">
        
        {/* TAB: VISUAL DASHBOARD */}
        {activeTab === 'dashboard' && (
            <div id="global-view-container" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 bg-white p-4 rounded-xl">
                
                {/* GLOBAL TITLE BLOCK */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-2">
                    <div className="flex-1 text-center pl-20"> {/* Padding to center despite right actions */}
                         <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: getAgencyColor(selectedAgency) }}>
                            {selectedAgency} - Etat de validation CR de {periodLabel}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                         <button onClick={handleCopyImage} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors" title="Copier l'image">
                            <ClipboardCheck size={20} />
                         </button>
                         <button onClick={handleScreenshot} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors" title="Télécharger l'image">
                            <Camera size={20} />
                         </button>
                    </div>
                </div>

                {/* 0. GENESYS SECTION (Only if calls exist) */}
                {calls && (
                    <div className="p-4 rounded-xl bg-orange-50/50 border border-orange-100 relative">
                        <SectionHeader icon={<PhoneIncoming size={18} />} title="Performance Genesys" theme="genesys" />

                        {/* Adaptive Flex Layout */}
                        <div className="flex flex-wrap gap-3 mt-4">
                            {/* Row 1 (5 items) */}
                            <DashboardKpi title="Appels Reçus" value={calls.offered.toString()} subtext="Flux Entrant" theme="genesys" />
                            <DashboardKpi title="Appels Traités" value={calls.answered.toString()} subtext="Réponse" theme="genesys" />
                            <DashboardKpi title="Appels Abandonnés" value={calls.abandoned.toString()} subtext="Perdus" theme="genesys" />
                            <DashboardKpi title="Abandons Courts" value={calls.shortAbandoned.toString()} subtext="< 10s" theme="genesys" />
                            
                            {/* QS Card with Indicator */}
                            <DashboardKpi title="QS" value={`${calls.qs.toFixed(1)}%`} subtext={qsLabel} theme="genesys" statusIndicator={qsIndicator} />

                            {/* FORCE LINE BREAK */}
                            <div className="w-full h-0 basis-full"></div>
                            
                            {/* Row 2 (4 items that stretch) */}
                            <DashboardKpi title="QS Nette" value={`${calls.qsNet.toFixed(1)}%`} subtext={qsNetLabel} theme="genesys" statusIndicator={qsNetIndicator} />
                            <DashboardKpi title="DMR" value={formatSeconds(calls.dmr)} subtext="Vitesse Moy." theme="genesys" />
                            <DashboardKpi title="DMT" value={formatSeconds(calls.dmt)} subtext="Traitement" theme="genesys" />
                            <DashboardKpi title="Temps Moyen MEA" value={formatSeconds(calls.mea)} subtext="Attente" theme="genesys" />
                        </div>
                    </div>
                )}
                
                {/* 1. TECHNOW SECTION */}
                <div className="p-4 rounded-xl bg-emerald-50/30 border border-emerald-100">
                    <SectionHeader icon={<Wrench size={18} />} title="Performance TecNow" theme="tecnow" />
                    
                    {/* KPIs: 8 items. 4 cols on LG -> 2 rows. */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                        <DashboardKpi title="Interventions" value={stats.totalInterventions.toString()} subtext="Total Validé" theme="tecnow" />
                        <DashboardKpi title="Conformité (QS)" value={`${qualityService}%`} subtext="Taux OK" theme="tecnow" />
                        
                        <DashboardKpi title="Vol. Sans Contact" value={stats.byContact.withoutContact.toString()} subtext={`${percentSansContact}% du vol.`} theme="tecnow" />
                        <DashboardKpi title="Nb Techs Sans Contact" value={stats.nbTechsWithSansContact.toString()} subtext="Concernés" theme="tecnow" />
                        
                        <DashboardKpi title="Vol. NC" value={stats.totalNC.toString()} subtext={`${percentNC}% du vol.`} theme="tecnow" />
                        <DashboardKpi title="Nb Techs NC" value={stats.nbTechsWithNc.toString()} subtext="Concernés" theme="tecnow" />
                        
                        <DashboardKpi title="Vol. Corrections" value={stats.totalCorrections.toString()} subtext="Total COR" theme="tecnow" />
                        <DashboardKpi title="Nb Techs Corrections" value={stats.nbTechsWithCorrection.toString()} subtext="Concernés" theme="tecnow" />
                    </div>

                    {/* CHARTS LAYOUT */}
                    <div className="space-y-6">
                        
                        {/* Global Distribution (Full Width) */}
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col h-auto min-h-[300px]">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <BarChart2 className="text-emerald-500" size={20}/>
                                    Répartition par Type d'Installation
                                </h3>
                                <div className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                                    Total: {stats.totalInterventions}
                                </div>
                            </div>
                            <div className="flex-1 w-full">
                                <StackedHorizontalBarChart data={chartStackedData} />
                            </div>
                        </div>

                        {/* Top Techniciens Section (Side by Side) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left: Sans Contact (Orange/Warning Theme) */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col h-auto min-h-[350px]">
                                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        <Phone size={16} className="text-orange-500" />
                                        Top 10 : Sans Contact
                                    </h3>
                                </div>
                                <div className="flex-1">
                                    {stats.techSansContactStats.length > 0 ? (
                                        stats.techSansContactStats.map((tech, idx) => (
                                            <HorizontalBarRow 
                                                key={tech.tech} rank={idx + 1} label={tech.tech} value={tech.targetCount}
                                                max={stats.techSansContactStats[0]?.targetCount || 0}
                                                colorClass="bg-orange-400" shadowClass="shadow-none"
                                            />
                                        ))
                                    ) : (
                                        <p className="text-slate-400 text-sm text-center py-10">Aucune donnée disponible</p>
                                    )}
                                </div>
                            </div>

                            {/* Right: NC (Red/Alert Theme) */}
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col h-auto min-h-[350px]">
                                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        <AlertTriangle size={16} className="text-red-500" />
                                        Top 10 : Non-Conformités (NC)
                                    </h3>
                                </div>
                                <div className="flex-1">
                                    {stats.techNcStats.length > 0 ? (
                                        stats.techNcStats.map((tech, idx) => (
                                            <HorizontalBarRow 
                                                key={tech.tech} rank={idx + 1} label={tech.tech} value={tech.targetCount}
                                                max={stats.techNcStats[0]?.targetCount || 0}
                                                colorClass="bg-red-500" shadowClass="shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                                            />
                                        ))
                                    ) : (
                                        <p className="text-slate-400 text-sm text-center py-10">Aucune NC détectée</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. QUALITY DETAILS (Bottom) */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                             <CheckCircle size={18} className="text-slate-500"/>
                             Détails NC détectées sur 'Sans Contact'
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full font-medium border border-red-100">
                            <AlertTriangle size={14} />
                            {stats.ncSansContactDetails.reduce((acc, curr) => acc + curr.countNC, 0)} NC à traiter
                        </div>
                    </div>
                    <div className="p-0">
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3">Technicien</th>
                                        <th className="px-6 py-3">NC (Taux)</th>
                                        <th className="px-6 py-3">Motifs Principaux</th>
                                        <th className="px-6 py-3">OK (Taux)</th>
                                        <th className="px-6 py-3">Total Sans Contact</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {stats.ncSansContactDetails.slice(0, 10).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3 font-medium text-slate-900">{row.tech}</td>
                                            <td className="px-6 py-3">
                                                <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-100">
                                                    {row.countNC} <span className="text-xs font-normal text-red-400">({row.rateNC.toFixed(1)}%)</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-500 italic truncate max-w-xs">{row.topReasons.join(', ') || '-'}</td>
                                            <td className="px-6 py-3"><span className="text-slate-700">{row.countOK} <span className="text-xs text-slate-400">({row.rateOK.toFixed(1)}%)</span></span></td>
                                            <td className="px-6 py-3 font-bold text-slate-800">{row.total}</td>
                                        </tr>
                                    ))}
                                    {stats.ncSansContactDetails.length === 0 && ( <tr><td colSpan={5} className="p-6 text-center text-slate-400">Aucune donnée disponible</td></tr> )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 3. TOP TAGS NC (New) */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
                    <div className="p-4 border-b border-slate-200 bg-red-50/50 flex items-center justify-between">
                         <h3 className="font-bold text-slate-800 flex items-center gap-2">
                             <AlertTriangle size={18} className="text-red-500"/>
                             Top 5 Types de Non-Conformités (Tags)
                        </h3>
                    </div>
                    <AnalysisTable title="" headers={['Tag / Type NC', 'Volume Total', 'Détails / Motifs']} rows={topTagNcRows} />
                </div>
            </div>
        )}

        {/* OTHER TABS - KEEPING GENERIC LAYOUT BUT CLEANED UP */}
        
        {activeTab === 'appels' && calls && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
                 <div className="max-w-2xl mx-auto border-t-4 border-orange-500 rounded-lg shadow-sm">
                    <AnalysisTable title={`Vigie Appel VCR ${calls.agency} (Genesys)`} headers={['Indicateur', 'Valeur']} rows={callRows} />
                 </div>
            </div>
        )}

        {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="col-span-1 lg:col-span-2 border-t-4 border-emerald-500 rounded-lg shadow-sm">
                        <AnalysisTable title="Répartition par Type (TecNow)" headers={['Type', 'Avec Contact (Vol/%)', 'Sans Contact (Vol/%)', 'Total (Vol/%)']} rows={mergedInstallTypeRows} footer={mergedInstallTypeFooter} />
                    </div>
                </div>
                <div className="border-t-4 border-emerald-500 rounded-lg shadow-sm">
                     <AnalysisTable title="Corrections & Sauvetages" headers={['Type', 'Nb PND', 'Motifs PND', 'Nb APR', 'Motifs APR', 'Total COR']} rows={correctionRows} />
                </div>
            </div>
        )}

        {activeTab === 'techs' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <AnalysisTable title="Top 10 : Sans Contact" headers={['Technicien', 'Volume', 'Taux Indiv.', 'Taux Global']} rows={techSansContactRows} />
                    <AnalysisTable title="Top 10 : Non-Conformités (NC)" headers={['Technicien', 'Volume NC', 'Taux Indiv.', 'Taux Global']} rows={techNcRows} />
                </div>
                <div className="border-t-4 border-emerald-500 rounded-lg shadow-sm">
                    <AnalysisTable title="Détails NC détectées sur 'Sans Contact'" headers={['Technicien', 'NC (Taux)', 'Motifs Principaux', 'OK (Taux)', 'Total Sans Contact']} rows={ncSansContactRows} />
                </div>
            </div>
        )}

        {activeTab === 'performance' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8">
                {/* Performance Global Table */}
                <div className="border-t-4 border-amber-500 rounded-lg shadow-sm bg-white">
                     <div className="flex items-center gap-2 p-4 bg-amber-50 text-amber-800 border-b border-amber-100">
                        <TrendingUp size={20} />
                        <div>
                            <h3 className="font-bold">Performance des Agents (Validateurs)</h3>
                            <p className="text-xs text-amber-700 opacity-80">Données consolidées (toutes agences confondues)</p>
                        </div>
                     </div>
                     <AnalysisTable title="Volume de traitement & Répartition" headers={perfHeaders} rows={perfRows} />
                </div>

                {/* Parsing Errors Table (Legacy "Ignored Lines") */}
                <div className="border-t-4 border-slate-400 rounded-lg shadow-sm bg-white opacity-90">
                     <div className="flex items-center gap-2 p-4 bg-slate-50 text-slate-700 border-b border-slate-200">
                        <FileWarning size={20} />
                        <h3 className="font-bold">Détails des Rejets / Erreurs de format</h3>
                        <p className="text-xs text-slate-500 ml-auto">Données brutes, agences confondues</p>
                     </div>
                     <AnalysisTable title="Lignes ignorées par le système" headers={['Validateur', 'Tag Absent', 'Tag Mal Placé', 'Ligne Vide', 'Total']} rows={ignoredRows} />
                </div>
            </div>
        )}

        {/* TAB: EMAIL PREVIEW */}
        {activeTab === 'email' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-4 text-sm text-blue-800 flex justify-between items-center">
                    <span>
                      <strong>Aperçu Email Optimisé :</strong> Copiez le contenu ci-dessous pour vos envois hebdomadaires.
                    </span>
                    <button 
                        onClick={copyToClipboard} 
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium transition-all"
                    >
                        <Copy size={16} /> Copier
                    </button>
                </div>
                <div id="email-view-content" style={{ fontFamily: 'Arial, sans-serif', color: '#1f2937', padding: '20px', backgroundColor: '#ffffff' }}>
                    <p style={{marginBottom: '10px'}}>Bonjour,</p>
                    <p style={{marginBottom: '10px'}}>Je partage avec vous l'état de validation de la <strong>{periodLabel}</strong> :</p>
                    
                    <p style={{fontWeight: 'bold', marginTop: '20px', marginBottom: '10px', textDecoration: 'underline'}}>· Performance file d’attente :</p>
                    {calls ? (
                         <div style={{maxWidth: '400px', marginBottom: '20px'}}>
                             <div style={{fontWeight: 'bold', padding: '8px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', textAlign: 'center'}}>Vigie Appel VCR {calls.agency} de la {periodLabel}</div>
                             <table style={{...EMAIL_STYLES.table, width: '100%'}} border={1} cellPadding={5} cellSpacing={0}>
                                <tbody>{emailCallRows.map((row, idx) => (<tr key={idx}><td style={{...EMAIL_STYLES.td, fontWeight: 'bold'}}>{row[0]}</td><td style={{...EMAIL_STYLES.td, textAlign: 'right'}}>{row[1]}</td></tr>))}</tbody>
                             </table>
                         </div>
                    ) : ( <p style={{color: '#9ca3af', fontStyle: 'italic', fontSize: '12px'}}>[Données Genesys non disponibles]</p> )}
                    
                    <p style={{fontWeight: 'bold', marginTop: '20px', marginBottom: '10px', textDecoration: 'underline'}}>· Nombre de CRs SANS CONTACT :</p>
                    <EmailTable headers={['Type d\'installation', 'Avec Contact', 'Sans Contact', 'Total général']} rows={Object.entries(stats.byInstallType).map(([type, counts]) => [type, counts.with, <EmailHeatmapCell value={counts.without} max={maxSansContactCount} isZeroGreen={true} />, counts.total])} footer={['Total', stats.byContact.withContact, <span style={{color: stats.byContact.withoutContact > 0 ? '#dc2626' : '#059669', fontWeight: 'bold'}}>{stats.byContact.withoutContact}</span>, stats.totalInterventions]} />
                    <EmailTable headers={['Type d\'installation', 'Avec Contact', 'Sans Contact', 'Total général']} rows={Object.entries(stats.byInstallType).map(([type, counts]) => [type, `${((counts.with/totalGlobal)*100).toFixed(2)}%`, <span style={{color: counts.without > 0 ? '#dc2626' : '#059669', fontWeight: 'bold'}}>{`${((counts.without/totalGlobal)*100).toFixed(2)}%`}</span>, `${((counts.total/totalGlobal)*100).toFixed(2)}%`])} />
                    
                    <p style={{fontWeight: 'bold', marginTop: '20px', marginBottom: '10px', textDecoration: 'underline'}}>· NC par TECH (SANS CONTACT) :</p>
                    <EmailTable headers={['Technicien', 'Nombre', 'Taux Individuel', 'Taux Global']} rows={stats.techSansContactStats.map(item => [item.tech, item.targetCount, `${item.individualRate.toFixed(2)}%`, <EmailHeatmapCell value={item.globalRate} max={maxGlobalRateSansContact} suffix="%" />])} />
                    
                    <p style={{fontWeight: 'bold', marginTop: '20px', marginBottom: '10px', textDecoration: 'underline'}}>· NC par TECH :</p>
                    <EmailTable headers={['Technicien', 'Nombre NC', 'Taux Individuel', 'Taux Global']} rows={stats.techNcStats.map(item => [item.tech, item.targetCount, `${item.individualRate.toFixed(2)}%`, <EmailHeatmapCell value={item.globalRate} max={maxGlobalRateNc} suffix="%" />])} />
                    
                    <p style={{fontWeight: 'bold', marginTop: '20px', marginBottom: '10px', textDecoration: 'underline'}}>· NC détectée par Tech / Sans Contact :</p>
                    <EmailTable headers={['Technicien', 'NC (Taux)', 'Motifs NC', 'OK (Taux)', 'Total Sans Contact']} rows={stats.ncSansContactDetails.filter(item => item.countNC > 0).map(item => [item.tech, <span style={{color: '#dc2626', fontWeight: 'bold'}}>{item.countNC} <span style={{fontSize: '11px', fontWeight: 'normal', color: '#000'}}>({item.rateNC.toFixed(1)}%)</span></span>, <span style={{fontSize: '11px', fontStyle: 'italic', color: '#4b5563'}}>{item.topReasons.join(', ') || '-'}</span>, `${item.countOK} (${item.rateOK.toFixed(1)}%)`, item.total])} />
                    
                    <p style={{fontWeight: 'bold', marginTop: '20px', marginBottom: '10px', textDecoration: 'underline'}}>· Nombre de CR NC OK sauvé par la CA ou après retour de l'agence :</p>
                    <EmailTable headers={['Type d\'installation', 'Nb COR PND', 'Motifs PND', 'Nb COR APR', 'Motifs APR', 'Total COR']} rows={stats.correctionStats.map(item => [item.installType, item.countPnd, item.motifsPnd.join(', ') || '-', item.countApr, item.motifsApr.join(', ') || '-', item.totalCor])} />

                    <p style={{fontWeight: 'bold', marginTop: '20px', marginBottom: '10px', textDecoration: 'underline'}}>· TOP 5 Types de Non-Conformités (Tags) :</p>
                    <EmailTable headers={['Tag', 'Volume', 'Détails / Motifs']} rows={topTagNcRows.map(r => [r[0], r[1], r[2]])} />
                </div>
            </div>
        )}

      </div>
    </div>
  );
};