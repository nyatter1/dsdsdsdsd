import React from 'react';
import { Users, UserPlus, Play } from 'lucide-react';
import { FriendUser } from '../../utils/friendsStorage.ts';
import Avatar3DIcon from '../common/Avatar3DIcon.tsx';

interface HomeFriendsHeaderProps {
  friends: FriendUser[];
  onOpenFriendsTab: () => void;
  onViewProfile?: (friend: FriendUser) => void;
  onLaunchGame?: () => void;
}

export default function HomeFriendsHeader({
  friends,
  onOpenFriendsTab,
  onViewProfile,
  onLaunchGame,
}: HomeFriendsHeaderProps) {
  return (
    <section className="bg-[#202225] border border-neutral-800/90 rounded-lg p-4 sm:p-5 shadow-sm space-y-3.5">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Friends
          </h2>
          <span className="text-xs text-neutral-400 font-normal">
            ({friends.length})
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenFriendsTab}
          className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>Find &amp; Add Friends</span>
          <span>&rarr;</span>
        </button>
      </div>

      {/* Horizontal Carousel of Friends 3D Model Icons & Usernames */}
      <div className="flex items-center gap-4 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
        {/* 'Add Friend' circle button */}
        <button
          type="button"
          onClick={onOpenFriendsTab}
          className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
          title="Search & Add Friends"
        >
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-neutral-600 group-hover:border-blue-400 group-hover:bg-blue-500/10 flex items-center justify-center text-neutral-400 group-hover:text-blue-400 transition-all shadow-sm">
            <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-[11px] font-medium text-neutral-400 group-hover:text-white max-w-[64px] text-center truncate">
            Add Friend
          </span>
        </button>

        {/* Real Friends 3D Model Icons & Usernames */}
        {friends.map((friend) => (
          <div
            key={friend.uid}
            onClick={() => {
              if (onViewProfile) {
                onViewProfile(friend);
              } else if (friend.currentExperience && onLaunchGame) {
                onLaunchGame();
              } else {
                onOpenFriendsTab();
              }
            }}
            className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
            title={`${friend.displayName} (@${friend.username}) — Click to view profile`}
          >
            {/* 3D Model Icon with Online Indicator */}
            <div className="relative w-14 h-14">
              <div className="w-14 h-14 rounded-full bg-[#16181b] border-2 border-neutral-700/80 group-hover:border-blue-400 group-hover:scale-105 transition-all shadow-md overflow-hidden flex items-center justify-center">
                <Avatar3DIcon
                  colors={friend.avatarColors}
                  shirtUrl={friend.shirtUrl}
                  className="w-14 h-14"
                />
              </div>

              {/* Online Green Indicator Dot */}
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#202225] ${
                  friend.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'
                }`}
                title={friend.isOnline ? 'Online' : 'Offline'}
              />

              {/* Play Badge if in experience */}
              {friend.currentExperience && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#2a6839] border border-white flex items-center justify-center text-white shadow">
                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                </span>
              )}
            </div>

            {/* Username centered underneath 3D icon */}
            <span className="text-[11px] font-bold text-white group-hover:text-blue-400 max-w-[68px] text-center truncate">
              {friend.username}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
