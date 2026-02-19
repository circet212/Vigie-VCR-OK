import React from 'react';

interface AnalysisTableProps {
  title: string;
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
  footer?: (string | number | React.ReactNode)[];
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({ title, headers, rows, footer }) => {
  return (
    <div className="w-full flex flex-col rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      {title && (
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <h4 className="font-semibold text-slate-800 text-sm tracking-wide">{title}</h4>
        </div>
      )}
      
      <div className="overflow-x-auto overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-slate-500 uppercase bg-white sticky top-0 z-10 shadow-sm">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-5 py-3 font-semibold border-b border-slate-100 tracking-wider whitespace-nowrap bg-slate-50/80 backdrop-blur-sm">
                    {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-5 py-8 text-center text-slate-400 italic bg-slate-50/30">
                  Aucune donnée disponible pour cette sélection.
                </td>
              </tr>
            )}
          </tbody>
          {footer && (
            <tfoot className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-100 sticky bottom-0 z-10">
              <tr>
                {footer.map((f, i) => (
                  <td key={i} className="px-5 py-3 whitespace-nowrap shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">{f}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};