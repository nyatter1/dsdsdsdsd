import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle2,
  X,
  Gamepad2,
  Sparkles,
  ShieldCheck,
  ArrowDownToLine,
  Flame,
} from 'lucide-react';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadAppModal({ isOpen, onClose }: DownloadAppModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownloadApp = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const response = await fetch('/api/download-app');
      if (!response.ok) {
        throw new Error('Failed to download app package');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Rovix_App.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback direct download
      window.location.href = '/api/download-app';
      setIsDownloading(false);
      setDownloadSuccess(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none font-sans">
      <div className="bg-[#1f2125] border border-neutral-700/80 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-900/50 via-indigo-900/40 to-neutral-900/60 p-5 sm:p-6 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg border border-blue-400/40 shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Download Rovix App
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  OFFICIAL APP
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Full 3D graphics, touch controls, and real-time multiplayer
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
              onClick={handleDownloadApp}
              disabled={isDownloading}
              className="w-full py-4 px-5 rounded-xl bg-gradient-to-r from-blue-600 hover:from-blue-500 to-indigo-600 hover:to-indigo-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl shadow-blue-600/30 transition-all transform active:scale-98 cursor-pointer border border-blue-400/40"
            >
              {isDownloading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Preparing Download...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-300">Rovix App Downloaded!</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-5 h-5" />
                  <span>Download App</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-neutral-400 text-center font-medium">
              Download and install Rovix to play anywhere on your device.
            </p>
          </div>

          {/* Included Features */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              App Features &amp; Controls
            </h4>
            <div className="space-y-2 bg-[#17181a] border border-neutral-800/80 rounded-xl p-3.5 text-xs text-neutral-300">
              <div className="flex items-center gap-2.5">
                <Gamepad2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span><strong>Mobile Controls:</strong> Virtual touch thumbstick &amp; dedicated jump button</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span><strong>Full 3D Engine:</strong> Smooth rendering, avatar customizer &amp; marketplace</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <span><strong>Multiplayer:</strong> Real-time rooms, friends list &amp; live chat</span>
              </div>
            </div>
          </div>

          {/* Installation Steps */}
          <div className="bg-[#24272c] border border-neutral-700/80 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Smartphone className="w-4 h-4 text-blue-400" />
              <span>Easy Installation Guide:</span>
            </div>
            <div className="bg-[#18191c] rounded-lg p-3 text-[11px] text-neutral-300 space-y-1.5 border border-neutral-800 leading-relaxed">
              <div>1. Tap <strong>Download App</strong> above to get the package.</div>
              <div>2. Open the downloaded file on your device.</div>
              <div>3. Follow the quick on-screen prompt to launch Rovix and play!</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#17181a] border-t border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Safe &amp; direct official download</span>
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
