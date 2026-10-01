import React from 'react';
import {
  User,
  Shirt as ShirtIcon,
  Hammer,
  ShoppingBag,
  Users,
  Compass,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
  Shield,
  HelpCircle,
  Smartphone,
  Download,
  FolderArchive,
} from 'lucide-react';
import Avatar3DIcon from '../common/Avatar3DIcon.tsx';
import { AvatarColors } from '../AvatarCanvas3D.tsx';

interface MoreHubViewProps {
  username: string;
  displayName: string;
  avatarColors: AvatarColors;
  shirtUrl: string | null;
  onNavigateToMyProfile: () => void;
  onNavigateToAvatar: () => void;
  onNavigateToStudio: () => void;
  onNavigateToMarketplace: () => void;
  onNavigateToFriends: () => void;
  onNavigateToDiscover: () => void;
  onDownloadZip?: () => void;
  onLogOut: () => void;
}

export default function MoreHubView({
  username,
  displayName,
  avatarColors,
  shirtUrl,
  onNavigateToMyProfile,
  onNavigateToAvatar,
  onNavigateToStudio,
  onNavigateToMarketplace,
  onNavigateToFriends,
  onNavigateToDiscover,
  onDownloadZip,
  onLogOut,
}: MoreHubViewProps) {
  const menuItems = [
    {
      id: 'my-profile',
      title: 'My Profile',
      subtitle: 'View your 3D avatar, creations, and bio',
      icon: User,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      action: onNavigateToMyProfile,
      highlight: true,
    },
    {
      id: 'download-zip',
      title: 'Download Entire Site (.ZIP)',
      subtitle: 'Download complete source code, 3D engine & assets in a zip file',
      icon: FolderArchive,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      action: onDownloadZip,
    },
    {
      id: 'avatar',
      title: 'Avatar Editor',
      subtitle: 'Change skin tone, equip shirts, pants & backgrounds',
      icon: ShirtIcon,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      action: onNavigateToAvatar,
    },
    {
      id: 'studio',
      title: 'Rovix Studio',
      subtitle: 'Build 3D games, places & write Lua scripts',
      icon: Hammer,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      action: onNavigateToStudio,
    },
    {
      id: 'marketplace',
      title: 'Marketplace Catalog',
      subtitle: 'Browse custom clothing, shirts, pants & backgrounds',
      icon: ShoppingBag,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      action: onNavigateToMarketplace,
    },
    {
      id: 'friends',
      title: 'Friends & Followers',
      subtitle: 'Check friend requests and see who is online',
      icon: Users,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      action: onNavigateToFriends,
    },
    {
      id: 'discover',
      title: 'Discover Games',
      subtitle: 'Explore community experiences and multiplayer worlds',
      icon: Compass,
      color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
      action: onNavigateToDiscover,
    },
  ];

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6 animate-fade-in select-none font-sans">
      {/* 1. TOP USER CARD (MY PROFILE PROMINENT) */}
      <div
        onClick={onNavigateToMyProfile}
        className="bg-gradient-to-r from-[#202328] to-[#1a1c1f] border border-neutral-700/80 hover:border-neutral-500 rounded-2xl p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all shadow-lg group"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-blue-400/80 bg-[#16181b] flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <Avatar3DIcon colors={avatarColors} shirtUrl={shirtUrl} className="w-14 h-14 sm:w-16 sm:h-16" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white group-hover:text-blue-400 transition-colors">
                {displayName || username}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                YOU
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">@{username}</p>
            <p className="text-xs text-blue-400 font-medium mt-1 flex items-center gap-1">
              <span>View My Profile</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </p>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors" />
      </div>

      {/* 2. GRID OF MENU OPTIONS */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
          Navigation &amp; Features
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className="bg-[#202225] hover:bg-[#272a2e] border border-neutral-800 hover:border-neutral-600 rounded-xl p-3.5 flex items-center justify-between text-left transition-all shadow-sm cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center border shrink-0 ${item.color} group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-neutral-100">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-neutral-400 line-clamp-1">{item.subtitle}</p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. LOG OUT BUTTON */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onLogOut}
          className="w-full py-3 px-4 rounded-xl bg-red-950/30 hover:bg-red-950/50 border border-red-800/40 text-red-400 hover:text-red-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out of @{username}</span>
        </button>
      </div>
    </div>
  );
}
