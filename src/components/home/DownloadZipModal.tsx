import React, { useState } from 'react';
import {
  Download,
  FolderArchive,
  CheckCircle2,
  X,
  FileCode,
  Layers,
  Terminal,
  ShieldCheck,
  Sparkles,
  ArrowDownToLine,
} from 'lucide-react';

interface DownloadZipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadZipModal({ isOpen, onClose }: DownloadZipModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const response = await fetch('/api/download-zip');
      if (!response.ok) {
        throw new Error('Failed to generate ZIP archive from server');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Rovix_Complete_Site.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback: direct window download trigger
      window.location.href = '/api/download-zip';
      setIsDownloading(false);
      setDownloadSuccess(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none font-sans">
      <div className="bg-[#1f2125] border border-neutral-700/80 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-neutral-900/60 p-5 sm:p-6 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg border border-blue-400/40 shrink-0">
              <FolderArchive className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Download Entire Site (.ZIP)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  FULL SOURCE
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Complete codebase, 3D engine, assets &amp; multiplayer backend
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Main Download Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="w-full py-4 px-5 rounded-xl bg-gradient-to-r from-blue-600 hover:from-blue-500 to-indigo-600 hover:to-indigo-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl shadow-blue-600/30 transition-all transform active:scale-98 cursor-pointer border border-blue-400/40"
            >
              {isDownloading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating &amp; Compressing .ZIP...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-300">Rovix_Complete_Site.zip Downloaded!</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-5 h-5" />
                  <span>Download Complete Site (.ZIP)</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-neutral-400 text-center font-medium">
              Downloads the complete project archive ready to extract and run anywhere.
            </p>
          </div>

          {/* Included in this ZIP */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Included in the ZIP Archive
            </h4>
            <div className="space-y-2 bg-[#17181a] border border-neutral-800/80 rounded-xl p-3.5 text-xs text-neutral-300">
              <div className="flex items-center gap-2.5">
                <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                <span><strong>Full Frontend:</strong> React 19, Three.js 3D Viewport, Tailwind CSS &amp; Vite</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-purple-400 shrink-0" />
                <span><strong>Game Engine:</strong> Character physics, Lua script executor &amp; Roblox GUI</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span><strong>Studio &amp; Avatar:</strong> Rovix 3D Studio, Clothing UV textures &amp; Marketplace</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Backend Server:</strong> Node.js + Express + WebSocket real-time rooms</span>
              </div>
            </div>
          </div>

          {/* How to run locally */}
          <div className="bg-[#24272c] border border-neutral-700/80 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span>How to Run Locally on Your Machine:</span>
            </div>
            <div className="bg-[#18191c] rounded-lg p-3 font-mono text-[11px] text-neutral-300 space-y-1.5 border border-neutral-800">
              <div className="text-neutral-500"># 1. Extract the ZIP file</div>
              <div className="text-blue-300">unzip Rovix_Complete_Site.zip</div>
              <div className="text-neutral-500 mt-2"># 2. Install dependencies</div>
              <div className="text-blue-300">npm install</div>
              <div className="text-neutral-500 mt-2"># 3. Start the engine server &amp; web app</div>
              <div className="text-emerald-400">npm run dev</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#17181a] border-t border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Clean, complete zip with all project files</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#2b2d31] hover:bg-[#34373c] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
