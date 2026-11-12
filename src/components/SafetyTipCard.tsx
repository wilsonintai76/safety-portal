import React, { useState } from 'react';
import { Lightbulb, RotateCw, ShieldCheck, BookOpen, CheckCircle2, Award } from 'lucide-react';
import { SafetyTip, SafetyTipLibrary } from '../data/safetyTips';

interface SafetyTipCardProps {
  currentTip: SafetyTip;
  onRotateTip: () => void;
}

export const SafetyTipCard: React.FC<SafetyTipCardProps> = ({ currentTip, onRotateTip }) => {
  const [isRotating, setIsRotating] = useState(false);

  const handleRotateClick = () => {
    setIsRotating(true);
    onRotateTip();
    setTimeout(() => {
      setIsRotating(false);
    }, 400);
  };

  // Color mapping based on category
  const categoryStyles: Record<string, { badge: string; border: string; bg: string; text: string }> = {
    'Mesin & Peralatan': {
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
      border: 'border-amber-200',
      bg: 'bg-linear-to-br from-amber-500/10 via-amber-50/50 to-white',
      text: 'text-amber-900'
    },
    PPE: {
      badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      border: 'border-emerald-200',
      bg: 'bg-linear-to-br from-emerald-500/10 via-emerald-50/50 to-white',
      text: 'text-emerald-900'
    },
    Elektrik: {
      badge: 'bg-yellow-100 text-yellow-950 border-yellow-300',
      border: 'border-yellow-200',
      bg: 'bg-linear-to-br from-yellow-500/10 via-amber-50/50 to-white',
      text: 'text-yellow-950'
    },
    Kimia: {
      badge: 'bg-purple-100 text-purple-900 border-purple-300',
      border: 'border-purple-200',
      bg: 'bg-linear-to-br from-purple-500/10 via-purple-50/50 to-white',
      text: 'text-purple-900'
    },
    Ergonomik: {
      badge: 'bg-teal-100 text-teal-900 border-teal-300',
      border: 'border-teal-200',
      bg: 'bg-linear-to-br from-teal-500/10 via-teal-50/50 to-white',
      text: 'text-teal-900'
    },
    Kecemasan: {
      badge: 'bg-rose-100 text-rose-900 border-rose-300',
      border: 'border-rose-200',
      bg: 'bg-linear-to-br from-rose-500/10 via-rose-50/50 to-white',
      text: 'text-rose-900'
    },
    'Kebersihan (Housekeeping)': {
      badge: 'bg-blue-100 text-blue-900 border-blue-300',
      border: 'border-blue-200',
      bg: 'bg-linear-to-br from-blue-500/10 via-blue-50/50 to-white',
      text: 'text-blue-900'
    }
  };

  const style = categoryStyles[currentTip.category] || categoryStyles['PPE'];

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} p-5 shadow-xs relative overflow-hidden transition-all duration-300`}>
      {/* Background Icon Watermark */}
      <div className="absolute right-3 bottom-1 opacity-5 pointer-events-none transform translate-x-4 translate-y-4">
        <Lightbulb className="w-48 h-48 text-slate-900" />
      </div>

      <div className="relative z-10 space-y-3.5">
        {/* Card Header & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <Lightbulb className="w-4 h-4 fill-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Petua Keselamatan Hari Ini
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-200">
                  OSH / OSHA 1994
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                Panduan Amalan Selamat Bengkel &amp; Makmal JKM PKS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${style.badge}`}>
              {currentTip.category}
            </span>

            <button
              type="button"
              onClick={handleRotateClick}
              className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
              title="Putar &amp; paparkan petua keselamatan lain secara rawak"
            >
              <RotateCw className={`w-3.5 h-3.5 text-emerald-700 ${isRotating ? 'animate-spin' : ''}`} />
              <span>Putar Petua 🎲</span>
            </button>
          </div>
        </div>

        {/* Tip Content */}
        <div className="space-y-2">
          <h4 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
            {currentTip.title}
          </h4>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
            {currentTip.tip}
          </p>
        </div>

        {/* Action Highlight & Legal Reference Strip */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-slate-200/60">
          <div className="flex items-center gap-1.5 text-emerald-900 font-medium bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="text-[11px]">
              <strong>Tindakan Disyorkan:</strong> {currentTip.recommendedAction}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0 font-mono bg-white/80 px-2 py-0.5 rounded border border-slate-200">
            <BookOpen className="w-3 h-3 text-slate-400" />
            <span>{currentTip.actReference}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
