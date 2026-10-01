import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  ShoppingBag,
  Flame,
  Zap,
  ShieldCheck,
  Star,
  Layers,
} from 'lucide-react';
import {
  BorderItem,
  getAllAvailableBorders,
  getOwnedBorderIds,
  buyBorder,
  getEquippedBorderId,
  setEquippedBorderId,
} from '../../utils/bordersStorage.ts';
import ProfileBorderWrapper from './ProfileBorderWrapper.tsx';
import Avatar3DIcon from '../common/Avatar3DIcon.tsx';
import { AvatarColors } from '../AvatarCanvas3D.tsx';

interface ProfileBorderManagerProps {
  colors: AvatarColors;
  shirtUrl: string | null;
  onOpenMarketplaceBorders?: () => void;
  onBorderEquippedChange?: (border: BorderItem | null) => void;
}

export default function ProfileBorderManager({
  colors,
  shirtUrl,
  onOpenMarketplaceBorders,
  onBorderEquippedChange,
}: ProfileBorderManagerProps) {
  const [ownedIds, setOwnedIds] = useState<string[]>(() => getOwnedBorderIds());
  const [equippedId, setEquippedIdState] = useState<string | null>(() => getEquippedBorderId());
  const [activeTabFilter, setActiveTabFilter] = useState<'All' | 'Animated' | 'Solid' | 'Gradient' | 'VIP'>('All');

  const allBorders = getAllAvailableBorders();

  const filteredBorders = allBorders.filter((b) => {
    if (activeTabFilter === 'All') return true;
    if (activeTabFilter === 'Animated') return b.isAnimated;
    if (activeTabFilter === 'Solid') return b.category === 'Solid';
    if (activeTabFilter === 'Gradient') return b.category === 'Gradient';
    if (activeTabFilter === 'VIP') return b.category === 'VIP' || b.category === 'Neon';
    return true;
  });

  const handleToggleEquip = (border: BorderItem) => {
    if (equippedId === border.id) {
      setEquippedBorderId(null);
      setEquippedIdState(null);
      if (onBorderEquippedChange) onBorderEquippedChange(null);
    } else {
      setEquippedBorderId(border.id);
      setEquippedIdState(border.id);
      if (onBorderEquippedChange) onBorderEquippedChange(border);
    }
  };

  const handleBuy = (border: BorderItem) => {
    buyBorder(border.id);
    setOwnedIds(getOwnedBorderIds());
  };

  const currentEquippedBorder = allBorders.find((b) => b.id === equippedId) || null;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Top Banner & Live Preview */}
      <div className="bg-gradient-to-r from-purple-900/30 via-indigo-950/40 to-[#202225] border border-purple-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <ProfileBorderWrapper border={currentEquippedBorder} sizeClassName="w-20 h-20">
              <Avatar3DIcon colors={colors} shirtUrl={shirtUrl} className="w-18 h-18" />
            </ProfileBorderWrapper>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                Equipped Profile Border
              </h3>
              {currentEquippedBorder?.isAnimated && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  ANIMATED
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-300 mt-1 max-w-md leading-relaxed">
              {currentEquippedBorder
                ? `Currently wearing "${currentEquippedBorder.name}". This border outline is visible across your profile and friends list!`
                : 'No profile border equipped. Select one below to deck out your profile icon!'}
            </p>
          </div>
        </div>

        {currentEquippedBorder && (
          <button
            type="button"
            onClick={() => {
              setEquippedBorderId(null);
              setEquippedIdState(null);
              if (onBorderEquippedChange) onBorderEquippedChange(null);
            }}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold rounded-xl border border-red-500/30 transition-colors cursor-pointer shrink-0"
          >
            Unequip Border
          </button>
        )}
      </div>

      {/* Category Tabs & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {(['All', 'Animated', 'Solid', 'Gradient', 'VIP'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTabFilter(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTabFilter === cat
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-[#282a2e] text-neutral-400 hover:text-white hover:bg-[#32353b]'
              }`}
            >
              {cat === 'Animated' && '✨ '}
              {cat} Borders
            </button>
          ))}
        </div>

        {onOpenMarketplaceBorders && (
          <button
            type="button"
            onClick={onOpenMarketplaceBorders}
            className="flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Marketplace ({allBorders.length} Borders)</span>
          </button>
        )}
      </div>

      {/* Grid of Profile Borders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredBorders.map((border) => {
          const isOwned = ownedIds.includes(border.id);
          const isEquipped = equippedId === border.id;

          return (
            <div
              key={border.id}
              className={`bg-[#202225] border rounded-2xl p-3.5 flex flex-col items-center text-center space-y-3 transition-all relative group ${
                isEquipped
                  ? 'border-purple-500 ring-2 ring-purple-500/50 shadow-xl bg-purple-950/10'
                  : 'border-neutral-800 hover:border-neutral-700 hover:bg-[#25282d]'
              }`}
            >
              {/* Badge */}
              {border.badgeLabel && (
                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {border.badgeLabel}
                </span>
              )}

              {/* Border Avatar Preview */}
              <div className="pt-2">
                <ProfileBorderWrapper border={border} sizeClassName="w-16 h-16">
                  <Avatar3DIcon colors={colors} shirtUrl={shirtUrl} className="w-14 h-14" />
                </ProfileBorderWrapper>
              </div>

              {/* Border Info */}
              <div className="w-full space-y-1">
                <h4 className="text-xs font-bold text-white truncate" title={border.name}>
                  {border.name}
                </h4>
                <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-400">
                  {border.isAnimated ? (
                    <span className="text-purple-400 font-semibold flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> Animated
                    </span>
                  ) : (
                    <span>{border.category}</span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="w-full pt-1">
                {isOwned ? (
                  <button
                    type="button"
                    onClick={() => handleToggleEquip(border)}
                    className={`w-full py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      isEquipped
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-[#2b2d31] hover:bg-[#34373c] text-neutral-200 border border-neutral-700'
                    }`}
                  >
                    {isEquipped ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Equipped</span>
                      </>
                    ) : (
                      <span>Equip</span>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBuy(border)}
                    className="w-full py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs border border-emerald-500/30 transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ShoppingBag className="w-3 h-3 text-emerald-400" />
                    <span>Get Free</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
