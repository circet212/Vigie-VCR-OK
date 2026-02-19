import React, { useMemo, useState } from 'react';
import { getCallFileDebugInfo } from '../utils/dataProcessing';
import { X, Check, AlertTriangle, HelpCircle, Monitor, Clipboard, Eye } from 'lucide-react';

interface DebugPanelProps {
    callDataRaw: any[] | null;
    selectedAgency: string;
    visualDiagnostics?: any; // New prop for visual metrics
    onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ callDataRaw, selectedAgency, visualDiagnostics, onClose }) => {
    const [activeTab, setActiveTab] = useState<'data' | 'render'>(callDataRaw ? 'data' : 'render');

    const debugInfo = useMemo(() => {
        if (!callDataRaw) return null;
        return getCallFileDebugInfo(callDataRaw, selectedAgency);
    }, [callDataRaw, selectedAgency]);

    const handleCopyDiagnostics = () => {
        if (visualDiagnostics) {
            navigator.clipboard.writeText(JSON.stringify(visualDiagnostics, null, 2));
            alert("Rapport technique copié !");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <BugIcon className="text-yellow-400" />
                            Panneau de Diagnostic
                        </h2>
                        <p className="text-xs text-slate-300">Analyse technique des données et du rendu</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-slate-700 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    {callDataRaw && (
                        <button 
                            onClick={() => setActiveTab('data')}
                            className={`px-6 py-3 text-sm font-medium ${activeTab === 'data' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Données Appels
                        </button>
                    )}
                    <button 
                        onClick={() => setActiveTab('render')}
                        className={`px-6 py-3 text-sm font-medium ${activeTab === 'render' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Rendu & Visuel
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    
                    {activeTab === 'data' && debugInfo && (
                        <>
                        {/* 1. Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-500 uppercase font-bold">Lignes Totales</div>
                                <div className="text-2xl font-bold text-slate-800">{debugInfo.totalRows}</div>
                            </div>
                            <div className={`p-4 rounded-lg border ${debugInfo.matchingRows > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <div className={`text-xs uppercase font-bold ${debugInfo.matchingRows > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Lignes Conservées (Match)
                                </div>
                                <div className={`text-2xl font-bold ${debugInfo.matchingRows > 0 ? 'text-green-800' : 'text-red-800'}`}>
                                    {debugInfo.matchingRows}
                                </div>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                <div className="text-xs text-orange-600 uppercase font-bold">Lignes Rejetées</div>
                                <div className="text-sm mt-1 text-orange-800 font-medium">
                                    Agence incorrecte: {debugInfo.agencyMismatchCount}
                                </div>
                            </div>
                        </div>

                        {/* 2. Column Detection */}
                        <div>
                            <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">Détection des Colonnes</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {Object.entries(debugInfo.columnsFound || {}).map(([key, colName]) => (
                                    <div key={key} className="flex items-center gap-2 text-sm bg-green-50 px-3 py-2 rounded border border-green-100">
                                        <Check size={14} className="text-green-600 shrink-0" />
                                        <div className="truncate">
                                            <span className="font-semibold text-slate-700 capitalize">{key}:</span> <span className="text-slate-500 italic">"{colName}"</span>
                                        </div>
                                    </div>
                                ))}
                                {debugInfo.columnsMissing?.map((key) => (
                                    <div key={key} className="flex items-center gap-2 text-sm bg-red-50 px-3 py-2 rounded border border-red-100">
                                        <X size={14} className="text-red-600 shrink-0" />
                                        <span className="font-semibold text-red-700 capitalize">{key} (Introuvable)</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Sample Data Analysis */}
                        <div>
                             <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">Analyse des 5 premières lignes</h3>
                             <div className="overflow-x-auto">
                                 <table className="w-full text-xs text-left">
                                     <thead className="bg-slate-100 text-slate-600 uppercase">
                                         <tr>
                                             <th className="px-3 py-2">Filtre (Agence)</th>
                                             <th className="px-3 py-2">Col. Agence (Queue)</th>
                                             <th className="px-3 py-2">Statut</th>
                                         </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-100">
                                         {debugInfo.sampleData?.map((row, i) => (
                                             <tr key={i} className={row.matched ? 'bg-green-50/50' : 'bg-red-50/50'}>
                                                 <td className="px-3 py-2 font-mono">
                                                     {selectedAgency}
                                                 </td>
                                                 <td className="px-3 py-2 font-mono text-slate-700">"{row.queue}"</td>
                                                 <td className="px-3 py-2">
                                                     {row.matched ? (
                                                         <span className="flex items-center gap-1 text-green-700 font-bold"><Check size={12}/> OK</span>
                                                     ) : (
                                                         <span className="flex items-center gap-1 text-red-600 font-medium"><X size={12}/> {row.reason}</span>
                                                     )}
                                                 </td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                        </div>
                        </>
                    )}

                    {activeTab === 'render' && (
                        <div className="space-y-4">
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 flex justify-between items-start">
                                <div>
                                    <h3 className="text-purple-900 font-bold flex items-center gap-2">
                                        <Monitor size={18}/> Diagnostic de Rendu (Screenshot)
                                    </h3>
                                    <p className="text-sm text-purple-700 mt-1">
                                        Copiez ces informations et envoyez-les au développeur pour corriger les problèmes de décalage d'image.
                                    </p>
                                </div>
                                <button 
                                    onClick={handleCopyDiagnostics}
                                    className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-purple-700"
                                >
                                    <Clipboard size={16}/> Copier le rapport
                                </button>
                            </div>

                            <div className="relative">
                                <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg text-xs font-mono overflow-auto max-h-[400px] border border-slate-700 shadow-inner">
                                    {visualDiagnostics ? JSON.stringify(visualDiagnostics, null, 2) : "// Aucune donnée de diagnostic disponible.\n// Veuillez fermer ce panneau, puis cliquer sur l'icône 'Insecte' pour rafraîchir."}
                                </pre>
                            </div>

                            <div className="bg-white border border-slate-200 p-4 rounded-lg">
                                <h4 className="font-bold text-slate-700 mb-2 text-sm">Astuces pour la capture :</h4>
                                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                                    <li>Assurez-vous que la fenêtre du navigateur est en 100% (pas de zoom).</li>
                                    <li>Ne redimensionnez pas la fenêtre pendant la capture.</li>
                                    <li>Si le texte est coupé en bas, c'est souvent un problème de hauteur de ligne (line-height) ou de police non standard.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                </div>

                <div className="p-4 bg-slate-50 border-t flex justify-end">
                    <button onClick={onClose} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-900">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

const BugIcon = ({ className }: { className?: string }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <rect width="8" height="14" x="8" y="6" rx="4" />
      <path d="m19 7-3 2" /><path d="m5 7 3 2" />
      <path d="m19 19-3-2" /><path d="m5 19 3-2" />
      <path d="M20 13h-4" /><path d="M4 13h4" />
      <path d="m10 4 1 2" /><path d="m14 4-1 2" />
    </svg>
);
