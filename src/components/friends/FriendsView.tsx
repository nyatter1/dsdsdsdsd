import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  Check,
  X,
  UserMinus,
  Play,
  Heart,
  Clock,
  Compass,
} from 'lucide-react';
import {
  FriendUser,
  FriendRequest,
  FollowRecord,
  subscribeToMyFriends,
  subscribeToFriendRequests,
  subscribeToFollowing,
  subscribeToFollowers,
  subscribeToRealFirestoreUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  followUser,
  unfollowUser,
} from '../../utils/friendsStorage.ts';
import Avatar3DIcon from '../common/Avatar3DIcon.tsx';
import { AvatarColors } from '../AvatarCanvas3D.tsx';

interface FriendsViewProps {
  myUsername: string;
  myUid: string;
  myColors?: AvatarColors;
  myShirtUrl?: string | null;
  onViewProfile?: (user: FriendUser) => void;
  onLaunchGame?: () => void;
}

export default function FriendsView({
  myUsername,
  myUid,
  myColors,
  myShirtUrl,
  onViewProfile,
  onLaunchGame,
}: FriendsViewProps) {
  const [subTab, setSubTab] = useState<'friends' | 'requests' | 'following' | 'followers' | 'discover'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [allRealUsers, setAllRealUsers] = useState<FriendUser[]>([]);

  // Live Firestore state
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [following, setFollowing] = useState<FollowRecord[]>([]);
  const [followers, setFollowers] = useState<FollowRecord[]>([]);

  // Action status indicators
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Subscribe to real Firestore users and social relations
  useEffect(() => {
    const unsubUsers = subscribeToRealFirestoreUsers((users) => {
      setAllRealUsers(users);
    });
    const unsubFriends = subscribeToMyFriends(myUid, (f) => {
      setFriends(f);
    });
    const unsubReqs = subscribeToFriendRequests(myUid, (r) => {
      setRequests(r);
    });
    const unsubFollowing = subscribeToFollowing(myUid, (fol) => {
      setFollowing(fol);
    });
    const unsubFollowers = subscribeToFollowers(myUid, (fol) => {
      setFollowers(fol);
    });

    return () => {
      unsubUsers();
      unsubFriends();
      unsubReqs();
      unsubFollowing();
      unsubFollowers();
    };
  }, [myUid]);

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleAddFriend = async (targetUser: FriendUser) => {
    const success = await sendFriendRequest(
      { uid: myUid, username: myUsername, avatarColors: myColors, shirtUrl: myShirtUrl },
      {
        uid: targetUser.uid,
        username: targetUser.username,
        displayName: targetUser.displayName,
        avatarColors: targetUser.avatarColors,
        shirtUrl: targetUser.shirtUrl,
      }
    );
    if (success) {
      showNotification(`Friend request sent to @${targetUser.username}!`);
    } else {
      showNotification(`Friend request already pending with @${targetUser.username}.`);
    }
  };

  const handleAccept = async (req: FriendRequest) => {
    await acceptFriendRequest(req, {
      uid: myUid,
      username: myUsername,
      avatarColors: myColors,
      shirtUrl: myShirtUrl,
    });
    showNotification(`You and @${req.fromUsername} are now friends!`);
  };

  const handleDecline = async (reqId: string) => {
    await declineFriendRequest(reqId, myUid);
    showNotification('Friend request declined.');
  };

  const handleRemove = async (friend: FriendUser) => {
    if (window.confirm(`Are you sure you want to remove @${friend.username} from your friends?`)) {
      await removeFriend(friend.uid, myUid);
      showNotification(`Removed @${friend.username} from friends.`);
    }
  };

  const handleToggleFollow = async (target: FriendUser) => {
    const isFollowing = following.some((f) => f.uid === target.uid);
    if (isFollowing) {
      await unfollowUser(myUid, target.uid);
      showNotification(`Unfollowed @${target.username}.`);
    } else {
      await followUser(
        { uid: myUid, username: myUsername, avatarColors: myColors, shirtUrl: myShirtUrl },
        {
          uid: target.uid,
          username: target.username,
          displayName: target.displayName,
          avatarColors: target.avatarColors,
          shirtUrl: target.shirtUrl,
        }
      );
      showNotification(`Now following @${target.username}!`);
    }
  };

  const pendingIncomingRequests = requests.filter(
    (r) => r.toUid === myUid && r.status === 'pending'
  );

  // Search results from real registered users in Firestore
  const searchResults = searchQuery.trim()
    ? allRealUsers.filter((u) => {
        if (u.uid === myUid || u.username.toLowerCase() === myUsername.toLowerCase()) return false;
        const q = searchQuery.toLowerCase();
        return u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q);
      })
    : [];

  const otherRealUsers = allRealUsers.filter(
    (u) => u.uid !== myUid && u.username.toLowerCase() !== myUsername.toLowerCase()
  );

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-6">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className="fixed top-16 right-6 z-50 bg-[#25282f] border border-blue-500/80 text-white px-4 py-2.5 rounded shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-blue-400" />
            <span>Friends &amp; Social</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Connect with real registered Rovix players in Firestore, manage friend requests, and view profiles.
          </p>
        </div>

        {/* Search Real Users Input Bar */}
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search real players by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#202225] border border-neutral-700 pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-400 rounded focus:outline-none focus:border-blue-500 transition-colors"
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

      {/* SEARCH RESULTS TRAY */}
      {searchQuery.trim() && (
        <div className="bg-[#202225] border border-neutral-700/80 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-2">
            <span className="font-bold text-white">Search Results for "{searchQuery}"</span>
            <span>{searchResults.length} real players found</span>
          </div>

          {searchResults.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-400">
              No registered players found matching "{searchQuery}" in Firestore.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {searchResults.map((user) => {
                const isFriend = friends.some((f) => f.uid === user.uid);
                const isFollowed = following.some((f) => f.uid === user.uid);
                const isReqPending = requests.some((r) => r.toUid === user.uid && r.status === 'pending');

                return (
                  <div
                    key={user.uid}
                    className="p-3 bg-[#191b1d] border border-neutral-800 rounded flex items-center justify-between gap-3 hover:border-neutral-700 transition-all shadow-sm"
                  >
                    <div
                      onClick={() => onViewProfile?.(user)}
                      className="flex items-center gap-3 overflow-hidden cursor-pointer group flex-1"
                      title="Click to view profile"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#151619] border border-neutral-700 shrink-0 overflow-hidden flex items-center justify-center group-hover:border-blue-400 transition-colors">
                        <Avatar3DIcon colors={user.avatarColors} shirtUrl={user.shirtUrl} className="w-12 h-12" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-white text-xs truncate group-hover:text-blue-400 transition-colors">{user.displayName}</div>
                        <div className="text-[11px] text-neutral-400 truncate">@{user.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isFriend ? (
                        <span className="px-2 py-1 bg-emerald-950/60 border border-emerald-600/50 text-emerald-400 text-[10px] font-bold rounded flex items-center gap-1">
                          <Check className="w-3 h-3" /> Friends
                        </span>
                      ) : isReqPending ? (
                        <span className="px-2 py-1 bg-neutral-800 text-neutral-400 text-[10px] font-medium rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Sent
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddFriend(user)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                          title="Add Friend"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleFollow(user)}
                        className={`p-1.5 rounded text-xs border transition-colors cursor-pointer ${
                          isFollowed
                            ? 'bg-neutral-800 text-amber-400 border-amber-500/50 hover:bg-neutral-700'
                            : 'bg-[#232528] text-neutral-300 border-neutral-700 hover:text-white hover:bg-[#2b2e33]'
                        }`}
                        title={isFollowed ? 'Unfollow' : 'Follow'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFollowed ? 'fill-current text-amber-400' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('friends')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded transition-all cursor-pointer ${
            subTab === 'friends'
              ? 'bg-[#2b2e34] text-white border-b-2 border-blue-500 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-[#222428]'
          }`}
        >
          <Users className="w-4 h-4 text-blue-400" />
          <span>Friends</span>
          <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-mono">
            {friends.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('requests')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded transition-all cursor-pointer relative ${
            subTab === 'requests'
              ? 'bg-[#2b2e34] text-white border-b-2 border-blue-500 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-[#222428]'
          }`}
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>Friend Requests</span>
          {pendingIncomingRequests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-mono font-bold animate-pulse">
              {pendingIncomingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('following')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded transition-all cursor-pointer ${
            subTab === 'following'
              ? 'bg-[#2b2e34] text-white border-b-2 border-blue-500 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-[#222428]'
          }`}
        >
          <Heart className="w-4 h-4 text-amber-400" />
          <span>Following</span>
          <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-mono">
            {following.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('followers')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded transition-all cursor-pointer ${
            subTab === 'followers'
              ? 'bg-[#2b2e34] text-white border-b-2 border-blue-500 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-[#222428]'
          }`}
        >
          <UserCheck className="w-4 h-4 text-purple-400" />
          <span>Followers</span>
          <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-mono">
            {followers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('discover')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded transition-all cursor-pointer ${
            subTab === 'discover'
              ? 'bg-[#2b2e34] text-white border-b-2 border-blue-500 shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-[#222428]'
          }`}
        >
          <Compass className="w-4 h-4 text-blue-400" />
          <span>Discover Players ({otherRealUsers.length})</span>
        </button>
      </div>

      {/* TAB CONTENT: FRIENDS */}
      {subTab === 'friends' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>You have <strong className="text-white">{friends.length}</strong> real friends in Firestore</span>
            <span>Click any friend to view their profile or play together</span>
          </div>

          {friends.length === 0 ? (
            <div className="bg-[#202225] border border-neutral-800 rounded-lg p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">No Friends Yet</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Search real registered users using the search bar above or check the "Discover Players" tab to add players!
              </p>
              <button
                type="button"
                onClick={() => setSubTab('discover')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors cursor-pointer"
              >
                Browse Registered Players
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {friends.map((friend) => (
                <div
                  key={friend.uid}
                  className="bg-[#202225] border border-neutral-800 hover:border-neutral-600 rounded-lg p-4 flex flex-col justify-between space-y-4 transition-all shadow-md group"
                >
                  <div
                    onClick={() => onViewProfile?.(friend)}
                    className="flex items-center gap-3 cursor-pointer"
                    title="Click to view profile"
                  >
                    {/* 3D Model Icon with Online Indicator */}
                    <div className="relative shrink-0 w-12 h-12">
                      <div className="w-12 h-12 rounded-full bg-[#151619] border-2 border-neutral-700/80 group-hover:border-blue-400 transition-colors overflow-hidden flex items-center justify-center">
                        <Avatar3DIcon colors={friend.avatarColors} shirtUrl={friend.shirtUrl} className="w-12 h-12" />
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#202225] ${
                          friend.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'
                        }`}
                        title={friend.isOnline ? 'Online' : 'Offline'}
                      />
                    </div>

                    {/* Names */}
                    <div className="overflow-hidden">
                      <div className="font-bold text-white text-sm truncate group-hover:text-blue-400 transition-colors">
                        {friend.displayName}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">@{friend.username}</div>
                      <div className="text-[10px] text-emerald-400 mt-0.5 truncate font-medium">
                        {friend.statusText || (friend.isOnline ? 'Online' : 'Offline')}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
                    {friend.currentExperience && onLaunchGame && (
                      <button
                        type="button"
                        onClick={onLaunchGame}
                        className="flex-1 py-1.5 px-2 bg-[#2a6839] hover:bg-[#327a44] text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                        title="Join experience with friend"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Join</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemove(friend)}
                      className="p-1.5 bg-[#191b1d] hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-700/60 hover:border-red-600/50 rounded transition-colors cursor-pointer"
                      title="Remove Friend"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: FRIEND REQUESTS */}
      {subTab === 'requests' && (
        <div className="space-y-4">
          <div className="text-xs text-neutral-400">
            Real incoming and outgoing friend requests in Firestore
          </div>

          {requests.length === 0 ? (
            <div className="bg-[#202225] border border-neutral-800 rounded-lg p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No Friend Requests</h3>
              <p className="text-xs text-neutral-400">You don't have any pending requests at this time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {requests.map((req) => {
                const isIncoming = req.toUid === myUid;
                const requestUserObj: FriendUser = {
                  uid: isIncoming ? req.fromUid : req.toUid,
                  username: isIncoming ? req.fromUsername : req.toUsername,
                  displayName: isIncoming ? req.fromDisplayName : req.toUsername,
                  avatarColors: req.fromColors,
                  shirtUrl: req.fromShirtUrl,
                  isOnline: true,
                  addedAt: req.createdAt,
                };

                return (
                  <div
                    key={req.id}
                    className="bg-[#202225] border border-neutral-700/80 rounded-lg p-3.5 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div
                      onClick={() => onViewProfile?.(requestUserObj)}
                      className="flex items-center gap-3 overflow-hidden cursor-pointer group flex-1"
                      title="Click to view profile"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#151619] border border-neutral-700 shrink-0 overflow-hidden flex items-center justify-center group-hover:border-blue-400 transition-colors">
                        <Avatar3DIcon colors={req.fromColors} shirtUrl={req.fromShirtUrl} className="w-12 h-12" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-white text-xs truncate group-hover:text-blue-400 transition-colors">
                          {isIncoming ? req.fromDisplayName : `@${req.toUsername}`}
                        </div>
                        <div className="text-[11px] text-neutral-400 truncate">
                          {isIncoming ? `@${req.fromUsername}` : 'Outgoing Request'}
                        </div>
                        <div className="text-[10px] text-blue-400 mt-0.5">
                          {isIncoming ? 'Wants to be friends' : 'Waiting for approval'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isIncoming ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAccept(req)}
                            className="px-3 py-1.5 bg-[#2a6839] hover:bg-[#327a44] text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                            title="Accept Request"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecline(req.id)}
                            className="px-2.5 py-1.5 bg-[#191b1d] hover:bg-neutral-800 text-neutral-300 text-xs font-medium rounded border border-neutral-700 cursor-pointer transition-colors"
                            title="Decline Request"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDecline(req.id)}
                          className="px-2.5 py-1 bg-[#191b1d] hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-medium rounded border border-neutral-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: FOLLOWING */}
      {subTab === 'following' && (
        <div className="space-y-4">
          <div className="text-xs text-neutral-400">
            Real players you are following ({following.length})
          </div>

          {following.length === 0 ? (
            <div className="bg-[#202225] border border-neutral-800 rounded-lg p-10 text-center space-y-3">
              <Heart className="w-8 h-8 text-neutral-500 mx-auto" />
              <h3 className="text-sm font-bold text-white">Not Following Anyone Yet</h3>
              <p className="text-xs text-neutral-400">Search for players above and click the heart icon to follow them.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {following.map((user) => (
                <div
                  key={user.uid}
                  className="bg-[#202225] border border-neutral-700/80 rounded-lg p-3 flex items-center justify-between gap-3 shadow-sm"
                >
                  <div
                    onClick={() =>
                      onViewProfile?.({
                        uid: user.uid,
                        username: user.username,
                        displayName: user.displayName,
                        avatarColors: user.avatarColors,
                        shirtUrl: user.shirtUrl,
                        isOnline: true,
                        addedAt: user.followedAt,
                      })
                    }
                    className="flex items-center gap-2.5 overflow-hidden cursor-pointer group flex-1"
                    title="Click to view profile"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#151619] border border-neutral-700 shrink-0 overflow-hidden flex items-center justify-center group-hover:border-blue-400 transition-colors">
                      <Avatar3DIcon colors={user.avatarColors} shirtUrl={user.shirtUrl} className="w-10 h-10" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-white text-xs truncate group-hover:text-blue-400 transition-colors">{user.displayName}</div>
                      <div className="text-[11px] text-neutral-400 truncate">@{user.username}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => unfollowUser(myUid, user.uid)}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-[#191b1d] hover:bg-neutral-800 text-neutral-300 hover:text-red-400 border border-neutral-700 transition-colors cursor-pointer"
                  >
                    Unfollow
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: FOLLOWERS */}
      {subTab === 'followers' && (
        <div className="space-y-4">
          <div className="text-xs text-neutral-400">
            Real registered players who follow your activity ({followers.length})
          </div>

          {followers.length === 0 ? (
            <div className="bg-[#202225] border border-neutral-800 rounded-lg p-10 text-center space-y-3">
              <UserCheck className="w-8 h-8 text-neutral-500 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Followers Yet</h3>
              <p className="text-xs text-neutral-400">When other real players follow your profile, they will show up here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {followers.map((user) => {
                const isFriend = friends.some((f) => f.uid === user.uid);
                return (
                  <div
                    key={user.uid}
                    className="bg-[#202225] border border-neutral-700/80 rounded-lg p-3 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div
                      onClick={() =>
                        onViewProfile?.({
                          uid: user.uid,
                          username: user.username,
                          displayName: user.displayName,
                          avatarColors: user.avatarColors,
                          shirtUrl: user.shirtUrl,
                          isOnline: true,
                          addedAt: user.followedAt,
                        })
                      }
                      className="flex items-center gap-2.5 overflow-hidden cursor-pointer group flex-1"
                      title="Click to view profile"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#151619] border border-neutral-700 shrink-0 overflow-hidden flex items-center justify-center group-hover:border-blue-400 transition-colors">
                        <Avatar3DIcon colors={user.avatarColors} shirtUrl={user.shirtUrl} className="w-10 h-10" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-white text-xs truncate group-hover:text-blue-400 transition-colors">{user.displayName}</div>
                        <div className="text-[11px] text-neutral-400 truncate">@{user.username}</div>
                      </div>
                    </div>

                    {!isFriend && (
                      <button
                        type="button"
                        onClick={() =>
                          handleAddFriend({
                            uid: user.uid,
                            username: user.username,
                            displayName: user.displayName,
                            avatarColors: user.avatarColors,
                            shirtUrl: user.shirtUrl,
                            isOnline: true,
                            addedAt: Date.now(),
                          })
                        }
                        className="px-2.5 py-1 text-xs font-bold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: DISCOVER REAL USERS */}
      {subTab === 'discover' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>All registered accounts in Firestore ({otherRealUsers.length})</span>
            <span>Live 3D model icons &amp; custom avatars</span>
          </div>

          {otherRealUsers.length === 0 ? (
            <div className="bg-[#202225] border border-neutral-800 rounded-lg p-10 text-center space-y-3">
              <Compass className="w-10 h-10 text-blue-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Other Players Yet</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Open Rovix in another browser or tab and create an account. It will immediately show up here with their 3D model icon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {otherRealUsers.map((user) => {
                const isFriend = friends.some((f) => f.uid === user.uid);
                const isFollowed = following.some((f) => f.uid === user.uid);
                const isReqPending = requests.some((r) => r.toUid === user.uid && r.status === 'pending');

                return (
                  <div
                    key={user.uid}
                    className="bg-[#202225] border border-neutral-800 hover:border-neutral-600 rounded-lg p-4 flex flex-col justify-between space-y-4 transition-all shadow-md group"
                  >
                    <div
                      onClick={() => onViewProfile?.(user)}
                      className="flex items-center gap-3 cursor-pointer"
                      title="Click to view profile"
                    >
                      {/* 3D Model Icon */}
                      <div className="w-14 h-14 rounded-full bg-[#151619] border-2 border-neutral-700/80 group-hover:border-blue-400 shrink-0 overflow-hidden flex items-center justify-center transition-colors shadow">
                        <Avatar3DIcon colors={user.avatarColors} shirtUrl={user.shirtUrl} className="w-14 h-14" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-bold text-white text-sm truncate group-hover:text-blue-400 transition-colors">
                          {user.displayName}
                        </div>
                        <div className="text-xs text-neutral-400 truncate">@{user.username}</div>
                        <div className="text-[10px] text-emerald-400 mt-0.5 truncate font-medium">
                          Registered User
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
                      {isFriend ? (
                        <span className="flex-1 py-1.5 bg-emerald-950/60 border border-emerald-600/50 text-emerald-400 text-xs font-bold rounded flex items-center justify-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Friends
                        </span>
                      ) : isReqPending ? (
                        <span className="flex-1 py-1.5 bg-neutral-800 text-neutral-400 text-xs font-medium rounded flex items-center justify-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Sent
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddFriend(user)}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-sm"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add Friend</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleFollow(user)}
                        className={`p-1.5 rounded text-xs border transition-colors cursor-pointer ${
                          isFollowed
                            ? 'bg-neutral-800 text-amber-400 border-amber-500/50 hover:bg-neutral-700'
                            : 'bg-[#191b1d] text-neutral-300 border-neutral-700 hover:text-white hover:bg-[#232528]'
                        }`}
                        title={isFollowed ? 'Unfollow' : 'Follow'}
                      >
                        <Heart className={`w-4 h-4 ${isFollowed ? 'fill-current text-amber-400' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
