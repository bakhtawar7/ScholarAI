import React from 'react';
import { APP_NAME } from '../../config/brand';

/**
 * Shared header for the four auth cards (sign in, register, forgot password, reset).
 *
 * All four repeated the same block: a 48px square with a three-stop
 * `from-brand-600 via-brand-500 to-cyan-400` gradient and a glow shadow, wrapping a
 * Sparkles icon. That combination is the visual signature of a generated template rather
 * than a product, and having it copied four times meant any change had to be made four
 * times. It is now one flat monogram, matching the landing header and the sidebar.
 */
export const AuthHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2.5 mb-5">
      <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-white">S</span>
      </div>
      <span className="font-bold text-base text-white tracking-tight">{APP_NAME}</span>
    </div>
    <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
    {subtitle && <p className="text-sm text-slate-400 mt-1.5">{subtitle}</p>}
  </div>
);
