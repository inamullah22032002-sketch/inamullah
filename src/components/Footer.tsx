import React from 'react';
import { Film, Shield, HardDrive, Radio } from 'lucide-react';

interface FooterProps {
  onNavigate?: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="w-full bg-[#05060a] border-t border-white/[0.06] pt-12 pb-8 mt-20 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-slate-950 font-bold">
                <Film className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-white font-heading">
                Funclub<span className="text-cyan-400">SI</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Next-generation streaming discovery platform powered by Cloudflare R2 direct multipart architecture.
            </p>
            <div className="flex items-center gap-3 text-[11px] text-cyan-400 font-mono">
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                Cluster Live
              </span>
              <span>·</span>
              <span>R2 Direct S3</span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-white font-semibold text-xs tracking-wider uppercase mb-3 font-heading">
              Explore
            </h4>
            <ul className="space-y-2">
              <li>
                <button onClick={() => onNavigate?.('/browse')} className="hover:text-cyan-400 transition-colors">
                  Featured Discoveries
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate?.('/movies')} className="hover:text-cyan-400 transition-colors">
                  Cinematic Movies
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate?.('/tv')} className="hover:text-cyan-400 transition-colors">
                  Television Shows
                </button>
              </li>
            </ul>
          </div>

          {/* Architecture & Storage */}
          <div>
            <h4 className="text-white font-semibold text-xs tracking-wider uppercase mb-3 font-heading">
              Architecture
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                Cloudflare R2 Object Store
              </li>
              <li className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Strict SSRF Protection
              </li>
              <li>S3 Multipart Chunked Upload</li>
              <li>PostgreSQL Persistence</li>
            </ul>
          </div>

          {/* Admin & Security */}
          <div>
            <h4 className="text-white font-semibold text-xs tracking-wider uppercase mb-3 font-heading">
              Administration
            </h4>
            <p className="text-slate-400 text-xs mb-3">
              Separate administrative authentication gateway.
            </p>
            <button
              onClick={() => onNavigate?.('/admin/login')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 hover:border-cyan-500/40 text-cyan-300 text-xs hover:bg-cyan-950/40 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              Admin Portal
            </button>
          </div>
        </div>

        <div className="pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} FunclubSI. All rights reserved.</p>
          <p className="text-slate-400">
            Compliant metadata indexing only. No piracy scrapers or bypass tools.
          </p>
        </div>
      </div>
    </footer>
  );
};
