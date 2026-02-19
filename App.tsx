import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { parseFile } from './utils/excelParser';
import { normalizeData } from './utils/dataProcessing';
import { Intervention } from './types';
import { LayoutDashboard, CheckCircle2, ShieldCheck, BarChart3, PhoneIncoming, Upload, FileUp, FileSpreadsheet, RefreshCw, Loader2, AlertTriangle, Database, Download } from 'lucide-react';
import { getAgencyColor } from './constants';
import * as XLSX from 'xlsx';

// -- COMPOSANT BOUTON HEADER --
interface HeaderUploadButtonProps {
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  isLoading: boolean;
  isLoaded: boolean;
  theme: 'tecnow' | 'genesys';
  onFileSelect: (file: File) => void;
  accept?: string;
}

const HeaderUploadButton: React.FC<HeaderUploadButtonProps> = ({ label, subLabel, icon, isLoading, isLoaded, theme, onFileSelect, accept = ".csv,.xlsx,.xls" }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
      // Reset value to allow re-uploading the same file if needed
      e.target.value = '';
    }
  };

  const themeClasses = {
      tecnow: {
          base: "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300",
          loaded: "bg-white border-emerald-500 text-emerald-700 shadow-sm ring-1 ring-emerald-100",
          iconBg: "bg-emerald-200 text-emerald-800"
      },
      genesys: {
          base: "bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100 hover:border-orange-300",
          loaded: "bg-white border-orange-500 text-orange-700 shadow-sm ring-1 ring-orange-100",
          iconBg: "bg-orange-200 text-orange-800"
      }
  };

  const styles = themeClasses[theme];

  return (
    <div className="relative group">
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden" 
        accept={accept} 
        onChange={handleChange}
        disabled={isLoading}
      />
      <button 
        onClick={handleClick}
        disabled={isLoading}
        className={`
            flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border
            ${isLoaded ? styles.loaded : styles.base}
            ${isLoading ? 'cursor-wait opacity-70' : ''}
        `}
      >
        {isLoading ? (
             <Loader2 className="w-5 h-5 animate-spin" />
        ) : isLoaded ? (
             <div className="bg-green-100 p-1 rounded-full"><CheckCircle2 className="w-3 h-3 text-green-700" /></div>
        ) : (
             <div className={`p-1.5 rounded-md ${styles.iconBg}`}>{icon}</div>
        )}
        
        <div className="flex flex-col items-start leading-tight">
            <span className="font-bold">{label}</span>
            {subLabel && <span className="text-[10px] opacity-80 font-normal">{subLabel}</span>}
        </div>
      </button>
    </div>
  );
};


function App() {
  const [interventionData, setInterventionData] = useState<Intervention[] | null>(null);
  const [callData, setCallData] = useState<any[] | null>(null);
  
  const [isLoadingInt, setIsLoadingInt] = useState(false);
  const [isLoadingCall, setIsLoadingCall] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agency State
  const [selectedAgency, setSelectedAgency] = useState<string>('');
  
  // Calculate agencies list
  const agencies = useMemo(() => {
    if (!interventionData) return [];
    return Array.from(new Set(interventionData.map(i => i.agency))).sort();
  }, [interventionData]);

  // Set default agency when data loads
  useEffect(() => {
    if (agencies.length > 0 && !selectedAgency) {
      setSelectedAgency(agencies[0]);
    }
  }, [agencies, selectedAgency]);

  const handleInterventionFile = async (file: File) => {
    setIsLoadingInt(true);
    setError(null);
    try {
      const rawData = await parseFile(file);
      const normalized = normalizeData(rawData);
      
      if (normalized.length === 0) {
        setError("Le fichier interventions semble vide ou invalide.");
      } else {
        setInterventionData(normalized);
        // Reset agency selection on new file load
        setSelectedAgency('');
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lecture fichier Interventions.");
    } finally {
      setIsLoadingInt(false);
    }
  };

  const handleCallFile = async (file: File) => {
      setIsLoadingCall(true);
      setError(null);
      try {
          const rawData = await parseFile(file);
          // Just store raw for now, processing happens in dashboard based on context
          setCallData(rawData);
      } catch (err) {
          console.error(err);
          // Don't block main app if call file fails
          setError("Erreur lecture fichier Appels (optionnel).");
      } finally {
          setIsLoadingCall(false);
      }
  };

  const handleExport = () => {
    if (!interventionData || !selectedAgency) return;
    
    const filteredData = interventionData.filter(i => i.agency === selectedAgency);
    const exportData = filteredData.map(item => ({ ...item.originalRow, ...item.extractedFields }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Extraction_Vigie");
    XLSX.writeFile(workbook, `Vigie_S${filteredData[0]?.week || 0}_${selectedAgency}.xlsx`);
  };

  const handleExportGlobal = () => {
    if (!interventionData) return;
    
    // Export all data without filtering by agency
    const exportData = interventionData.map(item => ({ ...item.originalRow, ...item.extractedFields }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Extraction_Globale");
    // Use week from first item or default to 0
    const week = interventionData[0]?.week || 0;
    XLSX.writeFile(workbook, `Vigie_S${week}_GLOBAL.xlsx`);
  };

  const reset = () => {
      setInterventionData(null);
      setCallData(null);
      setError(null);
      setSelectedAgency('');
  }

  // Determine if we show dashboard: We need at least Intervention Data
  const showDashboard = interventionData !== null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo Section */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-800 p-2 rounded-lg shadow-sm cursor-pointer hover:bg-slate-700 transition-colors" onClick={reset}>
                <LayoutDashboard className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col mr-6">
                  <span className="font-extrabold text-xl tracking-tight text-slate-800 leading-none">Vigie<span className="text-emerald-600">VCR</span></span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">RACC BYTEL</span>
              </div>
            </div>

            {/* CENTER: Agency Buttons & Export (Only visible if dashboard active) */}
            {showDashboard && (
              <div className="flex-1 flex items-center justify-center gap-4 overflow-x-auto px-4 scrollbar-none">
                 <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  {agencies.map(agency => {
                    const color = getAgencyColor(agency);
                    const isSelected = selectedAgency === agency;
                    return (
                      <button
                        key={agency}
                        onClick={() => setSelectedAgency(agency)}
                        style={{
                          backgroundColor: isSelected ? color : '#ffffff',
                          color: isSelected ? '#ffffff' : color,
                          borderColor: color
                        }}
                        className={`
                          px-5 py-2 rounded-lg text-sm font-bold border-2 transition-all duration-200 whitespace-nowrap
                          ${isSelected ? 'shadow-md scale-105' : 'hover:bg-slate-50 opacity-70 hover:opacity-100 hover:scale-105'}
                        `}
                      >
                        {agency}
                      </button>
                    );
                  })}
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                      onClick={handleExport}
                      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-sm text-sm font-medium transition-all whitespace-nowrap"
                      title="Export Agence Sélectionnée"
                    >
                      <Download size={16} /> 
                      <span className="hidden lg:inline">Export {selectedAgency}</span>
                    </button>

                    <button 
                      onClick={handleExportGlobal}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-sm text-sm font-medium transition-all whitespace-nowrap"
                      title="Export Global (Toutes Agences)"
                    >
                      <FileSpreadsheet size={16} /> 
                      <span className="hidden lg:inline">Export Global</span>
                    </button>
                </div>
              </div>
            )}

            {/* RIGHT: Upload Controls Section */}
            <div className="flex items-center gap-4 shrink-0">
                <HeaderUploadButton 
                    label="Interventions" 
                    subLabel="TecNow"
                    icon={<FileSpreadsheet className="w-4 h-4" />}
                    isLoading={isLoadingInt}
                    isLoaded={!!interventionData}
                    theme="tecnow"
                    onFileSelect={handleInterventionFile}
                />
                
                <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                <HeaderUploadButton 
                    label="Appels" 
                    subLabel="Genesys"
                    icon={<PhoneIncoming className="w-4 h-4" />}
                    isLoading={isLoadingCall}
                    isLoaded={!!callData}
                    theme="genesys"
                    onFileSelect={handleCallFile}
                />
            </div>

          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-8 px-4 sm:px-6">
        
        {error && (
            <div className="max-w-7xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
            <div className="mt-0.5"><AlertTriangle className="w-5 h-5" /></div>
            <div>
                <p className="font-bold">Erreur de chargement</p>
                <p className="text-sm opacity-90">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
            </div>
        )}

        {!showDashboard ? (
          <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
            <div className="text-center mb-16 mt-12">
              <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm border border-slate-100 mb-6">
                  <Database className="w-8 h-8 text-slate-400" />
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
                Analyse & Validation <span className="text-emerald-600">Centralisée</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Consolidez vos données <strong>TecNow</strong> et <strong>Genesys</strong> en un seul tableau de bord interactif pour piloter la performance de vos agences.
              </p>
            </div>
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <FeatureCard 
                    icon={<FileUp className="text-blue-500"/>}
                    title="Import Multi-Sources"
                    desc="Compatible avec les exports TecNow (ServiceNow) et les statistiques de files d'attente Genesys."
                />
                <FeatureCard 
                    icon={<ShieldCheck className="text-emerald-500" />}
                    title="Audit Qualité TecNow"
                    desc="Détection automatique des NC déclarées (Sans Contact) et analyse des motifs de rejet."
                />
                <FeatureCard 
                    icon={<PhoneIncoming className="text-orange-500" />}
                    title="KPIs Genesys"
                    desc="Visualisation immédiate de la QS, QS Nette, DMR et abandons par file."
                />
            </div>
          </div>
        ) : (
          <Dashboard 
            data={interventionData} 
            callData={callData} 
            selectedAgency={selectedAgency}
            onBack={reset} 
          />
        )}
      </main>
    </div>
  );
}

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
    <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
        <div className="mb-4 p-4 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">{icon}</div>
        <h3 className="font-bold text-slate-800 text-lg mb-2">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
);

export default App;