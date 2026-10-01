import React, { useState, useEffect } from 'react';
import {
  Home,
  Compass,
  User,
  Users,
  MoreHorizontal,
  Search,
  Settings,
  X,
  RotateCw,
  Palette,
  Shirt as ShirtIcon,
  Layers,
  Play,
  Hammer,
  Sparkles,
  ShoppingBag,
  Image as ImageIcon,
  EyeOff,
  Smartphone,
  Download,
  FolderArchive,
} from 'lucide-react';
import AvatarCanvas3D, { AvatarColors, BodyPart } from './components/AvatarCanvas3D.tsx';
import ClothingManager from './components/ClothingManager.tsx';
import GameLoadingScreen from './components/GameLoadingScreen.tsx';
import GameWorld from './components/GameWorld.tsx';
import RovixStudio from './components/RovixStudio.tsx';
import UserProfileView from './components/UserProfileView.tsx';
import FriendsView from './components/friends/FriendsView.tsx';
import HomeFriendsHeader from './components/home/HomeFriendsHeader.tsx';
import DownloadZipModal from './components/home/DownloadZipModal.tsx';
import MarketplaceCatalogView from './components/marketplace/MarketplaceCatalogView.tsx';
import MarketplaceItemDetailsView from './components/marketplace/MarketplaceItemDetailsView.tsx';
import MarketplaceBackgroundDetailsView from './components/marketplace/MarketplaceBackgroundDetailsView.tsx';
import ManageItemView from './components/marketplace/ManageItemView.tsx';
import ProfileBackgroundManager from './components/profile/ProfileBackgroundManager.tsx';
import { MarketplaceItem } from './utils/marketplaceItems.ts';
import {
  BackgroundItem,
  getEquippedBackgroundItem,
} from './utils/backgroundsStorage.ts';
import { getSavedAvatar, saveAvatarToStorage, ClothingItem } from './utils/inventoryStorage.ts';
import { uploadToCloudinary } from './utils/cloudinary.ts';
import { SavedGame, getSavedGames, DEFAULT_TEST_PLACE, subscribeToLiveGames } from './utils/gamesStorage.ts';
import {
  getSavedFriends,
  subscribeToMyFriends,
  subscribeToFollowing,
  subscribeToFriendRequests,
  sendFriendRequest,
  removeFriend,
  followUser,
  unfollowUser,
  FriendUser,
  FollowRecord,
  FriendRequest,
} from './utils/friendsStorage.ts';
import Avatar3DIcon from './components/common/Avatar3DIcon.tsx';
import MoreHubView from './components/navigation/MoreHubView.tsx';
import AuthPage from './components/auth/AuthPage.tsx';
import {
  auth,
  db,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  UserProfileData,
} from './utils/firebase.ts';
import { LogOut } from 'lucide-react';

// 30 Authentic Roblox Skin Tone Palette Colors
const SKIN_TONE_PALETTE = [
  '#463a35', '#785b46', '#aa8e7b', '#cc9e75', '#eab994',
  '#4d3b32', '#68402b', '#b89658', '#d1b279', '#dfcb9e',
  '#91777b', '#9d4948', '#d1736b', '#f4b3be', '#f380be',
  '#708297', '#5178a5', '#74b3d8', '#9fa2f5', '#a66299',
  '#008b9e', '#549f48', '#7f9e68', '#a8cca0', '#e59b3c',
  '#f5cd2f', '#f6db6a', '#5a5c60', '#c8ccd0', '#ffffff',
];

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[RovixApp ErrorBoundary caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#141619] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="max-w-md w-full bg-[#202225] border border-neutral-700 p-6 rounded-lg shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-600/50 flex items-center justify-center mx-auto text-red-400 font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Something went wrong</h2>
            <p className="text-xs text-neutral-400">
              {this.state.error?.message || 'An unexpected error occurred in the Rovix client.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-[#2a6839] hover:bg-[#327a44] text-white text-xs font-semibold rounded transition-colors cursor-pointer"
            >
              Reload Client
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [currentUser, setCurrentUser] = useState<UserProfileData | null>(() => {
    try {
      const raw = localStorage.getItem('rovix_current_user_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'profile' | 'avatar' | 'marketplace' | 'studio' | 'friends' | 'more'>('home');
  const [editorSubTab, setEditorSubTab] = useState<'skin' | 'shirt' | 'pants' | 'backgrounds' | 'borders'>('skin');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [selectedMarketplaceItem, setSelectedMarketplaceItem] = useState<MarketplaceItem | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundItem | null>(null);
  const [equippedBackgroundUrl, setEquippedBackgroundUrl] = useState<string | null>(
    () => getEquippedBackgroundItem()?.imageUrl || null
  );
  const [editingClothingItem, setEditingClothingItem] = useState<ClothingItem | null>(null);
  const [friendsList, setFriendsList] = useState<FriendUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowRecord[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [viewingUserProfile, setViewingUserProfile] = useState<FriendUser | null>(null);
  const [showDownloadZipModal, setShowDownloadZipModal] = useState(false);

  // Subscribe to real Firestore friends, following & friend requests
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubFriends = subscribeToMyFriends(currentUser.uid, (list) => {
      setFriendsList(list);
    });
    const unsubFollowing = subscribeToFollowing(currentUser.uid, (list) => {
      setFollowingList(list);
    });
    const unsubRequests = subscribeToFriendRequests(currentUser.uid, (reqs) => {
      setFriendRequests(reqs);
    });
    return () => {
      unsubFriends();
      unsubFollowing();
      unsubRequests();
    };
  }, [currentUser?.uid]);

  // Profile Name (username and display name same)
  const profileName = currentUser?.username || 'Player';

  // Dynamic Saved Games & Current Experience
  const [savedGames, setSavedGames] = useState<SavedGame[]>(getSavedGames());
  const [currentGame, setCurrentGame] = useState<SavedGame>(() => {
    const list = getSavedGames();
    return list[0] || DEFAULT_TEST_PLACE;
  });

  // Game Play & Loading State
  const [gameState, setGameState] = useState<'app' | 'loading' | 'playing'>('app');
  const [privateGameError, setPrivateGameError] = useState<string | null>(null);

  // Avatar Body Part State
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart>('all');
  const [is3DMode, setIs3DMode] = useState(true);
  const [isRedrawing, setIsRedrawing] = useState(false);

  // Initialize Avatar from LocalStorage persistence
  const initialSaved = getSavedAvatar();
  const [avatarColors, setAvatarColors] = useState<AvatarColors>(initialSaved.colors);
  const [activeShirtUrl, setActiveShirtUrl] = useState<string | null>(initialSaved.shirtUrl);
  const [activePantsUrl, setActivePantsUrl] = useState<string | null>(initialSaved.pantsUrl);

  // Sync auth state with Firebase and load equipped avatar + background
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setCurrentUser(data);
            localStorage.setItem('rovix_current_user_v1', JSON.stringify(data));

            if (data.avatarColors) setAvatarColors(data.avatarColors);
            if (data.activeShirtUrl !== undefined) setActiveShirtUrl(data.activeShirtUrl);
            if (data.activePantsUrl !== undefined) setActivePantsUrl(data.activePantsUrl);
            if (data.equippedBackgroundUrl || data.backgroundUrl) {
              setEquippedBackgroundUrl(data.equippedBackgroundUrl || data.backgroundUrl);
            }
          }
        } catch (e) {
          console.warn('Error fetching user profile doc:', e);
        }
      }
    });
    return () => unsub();
  }, []);

  // Sync Live Public Games from Firebase Firestore across all users & devices
  useEffect(() => {
    const unsubGames = subscribeToLiveGames((liveGames) => {
      setSavedGames(liveGames);
      if (liveGames.length > 0) {
        setCurrentGame((prev) => {
          const updated = liveGames.find((g) => g.id === prev.id);
          return updated || liveGames[0];
        });
      }
    });
    return () => unsubGames();
  }, []);

  // Auto-save avatar & background to Firestore and LocalStorage
  useEffect(() => {
    saveAvatarToStorage({
      colors: avatarColors,
      shirtUrl: activeShirtUrl,
      pantsUrl: activePantsUrl,
    });

    // Auto-migrate any base64 image to Cloudinary so Firestore stays tiny and fast
    if (activeShirtUrl && activeShirtUrl.startsWith('data:image/')) {
      uploadToCloudinary(activeShirtUrl, 'clothing')
        .then((url) => {
          if (url) setActiveShirtUrl(url);
        })
        .catch(() => {});
    }
    if (activePantsUrl && activePantsUrl.startsWith('data:image/')) {
      uploadToCloudinary(activePantsUrl, 'clothing')
        .then((url) => {
          if (url) setActivePantsUrl(url);
        })
        .catch(() => {});
    }
    if (equippedBackgroundUrl && equippedBackgroundUrl.startsWith('data:image/')) {
      uploadToCloudinary(equippedBackgroundUrl, 'profile_backgrounds')
        .then((url) => {
          if (url) setEquippedBackgroundUrl(url);
        })
        .catch(() => {});
    }

    if (db && currentUser?.uid) {
      const cleanUserDoc = JSON.parse(
        JSON.stringify({
          uid: currentUser.uid,
          username: currentUser.username || profileName,
          displayName: currentUser.displayName || currentUser.username || profileName,
          avatarColors,
          activeShirtUrl: activeShirtUrl || null,
          shirtUrl: activeShirtUrl || null,
          activePantsUrl: activePantsUrl || null,
          pantsUrl: activePantsUrl || null,
          equippedBackgroundUrl: equippedBackgroundUrl || null,
          backgroundUrl: equippedBackgroundUrl || null,
          bio: currentUser.bio || '',
        })
      );
      setDoc(doc(db, 'users', currentUser.uid), cleanUserDoc, { merge: true }).catch(() => {});
    }
  }, [avatarColors, activeShirtUrl, activePantsUrl, equippedBackgroundUrl, currentUser?.uid]);

  const handleLogOut = async () => {
    try {
      await signOut(auth);
    } catch {}
    localStorage.removeItem('rovix_current_user_v1');
    setCurrentUser(null);
    setShowSettingsMenu(false);
  };

  // If not logged in, show AuthPage first (Sign Up / Log In)
  if (!currentUser) {
    return (
      <AuthPage
        onAuthSuccess={(profile) => {
          setCurrentUser(profile);
        }}
      />
    );
  }

  const handleColorSelect = (color: string) => {
    if (selectedBodyPart === 'all') {
      setAvatarColors({
        head: color,
        torso: color,
        leftArm: color,
        rightArm: color,
        leftLeg: color,
        rightLeg: color,
      });
    } else {
      setAvatarColors((prev) => ({
        ...prev,
        [selectedBodyPart]: color,
      }));
    }
  };

  const handleRedraw = () => {
    setIsRedrawing(true);
    setTimeout(() => {
      setIsRedrawing(false);
    }, 450);
  };

  const handleLaunchGame = (gameToLaunch?: SavedGame) => {
    const targetGame = gameToLaunch || currentGame;
    if (targetGame && typeof targetGame === 'object' && 'id' in targetGame) {
      const isCreator =
        currentUser &&
        (targetGame.creatorId === currentUser.uid ||
          targetGame.creator === currentUser.username ||
          targetGame.creator === currentUser.displayName);

      if (!targetGame.isPublic && !isCreator) {
        setPrivateGameError(
          `This experience is private. The creator of "${targetGame.title}" has set it to private. You cannot play or join this experience until the creator makes it public again.`
        );
        return;
      }

      setCurrentGame(targetGame);
      setGameState('loading');
    }
  };

  // Refresh saved games when user returns to home
  const handleGoHome = () => {
    setSavedGames(getSavedGames());
    setActiveTab('home');
  };

  // --- RENDER GAME EXPERIENCE OR LOADING SCREEN ---
  if (gameState === 'loading') {
    return (
      <GameLoadingScreen
        gameTitle={currentGame.title}
        gameCreator={currentGame.creator}
        gameInitials={currentGame.initials}
        iconUrl={currentGame.iconUrl}
        onCancel={() => setGameState('app')}
        onLoadComplete={() => setGameState('playing')}
      />
    );
  }

  if (gameState === 'playing') {
    return (
      <GameWorld
        game={currentGame}
        colors={avatarColors}
        shirtUrl={activeShirtUrl}
        pantsUrl={activePantsUrl}
        onExitGame={() => {
          setGameState('app');
          setSavedGames(getSavedGames());
        }}
      />
    );
  }

  // --- RENDER ROVIX STUDIO FULLSCREEN VIEW ---
  if (activeTab === 'studio') {
    return (
      <RovixStudio
        onBackToApp={handleGoHome}
        activeShirtUrl={activeShirtUrl}
        activePantsUrl={activePantsUrl}
        avatarColors={avatarColors}
        onEquipClothing={(type, url) => {
          if (type === 'shirt') {
            setActiveShirtUrl(url);
          } else {
            setActivePantsUrl(url);
          }
        }}
        onPlayGame={(game) => {
          setCurrentGame(game);
          setGameState('loading');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#191b1d] text-[#e3e5e8] font-sans antialiased overflow-hidden select-none">
      {/* 1. MAIN APP HEADER */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-[#26282b] bg-[#191b1d] shrink-0 z-30">
        <div className="flex items-center gap-4 sm:gap-6 flex-1 max-w-2xl">
          {/* Logo */}
          <div
            className="flex items-center cursor-pointer hover:opacity-90 transition-opacity shrink-0"
            onClick={() => setActiveTab('home')}
            title="Home"
          >
            <img
              src="/image-removebg-preview.png"
              alt="Logo"
              className="h-8 max-w-[130px] w-auto object-contain brightness-110"
              onError={(e) => {
                (e.target as HTMLImageElement).src = './image-removebg-preview.png';
              }}
            />
          </div>

          <h1 className="text-lg font-bold text-white tracking-normal whitespace-nowrap hidden sm:block">
            {activeTab === 'profile'
              ? 'Profile'
              : activeTab === 'friends'
              ? 'Friends'
              : activeTab === 'avatar'
              ? 'Avatar Editor'
              : activeTab === 'discover'
              ? 'Discover'
              : 'Home'}
          </h1>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search experiences"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#232527] border border-neutral-700/60 pl-9 pr-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-neutral-500 rounded-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right side: User Profile 3D Model Icon + Settings only (No test place) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setShowDownloadZipModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 text-blue-300 hover:text-white text-xs font-bold border border-blue-500/30 rounded transition-all cursor-pointer shadow-xs"
            title="Download Entire Site (.ZIP)"
          >
            <FolderArchive className="w-3.5 h-3.5 text-blue-400" />
            <span>Download .ZIP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewingUserProfile(null);
              setActiveTab('profile');
            }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer border overflow-hidden bg-[#16181b] ${
              activeTab === 'profile' && !viewingUserProfile
                ? 'border-blue-400 shadow-sm ring-2 ring-blue-500/50'
                : 'border-neutral-700/90 hover:border-neutral-500'
            }`}
            title={`My Profile (@${profileName})`}
          >
            <Avatar3DIcon colors={avatarColors} shirtUrl={activeShirtUrl} className="w-9 h-9" />
          </button>

          <div className="relative">
            <button
              type="button"
              title="Settings"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="w-9 h-9 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-[#2b2d31] border border-transparent hover:border-neutral-700/60 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-[#1e2022] border border-neutral-700 shadow-xl z-50 py-1 rounded">
                <div className="px-3 py-1.5 text-[11px] font-bold text-neutral-400 border-b border-neutral-800">
                  Signed in as <span className="text-white">@{profileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsMenu(false);
                    setViewingUserProfile(null);
                    setActiveTab('profile');
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-[#2b2d31] transition-colors cursor-pointer"
                >
                  My Profile
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettingsMenu(false)}
                  className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-[#2b2d31] transition-colors cursor-pointer"
                >
                  Help
                </button>
                <div className="border-t border-neutral-800 my-1" />
                <button
                  type="button"
                  onClick={handleLogOut}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. BODY CONTAINER: Left Sidebar + Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR WITH STUDIO (Desktop only) */}
        <aside className="hidden md:flex w-14 bg-[#191b1d] border-r border-[#26282b] flex-col items-center py-2.5 shrink-0 z-20">
          <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
            <button
              type="button"
              title="Home"
              onClick={() => {
                setViewingUserProfile(null);
                setActiveTab('home');
              }}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                activeTab === 'home'
                  ? 'bg-[#2e3135] text-white border-l-2 border-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#232528]'
              }`}
            >
              <Home className="w-5 h-5" />
            </button>

            <button
              type="button"
              title="Discover"
              onClick={() => {
                setViewingUserProfile(null);
                setActiveTab('discover');
              }}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                activeTab === 'discover'
                  ? 'bg-[#2e3135] text-white border-l-2 border-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#232528]'
              }`}
            >
              <Compass className="w-5 h-5" />
            </button>

            <button
              type="button"
              title={`My Profile (${profileName})`}
              onClick={() => {
                setViewingUserProfile(null);
                setActiveTab('profile');
              }}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                activeTab === 'profile' && !viewingUserProfile
                  ? 'bg-[#2e3135] text-white border-l-2 border-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#232528]'
              }`}
            >
              <User className="w-5 h-5" />
            </button>

            <button
              type="button"
              title="Friends"
              onClick={() => {
                setViewingUserProfile(null);
                setActiveTab('friends');
              }}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                activeTab === 'friends'
                  ? 'bg-[#2e3135] text-white border-l-2 border-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#232528]'
              }`}
            >
              <Users className="w-5 h-5" />
            </button>

            <button
              type="button"
              title="Avatar Editor"
              onClick={() => {
                setViewingUserProfile(null);
                setActiveTab('avatar');
              }}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                activeTab === 'avatar'
                  ? 'bg-[#2e3135] text-white border-l-2 border-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#232528]'
              }`}
            >
              <ShirtIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              title="Marketplace"
              onClick={() => {
                setSelectedMarketplaceItem(null);
                setSelectedBackground(null);
                setViewingUserProfile(null);
                setActiveTab('marketplace');
              }}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                activeTab === 'marketplace'
                  ? 'bg-[#2e3135] text-white border-l-2 border-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#232528]'
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
            </button>

            {/* ROVIX STUDIO TAB ON LEFT SIDEBAR */}
            <button
              type="button"
              title="Rovix Studio (Creations & Uploads)"
              onClick={() => {
                setViewingUserProfile(null);
                setActiveTab('studio');
              }}
              className="w-10 h-10 flex items-center justify-center transition-all relative group text-neutral-400 hover:text-white hover:bg-[#232528]"
            >
              <Hammer className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="absolute left-14 ml-1 px-2 py-1 bg-black/90 text-white text-[11px] rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                Rovix Studio
              </span>
            </button>

            <button
              type="button"
              title="More Options"
              onClick={() => {
                setActiveTab('more');
              }}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                activeTab === 'more'
                  ? 'bg-[#2e3135] text-white border-l-2 border-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#232528]'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </aside>

        {/* MAIN VIEW AREA */}
        <div className="flex-1 flex flex-col bg-[#191b1d] overflow-y-auto pb-20 md:pb-0">
          {editingClothingItem ? (
            /* CONFIGURE / MANAGE ITEM VIEW (SCREENSHOT 1) */
            <ManageItemView
              item={editingClothingItem}
              onSave={() => {
                setEditingClothingItem(null);
              }}
              onBack={() => setEditingClothingItem(null)}
            />
          ) : activeTab === 'profile' ? (
            /* ROBLOX PROFILE VIEW */
            <UserProfileView
              key={viewingUserProfile ? `profile_${viewingUserProfile.uid}` : `self_${currentUser?.uid || 'local'}`}
              viewingUser={viewingUserProfile}
              currentUserId={currentUser?.uid}
              colors={viewingUserProfile?.avatarColors || avatarColors}
              shirtUrl={viewingUserProfile ? (viewingUserProfile.shirtUrl ?? null) : activeShirtUrl}
              pantsUrl={viewingUserProfile ? (viewingUserProfile.pantsUrl ?? null) : activePantsUrl}
              backgroundUrl={viewingUserProfile ? (viewingUserProfile.backgroundUrl ?? null) : equippedBackgroundUrl}
              savedGames={savedGames}
              onPlayGame={(game) => handleLaunchGame(game)}
              onOpenStudio={(game) => {
                if (game) setCurrentGame(game);
                setActiveTab('studio');
              }}
              onNavigateToAvatar={() => setActiveTab('avatar')}
              onViewMyProfile={() => {
                setViewingUserProfile(null);
                setActiveTab('profile');
              }}
              onEquipShirt={(url) => setActiveShirtUrl(url)}
              onEquipPants={(url) => setActivePantsUrl(url)}
              onBack={() => {
                setViewingUserProfile(null);
                setActiveTab('friends');
              }}
              onProfileUpdated={(name, bio) => {
                if (currentUser) {
                  setCurrentUser({ ...currentUser, displayName: name, bio });
                }
              }}
              onAddFriend={(target) => {
                sendFriendRequest(
                  {
                    uid: currentUser?.uid || 'local',
                    username: profileName,
                    displayName: currentUser?.displayName || profileName,
                    avatarColors,
                    shirtUrl: activeShirtUrl,
                    pantsUrl: activePantsUrl,
                    backgroundUrl: equippedBackgroundUrl,
                  },
                  target
                );
              }}
              onRemoveFriend={(targetUid) => {
                removeFriend(targetUid, currentUser?.uid || 'local');
              }}
              onToggleFollow={(target) => {
                const isFol = followingList.some((f) => f.uid === target.uid);
                if (isFol) {
                  unfollowUser(currentUser?.uid || 'local', target.uid);
                } else {
                  followUser(
                    {
                      uid: currentUser?.uid || 'local',
                      username: profileName,
                      displayName: currentUser?.displayName || profileName,
                      avatarColors,
                      shirtUrl: activeShirtUrl,
                      pantsUrl: activePantsUrl,
                      backgroundUrl: equippedBackgroundUrl,
                    },
                    {
                      uid: target.uid,
                      username: target.username,
                      displayName: target.displayName || target.username,
                      avatarColors: target.avatarColors,
                      shirtUrl: target.shirtUrl,
                      pantsUrl: target.pantsUrl,
                      backgroundUrl: target.backgroundUrl,
                    }
                  );
                }
              }}
              isFriend={viewingUserProfile ? friendsList.some((f) => f.uid === viewingUserProfile.uid) : false}
              isFollowing={viewingUserProfile ? followingList.some((f) => f.uid === viewingUserProfile.uid) : false}
              isReqPending={
                viewingUserProfile
                  ? friendRequests.some(
                      (r) =>
                        (r.toUid === viewingUserProfile.uid || r.fromUid === viewingUserProfile.uid) &&
                        r.status === 'pending'
                    )
                  : false
              }
            />
          ) : activeTab === 'friends' ? (
            /* FRIENDS VIEW */
            <FriendsView
              myUsername={currentUser?.username || profileName}
              myUid={currentUser?.uid || 'user_local'}
              myColors={avatarColors}
              myShirtUrl={activeShirtUrl}
              onViewProfile={(targetUser) => {
                setViewingUserProfile(targetUser);
                setActiveTab('profile');
              }}
              onLaunchGame={() => handleLaunchGame()}
            />
          ) : activeTab === 'marketplace' ? (
            /* MARKETPLACE VIEW */
            selectedBackground ? (
              <MarketplaceBackgroundDetailsView
                background={selectedBackground}
                avatarColors={avatarColors}
                userShirtUrl={activeShirtUrl}
                userPantsUrl={activePantsUrl}
                onNavigateToAvatar={() => {
                  setSelectedBackground(null);
                  setActiveTab('avatar');
                  setEditorSubTab('backgrounds');
                }}
                onBack={() => setSelectedBackground(null)}
              />
            ) : selectedMarketplaceItem ? (
              <MarketplaceItemDetailsView
                item={selectedMarketplaceItem}
                isEquipped={
                  (selectedMarketplaceItem.clothingType === 'shirt' && activeShirtUrl === selectedMarketplaceItem.dataUrl) ||
                  (selectedMarketplaceItem.clothingType === 'pants' && activePantsUrl === selectedMarketplaceItem.dataUrl)
                }
                avatarColors={avatarColors}
                userShirtUrl={activeShirtUrl}
                userPantsUrl={activePantsUrl}
                onEquipItem={(item) => {
                  if (item.clothingType === 'shirt') {
                    setActiveShirtUrl(activeShirtUrl === item.dataUrl ? null : item.dataUrl);
                  } else {
                    setActivePantsUrl(activePantsUrl === item.dataUrl ? null : item.dataUrl);
                  }
                }}
                onBack={() => setSelectedMarketplaceItem(null)}
              />
            ) : (
              <MarketplaceCatalogView
                activeShirtUrl={activeShirtUrl}
                activePantsUrl={activePantsUrl}
                onSelectItem={(item) => setSelectedMarketplaceItem(item)}
                onSelectBackground={(bg) => setSelectedBackground(bg)}
              />
            )
          ) : activeTab === 'avatar' ? (
            /* AVATAR EDITOR */
            <div className="flex-1 flex flex-col md:flex-row p-6 gap-8 max-w-6xl w-full mx-auto">
              {/* LEFT COLUMN: 3D Avatar Viewport */}
              <div className="w-full md:w-80 flex flex-col shrink-0">
                <div className="relative w-full aspect-square bg-[#232527] border border-neutral-800 flex items-center justify-center overflow-hidden shadow-inner group">
                  {equippedBackgroundUrl ? (
                    <img
                      src={equippedBackgroundUrl}
                      alt="Viewport Background"
                      className="absolute inset-0 w-full h-full object-cover filter brightness-70 pointer-events-none"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(240,200,140,0.12)_0%,_rgba(25,27,29,0.85)_80%)] pointer-events-none" />
                  )}

                  <div className="absolute inset-0">
                    <AvatarCanvas3D
                      colors={avatarColors}
                      selectedPart={selectedBodyPart}
                      onSelectPart={(part) => setSelectedBodyPart(part)}
                      shirtUrl={activeShirtUrl}
                      pantsUrl={activePantsUrl}
                      is3D={is3DMode}
                      isRedrawing={isRedrawing}
                    />
                  </div>

                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] text-neutral-400 bg-[#161719]/85 border border-neutral-800 pointer-events-none backdrop-blur-sm">
                    Drag • Scroll zoom
                  </div>

                  <button
                    type="button"
                    onClick={() => setIs3DMode(!is3DMode)}
                    className="absolute bottom-2.5 right-2.5 px-2.5 py-1 text-xs font-semibold bg-[#32353b]/90 hover:bg-[#3d4147] text-white border border-neutral-700/60 backdrop-blur-sm transition-colors z-20"
                  >
                    {is3DMode ? '3D' : '2D'}
                  </button>
                </div>

                {/* Clothing status tags */}
                <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-medium text-neutral-300">Equipped:</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className={`px-1.5 py-0.5 border ${
                        activeShirtUrl
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-300 font-medium'
                          : 'border-neutral-800 text-neutral-500'
                      }`}
                    >
                      Shirt {activeShirtUrl ? '✓' : '—'}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 border ${
                        activePantsUrl
                          ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300 font-medium'
                          : 'border-neutral-800 text-neutral-500'
                      }`}
                    >
                      Pants {activePantsUrl ? '✓' : '—'}
                    </span>
                  </div>
                </div>

                {/* Play with Custom Avatar Button */}
                <button
                  type="button"
                  onClick={() => handleLaunchGame()}
                  className="mt-3 w-full py-2 bg-[#2a6839] hover:bg-[#327a44] text-white text-xs font-semibold flex items-center justify-center gap-2 border border-[#3e9354]/60 transition-colors shadow-sm cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Test in Game Experience</span>
                </button>

                <div className="mt-2.5 text-xs text-neutral-400 flex items-center justify-between">
                  <span className="font-medium text-neutral-300">Body Type</span>
                  <span className="font-semibold text-neutral-300">0%</span>
                </div>

                <div className="mt-1.5 text-xs text-neutral-400 flex items-center gap-1">
                  <span>Avatar isn't loading correctly?</span>
                  <button
                    type="button"
                    onClick={handleRedraw}
                    className="text-white underline hover:text-neutral-300 font-medium inline-flex items-center gap-1"
                  >
                    {isRedrawing && <RotateCw className="w-3 h-3 animate-spin" />}
                    Redraw
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Customization Tabs */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-6 border-b border-neutral-800 text-sm overflow-x-auto pb-1 mb-4">
                  <button
                    type="button"
                    onClick={() => setEditorSubTab('skin')}
                    className={`pb-2.5 flex items-center gap-2 font-medium whitespace-nowrap transition-colors border-b-2 ${
                      editorSubTab === 'skin'
                        ? 'text-white border-white font-semibold'
                        : 'text-neutral-400 hover:text-white border-transparent'
                    }`}
                  >
                    <Palette className="w-4 h-4" />
                    <span>Skin Tone</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorSubTab('shirt')}
                    className={`pb-2.5 flex items-center gap-2 font-medium whitespace-nowrap transition-colors border-b-2 ${
                      editorSubTab === 'shirt'
                        ? 'text-white border-white font-semibold'
                        : 'text-neutral-400 hover:text-white border-transparent'
                    }`}
                  >
                    <ShirtIcon className="w-4 h-4" />
                    <span>Shirts</span>
                    {activeShirtUrl && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorSubTab('pants')}
                    className={`pb-2.5 flex items-center gap-2 font-medium whitespace-nowrap transition-colors border-b-2 ${
                      editorSubTab === 'pants'
                        ? 'text-white border-white font-semibold'
                        : 'text-neutral-400 hover:text-white border-transparent'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Pants</span>
                    {activePantsUrl && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorSubTab('backgrounds')}
                    className={`pb-2.5 flex items-center gap-2 font-medium whitespace-nowrap transition-colors border-b-2 ${
                      editorSubTab === 'backgrounds'
                        ? 'text-white border-white font-semibold'
                        : 'text-neutral-400 hover:text-white border-transparent'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Backgrounds</span>
                    {equippedBackgroundUrl && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorSubTab('borders')}
                    className={`pb-2.5 flex items-center gap-2 font-medium whitespace-nowrap transition-colors border-b-2 ${
                      editorSubTab === 'borders'
                        ? 'text-amber-400 border-amber-400 font-semibold'
                        : 'text-neutral-400 hover:text-white border-transparent'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Borders (Coming Soon)</span>
                  </button>
                </div>

                {editorSubTab === 'skin' ? (
                  <div className="flex-1 flex flex-col">
                    <div className="pb-3 border-b border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
                      <div>
                        <span className="text-white font-medium">Body</span>
                        <span className="mx-1.5 text-neutral-600">&gt;</span>
                        <span>Skin Tone</span>
                      </div>
                      <span>
                        Selected:{' '}
                        <strong className="text-white capitalize">{selectedBodyPart}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-3 pb-3">
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'head', label: 'Head' },
                          { id: 'torso', label: 'Torso' },
                          { id: 'leftArm', label: 'Left Arm' },
                          { id: 'rightArm', label: 'Right Arm' },
                          { id: 'leftLeg', label: 'Left Leg' },
                          { id: 'rightLeg', label: 'Right Leg' },
                        ] as const
                      ).map((part) => (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => setSelectedBodyPart(part.id)}
                          className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                            selectedBodyPart === part.id
                              ? 'bg-[#2b2d31] text-white border-neutral-500'
                              : 'bg-[#191b1d] text-neutral-400 border-neutral-800 hover:text-white hover:bg-[#232528]'
                          }`}
                        >
                          {part.label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-[#202225] border border-neutral-800 p-6 flex-1 flex flex-col justify-center">
                      <div className="grid grid-cols-5 gap-y-4 gap-x-4 max-w-sm mx-auto w-full">
                        {SKIN_TONE_PALETTE.map((color, index) => {
                          const currentColorForPart =
                            selectedBodyPart === 'all'
                              ? avatarColors.head
                              : avatarColors[selectedBodyPart];
                          const isSelected =
                            currentColorForPart.toLowerCase() === color.toLowerCase();

                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleColorSelect(color)}
                              style={{ backgroundColor: color }}
                              className={`w-11 h-11 rounded-full cursor-pointer transition-transform hover:scale-110 relative ${
                                isSelected
                                  ? 'ring-2 ring-[#00a2ff] ring-offset-2 ring-offset-[#202225] scale-105'
                                  : 'hover:ring-1 hover:ring-neutral-400/50'
                              }`}
                              title={`Color ${index + 1}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : editorSubTab === 'shirt' ? (
                  <ClothingManager
                    clothingType="shirt"
                    activeShirtUrl={activeShirtUrl}
                    activePantsUrl={activePantsUrl}
                    onApplyShirt={setActiveShirtUrl}
                    onApplyPants={setActivePantsUrl}
                    onOpenStudio={() => setActiveTab('studio')}
                    onEditItem={(item) => setEditingClothingItem(item)}
                  />
                ) : editorSubTab === 'pants' ? (
                  <ClothingManager
                    clothingType="pants"
                    activeShirtUrl={activeShirtUrl}
                    activePantsUrl={activePantsUrl}
                    onApplyShirt={setActiveShirtUrl}
                    onApplyPants={setActivePantsUrl}
                    onOpenStudio={() => setActiveTab('studio')}
                    onEditItem={(item) => setEditingClothingItem(item)}
                  />
                ) : editorSubTab === 'backgrounds' ? (
                  <ProfileBackgroundManager
                    onOpenMarketplaceBackgrounds={() => {
                      setSelectedMarketplaceItem(null);
                      setSelectedBackground(null);
                      setActiveTab('marketplace');
                    }}
                    onBackgroundEquippedChange={(url) => setEquippedBackgroundUrl(url)}
                  />
                ) : (
                  <div className="bg-[#202225] border border-neutral-800 p-8 rounded-xl text-center space-y-4 my-auto">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Avatar Borders &amp; Frames (Coming Soon)</h3>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                      Custom animated profile borders, neon avatar frames, and glowing edges will be available here to equip to your avatar profile!
                    </p>
                    <div className="pt-2">
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'more' ? (
            /* MORE HUB VIEW */
            <MoreHubView
              username={currentUser?.username || profileName}
              displayName={currentUser?.displayName || currentUser?.username || profileName}
              avatarColors={avatarColors}
              shirtUrl={activeShirtUrl}
              onNavigateToMyProfile={() => {
                setViewingUserProfile(null);
                setActiveTab('profile');
              }}
              onNavigateToAvatar={() => setActiveTab('avatar')}
              onNavigateToStudio={() => setActiveTab('studio')}
              onNavigateToMarketplace={() => {
                setSelectedMarketplaceItem(null);
                setActiveTab('marketplace');
              }}
              onNavigateToFriends={() => setActiveTab('friends')}
              onNavigateToDiscover={() => setActiveTab('discover')}
              onDownloadZip={() => setShowDownloadZipModal(true)}
              onLogOut={handleLogOut}
            />
          ) : (
            /* HOME VIEW */
            <main className="p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6 sm:space-y-8 flex-1">
              {/* ZIP DOWNLOAD HERO BANNER ON HOMEPAGE */}
              <div className="bg-gradient-to-r from-blue-900/35 via-indigo-950/40 to-[#202225] border border-blue-500/30 hover:border-blue-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl transition-all">
                <div className="flex items-center gap-3.5 text-center sm:text-left">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 border border-blue-400/40 flex items-center justify-center shadow-lg shrink-0">
                    <FolderArchive className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                        Download Entire Site (.ZIP)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        FULL PROJECT
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-1 max-w-xl leading-relaxed">
                      Download the complete site codebase, 3D engine, custom avatar creator, studio &amp; multiplayer backend in a single .zip file to run anywhere!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDownloadZipModal(true)}
                    className="w-full sm:w-auto py-2.5 px-5 bg-gradient-to-r from-blue-600 hover:from-blue-500 to-indigo-600 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer border border-blue-400/40 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .ZIP</span>
                  </button>
                </div>
              </div>

              {/* Friends Header at top of Home page (replaces test profile) */}
              <HomeFriendsHeader
                friends={friendsList}
                onOpenFriendsTab={() => setActiveTab('friends')}
                onViewProfile={(targetFriend) => {
                  setViewingUserProfile(targetFriend);
                  setActiveTab('profile');
                }}
                onLaunchGame={() => handleLaunchGame()}
              />

              {/* SECTION: Public Experiences on Homepage (Private ones are hidden) */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                    <span>Public Experiences</span>
                    <span className="text-xs text-neutral-400 font-normal">
                      ({savedGames.filter((g) => g.isPublic).length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('studio')}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    Manage in Studio &rarr;
                  </button>
                </div>

                {savedGames.filter((g) => g.isPublic).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {savedGames
                      .filter((g) => g.isPublic)
                      .map((game) => (
                        <div
                          key={game.id}
                          onClick={() => handleLaunchGame(game)}
                          className="group cursor-pointer flex flex-col bg-[#202225] border border-neutral-800/80 hover:border-neutral-500 transition-all shadow-md overflow-hidden rounded-sm"
                        >
                          {/* Thumbnail */}
                          <div className={`aspect-[16/10] w-full bg-gradient-to-br ${game.gradient || 'from-[#1e3a5f] via-[#12233a] to-[#0a1420]'} relative overflow-hidden flex items-center justify-center p-3`}>
                            {game.iconUrl ? (
                              <img
                                src={game.iconUrl}
                                alt={game.title}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-14 h-14 bg-[#1b1c1e]/90 border border-neutral-600/70 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                                <span className="text-xl font-black text-white font-mono">{game.initials}</span>
                              </div>
                            )}

                            {/* Play Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                              <div className="w-11 h-11 rounded-full bg-[#2a6839] flex items-center justify-center text-white shadow-lg">
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                              </div>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="p-3">
                            <div className="text-sm font-bold text-white truncate group-hover:underline">
                              {game.title}
                            </div>
                            <div className="text-xs text-neutral-400 mt-0.5 truncate">
                              By {game.creator}
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-[10px] text-neutral-400">
                              <span className="text-emerald-400 font-semibold">● Public</span>
                              <span>•</span>
                              <span>{game.parts?.length || 0} parts</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="bg-[#202225] border border-neutral-800 p-8 rounded-lg text-center flex flex-col items-center max-w-lg mx-auto">
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 mb-3">
                      <Hammer className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">No Public Experiences Visible</h3>
                    <p className="text-xs text-neutral-400 mb-4 max-w-sm">
                      All your experiences are currently set to Private, so they don't show on the homepage. Open Rovix Studio to toggle an experience to Public or build a new one.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('studio')}
                      className="px-4 py-2 bg-white text-black hover:bg-neutral-200 text-xs font-bold rounded shadow transition-all cursor-pointer"
                    >
                      Open Rovix Studio
                    </button>
                  </div>
                )}
              </section>
            </main>
          )}
        </div>
      </div>

      {/* Mobile App Navigation Dock (Fixed at bottom for mobile screens) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#161719]/95 backdrop-blur-lg border-t border-neutral-800 py-1.5 px-2 flex items-center justify-around text-xs text-neutral-400 select-none shadow-2xl">
        <button
          type="button"
          onClick={() => {
            setViewingUserProfile(null);
            setActiveTab('home');
          }}
          className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer flex-1 py-1 ${
            activeTab === 'home' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'text-blue-400' : ''}`} />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewingUserProfile(null);
            setActiveTab('discover');
          }}
          className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer flex-1 py-1 ${
            activeTab === 'discover' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === 'discover' ? 'text-blue-400' : ''}`} />
          <span className="text-[10px]">Discover</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewingUserProfile(null);
            setActiveTab('avatar');
          }}
          className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer flex-1 py-1 ${
            activeTab === 'avatar' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <ShirtIcon className={`w-5 h-5 ${activeTab === 'avatar' ? 'text-blue-400' : ''}`} />
          <span className="text-[10px]">Avatar</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewingUserProfile(null);
            setActiveTab('profile');
          }}
          className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer flex-1 py-1 ${
            activeTab === 'profile' && !viewingUserProfile ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
          title={`My Profile (@${profileName})`}
        >
          <div className={`w-6 h-6 rounded-full overflow-hidden border flex items-center justify-center bg-[#16181b] ${
            activeTab === 'profile' && !viewingUserProfile ? 'border-blue-400 ring-2 ring-blue-500/50' : 'border-neutral-700'
          }`}>
            <Avatar3DIcon colors={avatarColors} shirtUrl={activeShirtUrl} className="w-6 h-6" />
          </div>
          <span className="text-[10px]">Profile</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('more');
          }}
          className={`flex flex-col items-center gap-0.5 transition-colors cursor-pointer flex-1 py-1 ${
            activeTab === 'more' ? 'text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
          title="More Options"
        >
          <MoreHorizontal className={`w-5 h-5 ${activeTab === 'more' ? 'text-blue-400' : ''}`} />
          <span className="text-[10px]">More</span>
        </button>
      </div>
      {/* Private Game Error Modal */}
      {privateGameError && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-sans select-none">
          <div className="bg-[#202225] border border-neutral-700/80 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-md">
              <EyeOff className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">This experience is private.</h2>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {privateGameError}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPrivateGameError(null)}
                className="w-full py-2.5 bg-[#2b2d31] hover:bg-[#34373c] text-white font-semibold text-xs rounded-lg border border-neutral-600 transition-colors cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Entire Site ZIP Download Modal */}
      <DownloadZipModal
        isOpen={showDownloadZipModal}
        onClose={() => setShowDownloadZipModal(false)}
      />
    </div>
  );
}
