import React, { useCallback } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import clsx from 'clsx';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
      className={clsx(
        "group w-full max-w-2xl mx-auto p-12 border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out text-center cursor-pointer bg-white relative overflow-hidden",
        isLoading 
            ? "opacity-60 cursor-wait border-slate-200" 
            : "border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 hover:shadow-lg hover:-translate-y-1"
      )}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input 
        type="file" 
        id="fileInput" 
        className="hidden" 
        accept=".csv,.xlsx,.xls" 
        onChange={handleChange}
        disabled={isLoading}
      />
      <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center justify-center relative z-10">
        {isLoading ? (
          <div className="flex flex-col items-center">
             <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600 mb-4"></div>
             <p className="text-blue-600 font-medium animate-pulse">Lecture du fichier en cours...</p>
          </div>
        ) : (
          <>
            <div className="bg-blue-100/50 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300">
                <UploadCloud className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">
              Glissez votre fichier ici
            </h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              Ou cliquez pour parcourir vos dossiers. Supporte Excel (.xlsx) et CSV.
            </p>
            
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 uppercase tracking-wide">
              <FileSpreadsheet className="w-4 h-4" />
              Extraction Interventions
            </div>
          </>
        )}
      </label>
    </div>
  );
};