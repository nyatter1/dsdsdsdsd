import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Play,
  Hammer,
  ChevronRight,
  MoreHorizontal,
  ArrowLeft,
  X,
  Check,
  LayoutList,
  LayoutGrid,
  UserPlus,
  UserMinus,
  Heart,
  Pencil,
  Image as ImageIcon,
  EyeOff,
} from 'lucide-react';
import ProfileBust3D from './profile/ProfileBust3D.tsx';
import ProfileBanner3D from './profile/ProfileBanner3D.tsx';
import ProfileAvatar2D from './profile/ProfileAvatar2D.tsx';
import { AvatarColors } from './AvatarCanvas3D.tsx';
import { SavedGame } from '../utils/gamesStorage.ts';
import { getStoredInventory } from '../utils/inventoryStorage.ts';
import ClothingDummyPreview from './marketplace/ClothingDummyPreview.tsx';
import MarketplaceItemDetailsView from './marketplace/MarketplaceItemDetailsView.tsx';
import { MarketplaceItem, findMarketplaceItemByUrl } from '../utils/marketplaceItems.ts';
import {
  FriendUser,
  subscribeToMyFriends,
  subscribeToFollowing,
  subscribeToFollowers,
} from '../utils/friendsStorage.ts';
import { db, auth, doc, updateDoc, onSnapshot } from '../utils/firebase.ts';

export interface UserProfileViewProps {
  viewingUser?: FriendUser | null;
  currentUserId?: string;
  colors: AvatarColors;
  shirtUrl: string | null;
  pantsUrl: string | null;
  backgroundUrl?: string | null;
  savedGames: SavedGame[];
  onPlayGame: (game: SavedGame) => void;
  onOpenStudio: (game?: SavedGame) => void;
  onNavigateToAvatar: () => void;
  onViewMyProfile?: () => void;
  onEquipShirt?: (url: string | null) => void;
  onEquipPants?: (url: string | null) => void;
  onBack?: () => void;
  onProfileUpdated?: (newDisplayName: string, newBio: string) => void;
  onAddFriend?: (target: FriendUser) => void;
  onRemoveFriend?: (targetUid: string) => void;
  onToggleFollow?: (target: FriendUser) => void;
  isFriend?: boolean;
  isFollowing?: boolean;
  isReqPending?: boolean;
}

const STORAGE_KEY_PROFILE = 'rovix_user_profile_v3';

interface ProfileData {
  displayName: string;
  username: string;
  bio: string;
  friendsCount: number;
  followersCount: number;
  followingCount: number;
}

export default function UserProfileView({
  viewingUser,
  currentUserId,
  colors,
  shirtUrl,
  pantsUrl,
  backgroundUrl,
  savedGames,
  onPlayGame,
  onOpenStudio,
  onNavigateToAvatar,
  onViewMyProfile,
  onEquipShirt,
  onEquipPants,
  onBack,
  onProfileUpdated,
  onAddFriend,
  onRemoveFriend,
  onToggleFollow,
  isFriend = false,
  isFollowing = false,
  isReqPending = false,
}: UserProfileViewProps) {
  // Robust check for own profile (matches currentUserId, auth.currentUser, or logged-in username)
  const storedUserRaw = typeof window !== 'undefined' ? localStorage.getItem('rovix_current_user_v1') : null;
  const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
  const myUid = currentUserId || storedUser?.uid || auth.currentUser?.uid;
  const myUsername = (storedUser?.username || '').toLowerCase().replace('@', '');
  const viewingUsername = (viewingUser?.username || '').toLowerCase().replace('@', '');

  const isOwnProfile =
    !viewingUser ||
    (Boolean(myUid) && viewingUser.uid === myUid) ||
    (Boolean(myUsername) && viewingUsername === myUsername) ||
    viewingUser.uid === 'local';

  // Active target UID for live stats & Firestore document
  const targetUid = isOwnProfile ? (currentUserId || 'local') : viewingUser?.uid || 'local';

  // Live Firestore User Document sync for 100% real-time clothing, background, and profile info
  const [liveUserData, setLiveUserData] = useState<{
    displayName?: string;
    username?: string;
    avatarColors?: AvatarColors;
    shirtUrl?: string | null;
    pantsUrl?: string | null;
    backgroundUrl?: string | null;
    bio?: string;
  } | null>(null);

  useEffect(() => {
    if (!targetUid || targetUid === 'local' || !db) return;
    try {
      const unsub = onSnapshot(doc(db, 'users', targetUid), (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setLiveUserData({
            displayName: d.displayName || d.username,
            username: d.username,
            avatarColors: d.avatarColors,
            shirtUrl: d.activeShirtUrl || d.shirtUrl || null,
            pantsUrl: d.activePantsUrl || d.pantsUrl || null,
            backgroundUrl: d.equippedBackgroundUrl || d.backgroundUrl || null,
            bio: d.bio || '',
          });
        }
      });
      return () => unsub();
    } catch {}
  }, [targetUid]);

  const activeColors: AvatarColors = liveUserData?.avatarColors || (isOwnProfile
    ? colors
    : viewingUser?.avatarColors || { head: '#f5cd2f', torso: '#0d69ac', leftArm: '#f5cd2f', rightArm: '#f5cd2f', leftLeg: '#a0a528', rightLeg: '#a0a528' });
  const activeShirt = liveUserData?.shirtUrl !== undefined ? liveUserData.shirtUrl : (isOwnProfile ? shirtUrl : viewingUser?.shirtUrl || null);
  const activePants = liveUserData?.pantsUrl !== undefined ? liveUserData.pantsUrl : (isOwnProfile ? pantsUrl : viewingUser?.pantsUrl || null);
  const activeBackground = liveUserData?.backgroundUrl !== undefined ? liveUserData.backgroundUrl : (isOwnProfile ? (backgroundUrl || null) : (viewingUser?.backgroundUrl || null));

  // Load persistent profile details for self
  const [profile, setProfile] = useState<ProfileData>(() => {
    if (!isOwnProfile && viewingUser) {
      return {
        displayName: viewingUser.displayName || viewingUser.username,
        username: `@${viewingUser.username}`,
        bio: (viewingUser as any).bio || `Hello! I'm ${viewingUser.username} on Rovix.`,
        friendsCount: 0,
        followersCount: 0,
        followingCount: 0,
      };
    }
    try {
      const userRaw = localStorage.getItem('rovix_current_user_v1');
      if (userRaw) {
        const userObj = JSON.parse(userRaw);
        if (userObj.username) {
          return {
            displayName: userObj.displayName || userObj.username,
            username: `@${userObj.username}`,
            bio: userObj.bio || `Hello! I'm ${userObj.username} on Rovix!`,
            friendsCount: 0,
            followersCount: 0,
            followingCount: 0,
          };
        }
      }
      const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.displayName) {
          return parsed;
        }
      }
    } catch {}
    return {
      displayName: 'Player',
      username: '@Player',
      bio: '',
      friendsCount: 0,
      followersCount: 0,
      followingCount: 0,
    };
  });

  // Live counts for Friends, Followers, and Following
  useEffect(() => {
    if (!targetUid) return;

    const unsubFriends = subscribeToMyFriends(targetUid, (list) => {
      setProfile((prev) => ({ ...prev, friendsCount: list.length }));
    });
    const unsubFollowing = subscribeToFollowing(targetUid, (list) => {
      setProfile((prev) => ({ ...prev, followingCount: list.length }));
    });
    const unsubFollowers = subscribeToFollowers(targetUid, (list) => {
      setProfile((prev) => ({ ...prev, followersCount: list.length }));
    });

    return () => {
      unsubFriends();
      unsubFollowing();
      unsubFollowers();
    };
  }, [targetUid]);
  useEffect(() => {
    if (isOwnProfile) {
      try {
        const userRaw = localStorage.getItem('rovix_current_user_v1');
        if (userRaw) {
          const userObj = JSON.parse(userRaw);
          if (userObj.username) {
            setProfile({
              displayName: userObj.displayName || userObj.username,
              username: `@${userObj.username}`,
              bio: userObj.bio || `Hello! I'm ${userObj.username} on Rovix!`,
              friendsCount: 0,
              followersCount: 0,
              followingCount: 0,
            });
            return;
          }
        }
        const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.displayName) {
            setProfile(parsed);
            return;
          }
        }
      } catch {}
      setProfile({
        displayName: 'Player',
        username: '@Player',
        bio: '',
        friendsCount: 0,
        followersCount: 0,
        followingCount: 0,
      });
    } else if (viewingUser) {
      setProfile({
        displayName: viewingUser.displayName || viewingUser.username,
        username: `@${viewingUser.username}`,
        bio: (viewingUser as any).bio || `Hello! I'm ${viewingUser.username} on Rovix.`,
        friendsCount: 0,
        followersCount: 0,
        followingCount: 0,
      });
    }
  }, [viewingUser, isOwnProfile]);

  // Edit profile modal state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');

  // 3-dots more menu dropdown state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Bio expanded state (more / less)
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // Active profile tab: 'About' or 'Creations'
  const [activeTab, setActiveTab] = useState<'About' | 'Creations'>('About');

  // Banner view mode: default 3D
  const [isBanner3D, setIsBanner3D] = useState(true);

  // Creations view mode: 'list' or 'grid'
  const [creationsViewMode, setCreationsViewMode] = useState<'list' | 'grid'>('list');

  // Selected marketplace item for Details View
  const [selectedMarketplaceItem, setSelectedMarketplaceItem] = useState<MarketplaceItem | null>(null);

  // Selected experience for Details Page
  const [selectedGame, setSelectedGame] = useState<SavedGame | null>(null);

  // Experience sub tab
  const [expSubTab, setExpSubTab] = useState<'About' | 'Store' | 'Servers'>('About');

  // Real clothing inventory
  const inventory = getStoredInventory();

  // ONLY items currently worn: Background + Shirt + Pants
  const wearingItems: {
    id: string;
    name: string;
    type: 'shirt' | 'pants' | 'background';
    url: string;
    isEquipped: boolean;
  }[] = [];

  // Background in Currently Wearing
  if (activeBackground) {
    wearingItems.push({
      id: 'equipped_background',
      name: 'Profile Background',
      type: 'background',
      url: activeBackground,
      isEquipped: true,
    });
  }

  if (activeShirt) {
    const matching = inventory.shirts.find((s) => s.dataUrl === activeShirt);
    wearingItems.push({
      id: 'equipped_shirt',
      name: matching?.name || 'Classic Shirt',
      type: 'shirt',
      url: activeShirt,
      isEquipped: true,
    });
  }

  if (activePants) {
    const matching = inventory.pants.find((p) => p.dataUrl === activePants);
    wearingItems.push({
      id: 'equipped_pants',
      name: matching?.name || 'Classic Jeans',
      type: 'pants',
      url: activePants,
      isEquipped: true,
    });
  }

  // Filter creations for this profile's user (shows their exact creations whether public or private)
  const targetUsernameClean = (
    isOwnProfile
      ? profile.username.replace('@', '')
      : viewingUser?.username || profile.username.replace('@', '')
  ).toLowerCase();
  const targetDisplayNameClean = (
    isOwnProfile
      ? profile.displayName
      : viewingUser?.displayName || profile.displayName
  ).toLowerCase();

  const displayGames = savedGames.filter((g) => {
    const creatorClean = (g.creator || '').toLowerCase();
    const matchesUser =
      (g.creatorId && (g.creatorId === targetUid || (isOwnProfile && g.creatorId === currentUserId))) ||
      (targetUsernameClean && (creatorClean === targetUsernameClean || creatorClean === `@${targetUsernameClean}`)) ||
      (targetDisplayNameClean && (creatorClean === targetDisplayNameClean || creatorClean === `@${targetDisplayNameClean}`)) ||
      (liveUserData?.username && (creatorClean === liveUserData.username.toLowerCase() || creatorClean === `@${liveUserData.username.toLowerCase()}`)) ||
      (liveUserData?.displayName && creatorClean === liveUserData.displayName.toLowerCase()) ||
      (!g.creatorId && isOwnProfile); // fallback for newly created studio places on own profile
    return matchesUser;
  });

  const handleOpenEditProfile = () => {
    setEditDisplayName(profile.displayName);
    setEditBio(profile.bio);
    setIsEditingProfile(true);
    setShowMoreMenu(false);
  };

  const handleSaveProfile = async () => {
    const newDisplayName = editDisplayName.trim() || profile.displayName;
    const newBio = editBio.trim();

    const updated = {
      ...profile,
      displayName: newDisplayName,
      bio: newBio,
    };
    setProfile(updated);

    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));
      const userRaw = localStorage.getItem('rovix_current_user_v1');
      if (userRaw) {
        const userObj = JSON.parse(userRaw);
        userObj.displayName = newDisplayName;
        userObj.bio = newBio;
        localStorage.setItem('rovix_current_user_v1', JSON.stringify(userObj));

        // Update in Firestore
        if (db && userObj.uid) {
          await updateDoc(doc(db, 'users', userObj.uid), {
            displayName: newDisplayName,
            bio: newBio,
          });
        }
      }
    } catch (e) {
      console.warn('Error saving profile changes:', e);
    }

    onProfileUpdated?.(newDisplayName, newBio);
    setIsEditingProfile(false);
  };

  // =========================================================================
  // VIEW 0: MARKETPLACE ITEM DETAILS PAGE
  // =========================================================================
  if (selectedMarketplaceItem) {
    const isEquipped =
      (selectedMarketplaceItem.clothingType === 'shirt' && activeShirt === selectedMarketplaceItem.dataUrl) ||
      (selectedMarketplaceItem.clothingType === 'pants' && activePants === selectedMarketplaceItem.dataUrl);

    return (
      <MarketplaceItemDetailsView
        item={selectedMarketplaceItem}
        isEquipped={isEquipped}
        avatarColors={activeColors}
        userShirtUrl={activeShirt}
        userPantsUrl={activePants}
        onEquipItem={(item) => {
          if (item.clothingType === 'shirt') {
            onEquipShirt?.(activeShirt === item.dataUrl ? null : item.dataUrl);
          } else {
            onEquipPants?.(activePants === item.dataUrl ? null : item.dataUrl);
          }
        }}
        onBack={() => setSelectedMarketplaceItem(null)}
      />
    );
  }

  // =========================================================================
  // VIEW 1: EXPERIENCE DETAILS PAGE
  // =========================================================================
  if (selectedGame) {
    return (
      <div className="flex-1 bg-[#191b1d] text-[#e3e5e8] overflow-y-auto min-h-screen select-none font-sans">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <button
            type="button"
            onClick={() => setSelectedGame(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Profile</span>
          </button>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-[58%] aspect-[16/10] bg-[#202225] rounded-xl overflow-hidden relative shadow-md border border-neutral-800 shrink-0">
              {selectedGame.iconUrl ? (
                <img
                  src={selectedGame.iconUrl}
                  alt={selectedGame.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${selectedGame.gradient || 'from-[#1e3a5f] to-[#0a1420]'} flex items-center justify-center`}>
                  <span className="text-4xl font-black text-white font-mono">{selectedGame.initials}</span>
                </div>
              )}
            </div>

            <div className="flex-1 w-full space-y-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {selectedGame.title}
                </h1>
                <div className="text-xs text-neutral-400 mt-1">
                  By <span className="text-blue-400 font-semibold">{selectedGame.creator || profile.username}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onPlayGame(selectedGame)}
                  className="w-full sm:w-auto px-8 py-3 bg-[#2a6839] hover:bg-[#327a44] text-white text-base font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Play</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: MAIN ROBLOX PROFILE PAGE
  // =========================================================================
  return (
    <div className="flex-1 bg-[#191b1d] text-[#e3e5e8] overflow-y-auto min-h-screen select-none font-sans pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Back Button if viewing another user */}
        {!isOwnProfile && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}

        {/* 1. TOP BANNER WITH 3D AVATAR & 3D BUTTON */}
        <div className="relative w-full h-64 sm:h-72 rounded-2xl bg-[#222429] border border-neutral-800/80 overflow-hidden flex items-center justify-center shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/35 pointer-events-none" />

          <div className="w-full h-full relative z-10 flex items-center justify-center">
            {isBanner3D ? (
              <ProfileBanner3D
                colors={activeColors}
                shirtUrl={activeShirt}
                pantsUrl={activePants}
                backgroundUrl={activeBackground}
                className="w-full h-full"
              />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {activeBackground && (
                  <img
                    src={activeBackground}
                    alt="Profile Background"
                    className="absolute inset-0 w-full h-full object-cover object-center scale-105 filter brightness-75"
                  />
                )}
                <ProfileAvatar2D
                  colors={activeColors}
                  shirtUrl={activeShirt}
                  pantsUrl={activePants}
                  height={230}
                  className="filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] relative z-10"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsBanner3D(!isBanner3D)}
            className="absolute top-3.5 right-3.5 px-3 py-1 bg-black/60 hover:bg-black/80 text-white text-xs font-bold rounded-md backdrop-blur-sm border border-white/10 transition-colors cursor-pointer shadow-sm z-20"
            title="Toggle 2D / 3D Avatar"
          >
            {isBanner3D ? '2D' : '3D'}
          </button>
        </div>

        {/* 2. PROFILE HEADER: AVATAR BUST ON LEFT + USERNAME + BUTTONS & 3 DOTS */}
        <div className="relative -mt-16 sm:-mt-20 px-2 sm:px-4 z-20">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            {/* Circular Profile Icon */}
            <div className="relative shrink-0 group">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-[#202225] border-4 border-[#191b1d] shadow-2xl relative overflow-hidden flex items-center justify-center ring-2 ring-neutral-700/80">
                {activeBackground && (
                  <img
                    src={activeBackground}
                    alt="Icon Background"
                    className="absolute inset-0 w-full h-full object-cover object-center scale-110 filter brightness-70"
                  />
                )}
                <ProfileBust3D
                  colors={activeColors}
                  shirtUrl={activeShirt}
                  className="w-full h-full relative z-10"
                />
              </div>

              <div
                className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-[#00a2ff] border-2 border-[#191b1d] flex items-center justify-center text-white shadow-md z-20"
                title="Online"
              >
                <User className="w-4 h-4 fill-white" />
              </div>
            </div>

            {/* User Info & Action Buttons */}
            <div className="flex-1 w-full space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Display Name and Username Handle */}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {profile.displayName}
                  </h1>
                  <div className="text-xs sm:text-sm text-neutral-400 mt-0.5 font-medium">
                    {profile.username}
                  </div>
                </div>

                {/* Right side buttons & 3-dots button */}
                <div className="flex items-center gap-2 relative">
                  {isOwnProfile ? (
                    <>
                      <button
                        type="button"
                        onClick={onNavigateToAvatar}
                        className="px-4 py-2 bg-[#2a2d32] hover:bg-[#34373d] text-white text-xs font-semibold rounded-lg border border-neutral-700/70 transition-colors cursor-pointer"
                      >
                        Edit avatar
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenEditProfile}
                        className="px-4 py-2 bg-[#2a2d32] hover:bg-[#34373d] text-white text-xs font-semibold rounded-lg border border-neutral-700/70 transition-colors cursor-pointer"
                      >
                        Edit profile
                      </button>
                    </>
                  ) : (
                    <>
                      {isFriend ? (
                        <span className="px-4 py-2 bg-emerald-950/60 border border-emerald-600/50 text-emerald-400 text-xs font-bold rounded-lg flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> Friends
                        </span>
                      ) : isReqPending ? (
                        <span className="px-4 py-2 bg-neutral-800 text-neutral-400 text-xs font-semibold rounded-lg">
                          Request Sent
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => viewingUser && onAddFriend?.(viewingUser)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add Friend</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => viewingUser && onToggleFollow?.(viewingUser)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                          isFollowing
                            ? 'bg-neutral-800 text-amber-400 border-amber-500/50 hover:bg-neutral-700'
                            : 'bg-[#2a2d32] text-white border-neutral-700 hover:bg-[#34373d]'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFollowing ? 'fill-current text-amber-400' : ''}`} />
                        <span>{isFollowing ? 'Following' : 'Follow'}</span>
                      </button>
                    </>
                  )}

                  {/* 3 DOTS BUTTON (MATCHES UPLOADED SCREENSHOT) */}
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className={`p-2 rounded-lg border transition-all cursor-pointer ${
                        showMoreMenu
                          ? 'bg-[#34373d] text-white border-neutral-500 shadow-md'
                          : 'bg-[#2a2d32] hover:bg-[#34373d] text-neutral-200 hover:text-white border-neutral-700/70'
                      }`}
                      title="More Options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {/* 3 DOTS FLOATING MENU */}
                    {showMoreMenu && (
                      <div className="absolute right-0 mt-1.5 w-52 bg-[#202225] border border-neutral-700 shadow-2xl rounded-lg py-1 z-50 animate-fade-in divide-y divide-neutral-800">
                        {isOwnProfile ? (
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={handleOpenEditProfile}
                              className="w-full px-3.5 py-2 text-xs text-left text-neutral-200 hover:text-white hover:bg-[#2b2e34] flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-400" />
                              <span>Edit Profile</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowMoreMenu(false);
                                onNavigateToAvatar();
                              }}
                              className="w-full px-3.5 py-2 text-xs text-left text-neutral-200 hover:text-white hover:bg-[#2b2e34] flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <User className="w-3.5 h-3.5 text-purple-400" />
                              <span>Avatar Editor</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowMoreMenu(false);
                                onOpenStudio();
                              }}
                              className="w-full px-3.5 py-2 text-xs text-left text-neutral-200 hover:text-white hover:bg-[#2b2e34] flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Hammer className="w-3.5 h-3.5 text-blue-400" />
                              <span>Rovix Studio</span>
                            </button>
                          </div>
                        ) : (
                          <div className="py-1">
                            {onViewMyProfile && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowMoreMenu(false);
                                  onViewMyProfile();
                                }}
                                className="w-full px-3.5 py-2 text-xs text-left text-blue-400 hover:text-blue-300 hover:bg-[#2b2e34] flex items-center gap-2 transition-colors cursor-pointer font-semibold border-b border-neutral-800/80 mb-1"
                              >
                                <User className="w-3.5 h-3.5" />
                                <span>View My Profile (Mine)</span>
                              </button>
                            )}

                            {isFriend ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowMoreMenu(false);
                                  if (viewingUser) onRemoveFriend?.(viewingUser.uid);
                                }}
                                className="w-full px-3.5 py-2 text-xs text-left text-red-400 hover:bg-red-950/40 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span>Remove Friend (Unadd)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowMoreMenu(false);
                                  if (viewingUser) onAddFriend?.(viewingUser);
                                }}
                                className="w-full px-3.5 py-2 text-xs text-left text-neutral-200 hover:text-white hover:bg-[#2b2e34] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                                <span>Add Friend</span>
                              </button>
                            )}

                            {isFollowing ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowMoreMenu(false);
                                  if (viewingUser) onToggleFollow?.(viewingUser);
                                }}
                                className="w-full px-3.5 py-2 text-xs text-left text-neutral-200 hover:text-white hover:bg-[#2b2e34] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Heart className="w-3.5 h-3.5 text-neutral-400" />
                                <span>Unfollow</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowMoreMenu(false);
                                  if (viewingUser) onToggleFollow?.(viewingUser);
                                }}
                                className="w-full px-3.5 py-2 text-xs text-left text-neutral-200 hover:text-white hover:bg-[#2b2e34] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Heart className="w-3.5 h-3.5 text-amber-400" />
                                <span>Follow</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stat Pills */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="px-3.5 py-1.5 bg-[#232528] text-neutral-300 text-xs font-semibold rounded-full border border-neutral-700/60">
                  {profile.friendsCount} Friends
                </span>
                <span className="px-3.5 py-1.5 bg-[#232528] text-neutral-300 text-xs font-semibold rounded-full border border-neutral-700/60">
                  {profile.followersCount} Followers
                </span>
                <span className="px-3.5 py-1.5 bg-[#232528] text-neutral-300 text-xs font-semibold rounded-full border border-neutral-700/60">
                  {profile.followingCount} Following
                </span>
              </div>

              {/* Bio */}
              {profile.bio ? (
                <div className="pt-2 text-xs text-neutral-300 leading-relaxed">
                  <div className="whitespace-pre-line font-normal">
                    {isBioExpanded ? profile.bio : profile.bio.split('\n').slice(0, 2).join('\n')}
                  </div>
                  {profile.bio.length > 50 && (
                    <button
                      type="button"
                      onClick={() => setIsBioExpanded(!isBioExpanded)}
                      className="text-xs font-semibold text-blue-400 underline hover:text-blue-300 mt-0.5 cursor-pointer block"
                    >
                      {isBioExpanded ? 'less' : 'more'}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* EDIT PROFILE MODAL: DISPLAY NAME + BIO ONLY (NO USERNAME EDITING) */}
        {isEditingProfile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-[#202225] rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-neutral-700 text-white animate-scale-up">
              <div className="flex items-center justify-between border-b border-neutral-700 pb-3">
                <h3 className="text-base font-bold text-white">Edit Profile</h3>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="p-1 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* 1. Display Name Input */}
                <div>
                  <label className="block font-semibold text-neutral-300 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    maxLength={32}
                    placeholder="Enter your display name"
                    className="w-full bg-[#181a1d] border border-neutral-700 px-3 py-2 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">This is the name everyone sees on your profile and leaderboards.</p>
                </div>

                {/* 2. Username Handle: Read-only badge */}
                <div>
                  <label className="block font-semibold text-neutral-300 mb-1">Username Handle</label>
                  <div className="w-full bg-[#141517] border border-neutral-800 px-3 py-2 rounded-lg text-neutral-400 font-mono select-none flex items-center justify-between">
                    <span>{profile.username}</span>
                    <span className="text-[10px] text-neutral-400 uppercase font-sans font-bold">Locked</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">Your unique handle is tied to your account credentials.</p>
                </div>

                {/* 3. About Me / Bio Input */}
                <div>
                  <label className="block font-semibold text-neutral-300 mb-1">About Me (Bio)</label>
                  <textarea
                    rows={4}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={300}
                    placeholder="Write a brief bio about your avatar, games, or favorite experiences..."
                    className="w-full bg-[#181a1d] border border-neutral-700 p-2.5 rounded-lg text-white focus:outline-none focus:border-blue-500 leading-relaxed transition-colors"
                  />
                  <div className="text-right text-[10px] text-neutral-400 mt-0.5">{editBio.length}/300</div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 bg-[#2b2d31] hover:bg-[#34373c] text-neutral-300 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow cursor-pointer transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. SUB TABS: ABOUT VS CREATIONS */}
        <div className="border-b border-neutral-800 pt-3">
          <div className="flex items-center gap-8 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('About')}
              className={`pb-2.5 transition-colors cursor-pointer border-b-2 ${
                activeTab === 'About'
                  ? 'border-white text-white'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('Creations')}
              className={`pb-2.5 transition-colors cursor-pointer border-b-2 ${
                activeTab === 'Creations'
                  ? 'border-white text-white'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              Creations
            </button>
          </div>
        </div>

        {/* 4. TAB 1: ABOUT -> CURRENTLY WEARING (BACKGROUND + SHIRT + PANTS) */}
        {activeTab === 'About' ? (
          <div className="space-y-4 pt-2">
            <h2 className="text-lg font-bold text-white">Currently Wearing</h2>

            <div className="relative">
              <div className="flex items-start gap-4 overflow-x-auto pb-4 pt-1 scrollbar-none">
                {wearingItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.type === 'background') {
                        if (isOwnProfile) onNavigateToAvatar();
                        return;
                      }
                      const mpItem = findMarketplaceItemByUrl(item.url) || {
                        id: item.id,
                        name: item.name,
                        creator: 'Rovix',
                        isVerified: true,
                        type: item.type === 'shirt' ? 'Classic Shirts' : 'Classic Pants',
                        placement: item.type === 'shirt' ? 'Clothing | Classic Shirt' : 'Clothing | Classic Pants',
                        tradable: 'No',
                        created: 'Jan 28, 2020',
                        starsCount: 35912,
                        isAvailable: true,
                        isOnSale: true,
                        numericPrice: 0,
                        price: 'Free',
                        dataUrl: item.url,
                        clothingType: item.type,
                        description: 'Classic clothing item for avatars.',
                      };
                      setSelectedMarketplaceItem(mpItem);
                    }}
                    className="flex flex-col items-start cursor-pointer group shrink-0 w-32 sm:w-36"
                  >
                    {/* Item Box */}
                    <div className="w-full aspect-square bg-[#1c1e22] group-hover:bg-[#23262b] rounded-xl border border-neutral-800 group-hover:border-neutral-600 overflow-hidden flex items-center justify-center p-1 transition-all shadow-sm relative">
                      {item.type === 'background' ? (
                        <div className="w-full h-full relative rounded-lg overflow-hidden flex items-center justify-center bg-[#131518]">
                          <img
                            src={item.url}
                            alt="Background Preview"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 backdrop-blur-xs text-[9px] font-bold text-white rounded">
                            Background
                          </span>
                        </div>
                      ) : (
                        <ClothingDummyPreview
                          clothingType={item.type}
                          textureUrl={item.url}
                          showUserAvatar={true}
                          avatarColors={activeColors}
                          userShirtUrl={activeShirt}
                          userPantsUrl={activePants}
                          className="w-full h-full"
                        />
                      )}

                      {item.isEquipped && (
                        <div
                          className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#232528]"
                          title="Equipped"
                        />
                      )}
                    </div>

                    {/* Title */}
                    <span className="text-xs font-bold text-white mt-2 truncate w-full group-hover:text-blue-400 transition-colors">
                      {item.name}
                    </span>
                  </div>
                ))}

                {wearingItems.length === 0 && (
                  <div
                    onClick={() => isOwnProfile && onNavigateToAvatar()}
                    className="flex flex-col items-center justify-center w-36 aspect-square bg-[#232528] rounded-xl border border-neutral-800/80 cursor-pointer p-4 text-center hover:bg-[#2b2e34] transition-colors"
                  >
                    <span className="text-xs font-semibold text-neutral-300">
                      {isOwnProfile ? 'Equip Items in Avatar Editor' : 'No custom items equipped'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* 5. TAB 2: CREATIONS -> EXPERIENCES */
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Experiences</h2>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCreationsViewMode('list')}
                  className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                    creationsViewMode === 'list'
                      ? 'border-neutral-500 bg-[#2b2e33] text-white'
                      : 'border-neutral-800 bg-[#202225] text-neutral-400 hover:text-white'
                  }`}
                  title="List View"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCreationsViewMode('grid')}
                  className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                    creationsViewMode === 'grid'
                      ? 'border-neutral-500 bg-[#2b2e33] text-white'
                      : 'border-neutral-800 bg-[#202225] text-neutral-400 hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {displayGames.length === 0 ? (
              <div className="p-8 text-center bg-[#202225] rounded-xl border border-neutral-800 text-neutral-400 text-xs">
                No experiences published yet.
              </div>
            ) : creationsViewMode === 'list' ? (
              <div className="space-y-4">
                {displayGames.map((game) => (
                  <div
                    key={game.id}
                    className="p-4 bg-[#202225] border border-neutral-800/90 rounded-2xl flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between shadow-sm group hover:border-neutral-700 transition-all"
                  >
                    <div
                      onClick={() => setSelectedGame(game)}
                      className="w-full sm:w-80 aspect-[16/10] bg-[#202225] rounded-xl overflow-hidden relative shadow-md border border-neutral-800 shrink-0 cursor-pointer group-hover:border-neutral-600 transition-colors"
                    >
                      {game.iconUrl ? (
                        <img
                          src={game.iconUrl}
                          alt={game.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${game.gradient || 'from-[#1e3a5f] to-[#0a1420]'} flex items-center justify-center`}>
                          <span className="text-3xl font-black text-white font-mono">{game.initials}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 w-full pt-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3
                          onClick={() => setSelectedGame(game)}
                          className="text-xl sm:text-2xl font-bold text-white hover:text-blue-400 cursor-pointer tracking-tight transition-colors"
                        >
                          {game.title}
                        </h3>
                        {game.isPublic ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Public
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> Private
                          </span>
                        )}
                      </div>

                      <div className="border-b border-neutral-800 w-full my-3" />

                      <div className="flex items-center gap-12 text-xs pt-1">
                        <div>
                          <div className="text-neutral-400 mb-0.5">Active</div>
                          <div className="font-bold text-white">{game.playingCount || 0}</div>
                        </div>

                        <div>
                          <div className="text-neutral-400 mb-0.5">Visits</div>
                          <div className="font-bold text-white">{(game as any).visitCount || (game.playingCount ? game.playingCount * 5 : 0)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-6">
                        <button
                          type="button"
                          onClick={() => setSelectedGame(game)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>View Experience</span>
                        </button>

                        {isOwnProfile && (
                          <button
                            type="button"
                            onClick={() => onOpenStudio(game)}
                            className="px-3.5 py-2 bg-[#2a2d32] hover:bg-[#34373d] text-white text-xs font-semibold rounded-lg border border-neutral-700/70 flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Hammer className="w-3.5 h-3.5 text-blue-400" />
                            <span>Edit in Studio</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {displayGames.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => setSelectedGame(game)}
                    className="group cursor-pointer flex flex-col bg-[#202225] border border-neutral-800 hover:border-neutral-600 rounded-xl overflow-hidden transition-all shadow-sm"
                  >
                    <div className="aspect-[16/10] w-full bg-[#181a1d] relative overflow-hidden">
                      {game.iconUrl ? (
                        <img
                          src={game.iconUrl}
                          alt={game.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${game.gradient || 'from-[#1e3a5f] to-[#0a1420]'} flex items-center justify-center`}>
                          <span className="text-2xl font-black text-white font-mono">{game.initials}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                          {game.title}
                        </div>
                        {game.isPublic ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                            Public
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-0.5">
                            <EyeOff className="w-2.5 h-2.5" /> Private
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5 truncate">
                        By {game.creator || profile.username}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
