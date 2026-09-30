import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  Check,
  X,
  UserMinus,
  Radio,
  Play,
  MessageSquare,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  FriendUser,
  FriendRequest,
  getLocalFriends,
  saveLocalFriends,
  getLocalFriendRequests,
  saveLocalFriendRequests,
  getLocalFollowing,
  saveLocalFollowing,
  getLocalFollowers,
  saveLocalFollowers,
  searchUsers,
} from '../utils/friendsService.ts';

interface FriendsViewProps {
  currentUserUid: string;
  currentUsername: string;
  onPlayGame?: (gameTitle?: string) => void;
  onNavigateToProfile?: (username: string) => void;
}

export default function FriendsView({
  currentUserUid,
  currentUsername,
  onPlayGame,
  onNavigateToProfile,
}: FriendsViewProps) {
  const [subTab, setSubTab] = useState<'friends' | 'requests' | 'following' | 'followers'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [friends, setFriends] = useState<FriendUser[]>(() => getLocalFriends(currentUserUid));
  const [requests, setRequests] = useState<FriendRequest[]>(() => getLocalFriendRequests(currentUserUid));
  const [following, setFollowing] = useState<FriendUser[]>(() => getLocalFollowing(currentUserUid));
  const [followers, setFollowers] = useState<FriendUser[]>(() => getLocalFollowers(currentUserUid));

  useEffect(() => {
    saveLocalFriends(currentUserUid, friends);
  }, [friends, currentUserUid]);

  useEffect(() => {
    saveLocalFriendRequests(currentUserUid, requests);
  }, [requests, currentUserUid]);

  useEffect(() => {
    saveLocalFollowing(currentUserUid, following);
  }, [following, currentUserUid]);

  useEffect(() => {
    saveLocalFollowers(currentUserUid, followers);
  }, [followers, currentUserUid]);

  // Handle Search input
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await searchUsers(searchQuery, currentUserUid);
      setSearchResults(res);
      setIsSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUserUid]);

  const handleAddFriend = (user: FriendUser) => {
    // If not already a friend, add as friend
    if (!friends.some((f) => f.uid === user.uid)) {
      setFriends((prev) => [...prev, user]);
    }
  };

  const handleRemoveFriend = (uid: string) => {
    setFriends((prev) => prev.filter((f) => f.uid !== uid));
  };

  const handleAcceptRequest = (req: FriendRequest) => {
    const newFriend: FriendUser = {
      uid: req.fromUid,
      username: req.fromUsername,
      displayName: req.fromDisplayName,
      status: 'online',
      lastSeen: Date.now(),
    };
    setFriends((prev) => (prev.some((f) => f.uid === newFriend.uid) ? prev : [...prev, newFriend]));
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  };

  const handleDeclineRequest = (reqId: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== reqId));
  };

  const handleToggleFollow = (user: FriendUser) => {
    if (following.some((f) => f.uid === user.uid)) {
      setFollowing((prev) => prev.filter((f) => f.uid !== user.uid));
    } else {
      setFollowing((prev) => [...prev, user]);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-6xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-blue-400" />
            <span>Friends</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Connect with friends, accept requests, and see who you follow on Rovix.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search users to add..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-[#202225] border border-neutral-700/80 rounded-md text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Results (When typing) */}
      {searchQuery.trim() && (
        <div className="bg-[#1f2125] border border-neutral-700/80 p-4 rounded-lg space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
            <span>Search Results for "{searchQuery}"</span>
            <span className="text-neutral-400 font-normal">
              {isSearching ? 'Searching...' : `${searchResults.length} found`}
            </span>
          </div>

          {searchResults.length === 0 && !isSearching ? (
            <div className="p-6 text-center text-xs text-neutral-400">
              No users found matching "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {searchResults.map((user) => {
                const isFriend = friends.some((f) => f.uid === user.uid);
                const isFollowing = following.some((f) => f.uid === user.uid);

                return (
                  <div
                    key={user.uid}
                    className="p-3 bg-[#18191c] border border-neutral-800 rounded flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div
                        style={{ backgroundColor: user.avatarColor || '#3b82f6' }}
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 shadow"
                      >
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-white text-xs truncate">
                          {user.displayName || user.username}
                        </div>
                        <div className="text-[11px] text-neutral-400 truncate">@{user.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isFriend ? (
                        <span className="px-2 py-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold rounded">
                          Friends
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddFriend(user)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleFollow(user)}
                        className={`px-2 py-1 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                          isFollowing
                            ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                            : 'bg-transparent text-neutral-400 hover:text-white border-neutral-700'
                        }`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 text-xs font-semibold overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSubTab('friends')}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'friends'
              ? 'border-white text-white font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span>Friends</span>
          <span className="px-1.5 py-0.2 bg-neutral-800 text-[10px] rounded-full text-neutral-300">
            {friends.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('requests')}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'requests'
              ? 'border-white text-white font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span>Friend Requests</span>
          {requests.length > 0 && (
            <span className="px-1.5 py-0.2 bg-blue-600 text-[10px] rounded-full text-white font-bold animate-pulse">
              {requests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('following')}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'following'
              ? 'border-white text-white font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span>Following</span>
          <span className="px-1.5 py-0.2 bg-neutral-800 text-[10px] rounded-full text-neutral-300">
            {following.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('followers')}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            subTab === 'followers'
              ? 'border-white text-white font-bold'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span>Followers</span>
          <span className="px-1.5 py-0.2 bg-neutral-800 text-[10px] rounded-full text-neutral-300">
            {followers.length}
          </span>
        </button>
      </div>

      {/* Subtab Contents */}
      {subTab === 'friends' && (
        <div className="space-y-4">
          {friends.length === 0 ? (
            <div className="p-12 text-center bg-[#202225] border border-neutral-800 rounded-lg space-y-3">
              <Users className="w-10 h-10 text-neutral-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Friends Yet</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Search for other players using the search bar above to add them as a friend!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {friends.map((friend) => (
                <div
                  key={friend.uid}
                  className="bg-[#202225] border border-neutral-800/90 rounded-lg p-4 flex flex-col justify-between hover:border-neutral-600 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div
                        style={{ backgroundColor: friend.avatarColor || '#2563eb' }}
                        className="w-12 h-12 rounded-full flex items-center justify-center font-black text-white text-base shadow"
                      >
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#202225] ${
                          friend.status === 'online'
                            ? 'bg-emerald-500'
                            : friend.status === 'in_experience'
                            ? 'bg-blue-500'
                            : 'bg-neutral-500'
                        }`}
                        title={friend.status}
                      />
                    </div>

                    <div className="truncate">
                      <h4 className="font-bold text-white text-sm truncate">
                        {friend.displayName || friend.username}
                      </h4>
                      <div className="text-xs text-neutral-400 truncate">@{friend.username}</div>
                      <div className="text-[10px] mt-0.5 font-medium flex items-center gap-1">
                        {friend.status === 'in_experience' ? (
                          <span className="text-blue-400 truncate">
                            In Experience: {friend.currentGameTitle || 'Rovix World'}
                          </span>
                        ) : friend.status === 'online' ? (
                          <span className="text-emerald-400">Online</span>
                        ) : (
                          <span className="text-neutral-500">Offline</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center gap-2">
                    {friend.status === 'in_experience' && onPlayGame && (
                      <button
                        type="button"
                        onClick={() => onPlayGame(friend.currentGameTitle)}
                        className="flex-1 py-1.5 px-2 bg-[#2a6839] hover:bg-[#327a44] text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Join</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveFriend(friend.uid)}
                      className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors ml-auto cursor-pointer"
                      title="Unfriend"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="p-12 text-center bg-[#202225] border border-neutral-800 rounded-lg text-xs text-neutral-400">
              You have no pending friend requests.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-[#202225] border border-neutral-800 p-4 rounded-lg flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shrink-0">
                      {req.fromUsername.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-white text-xs truncate">
                        {req.fromDisplayName || req.fromUsername}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">@{req.fromUsername}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(req)}
                      className="px-3 py-1.5 bg-[#2a6839] hover:bg-[#327a44] text-white text-xs font-semibold rounded flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeclineRequest(req.id)}
                      className="p-1.5 bg-[#2a2d32] hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold rounded cursor-pointer transition-colors"
                      title="Decline"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'following' && (
        <div className="space-y-3">
          {following.length === 0 ? (
            <div className="p-12 text-center bg-[#202225] border border-neutral-800 rounded-lg text-xs text-neutral-400">
              You are not following anyone yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {following.map((u) => (
                <div
                  key={u.uid}
                  className="bg-[#202225] border border-neutral-800 p-3.5 rounded flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      style={{ backgroundColor: u.avatarColor || '#3b82f6' }}
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-white text-xs truncate">{u.displayName || u.username}</div>
                      <div className="text-[11px] text-neutral-400 truncate">@{u.username}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleFollow(u)}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 cursor-pointer transition-colors"
                  >
                    Unfollow
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'followers' && (
        <div className="space-y-3">
          {followers.length === 0 ? (
            <div className="p-12 text-center bg-[#202225] border border-neutral-800 rounded-lg text-xs text-neutral-400">
              You have no followers yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {followers.map((u) => (
                <div
                  key={u.uid}
                  className="bg-[#202225] border border-neutral-800 p-3.5 rounded flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      style={{ backgroundColor: u.avatarColor || '#22c55e' }}
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-white text-xs truncate">{u.displayName || u.username}</div>
                      <div className="text-[11px] text-neutral-400 truncate">@{u.username}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
