import {
  db,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
} from './firebase.ts';
import { AvatarColors } from '../components/AvatarCanvas3D.tsx';

export interface FriendUser {
  uid: string;
  username: string;
  displayName: string;
  avatarColors?: AvatarColors;
  shirtUrl?: string | null;
  pantsUrl?: string | null;
  backgroundUrl?: string | null;
  bio?: string;
  isOnline: boolean;
  statusText?: string;
  currentExperience?: string;
  addedAt: number;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  fromColors?: AvatarColors;
  fromShirtUrl?: string | null;
  fromPantsUrl?: string | null;
  fromBackgroundUrl?: string | null;
  toUid: string;
  toUsername: string;
  createdAt: number;
  status: 'pending' | 'accepted' | 'declined';
}

export interface FollowRecord {
  uid: string;
  username: string;
  displayName: string;
  avatarColors?: AvatarColors;
  shirtUrl?: string | null;
  pantsUrl?: string | null;
  backgroundUrl?: string | null;
  bio?: string;
  followedAt: number;
}

const STORAGE_KEYS = {
  FRIENDS_PREFIX: 'rovix_real_friends_',
  REQUESTS_PREFIX: 'rovix_real_requests_',
  FOLLOWING_PREFIX: 'rovix_real_following_',
  FOLLOWERS_PREFIX: 'rovix_real_followers_',
};

// Fetch all registered real Firestore users
export async function fetchAllRealFirestoreUsers(): Promise<FriendUser[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    const list: FriendUser[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.username) {
        list.push({
          uid: docSnap.id,
          username: data.username,
          displayName: data.displayName || data.username,
          avatarColors: data.avatarColors || undefined,
          shirtUrl: data.activeShirtUrl || data.shirtUrl || null,
          pantsUrl: data.activePantsUrl || data.pantsUrl || null,
          backgroundUrl: data.equippedBackgroundUrl || data.backgroundUrl || null,
          bio: data.bio || '',
          isOnline: true,
          statusText: 'Online',
          addedAt: Date.now(),
        });
      }
    });
    return list;
  } catch (err) {
    return [];
  }
}

// Real-time listener for all registered users in Firestore
export function subscribeToRealFirestoreUsers(callback: (users: FriendUser[]) => void): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }
  try {
    return onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: FriendUser[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.username) {
            list.push({
              uid: docSnap.id,
              username: data.username,
              displayName: data.displayName || data.username,
              avatarColors: data.avatarColors || undefined,
              shirtUrl: data.activeShirtUrl || data.shirtUrl || null,
              pantsUrl: data.activePantsUrl || data.pantsUrl || null,
              backgroundUrl: data.equippedBackgroundUrl || data.backgroundUrl || null,
              bio: data.bio || '',
              isOnline: true,
              statusText: 'Online',
              addedAt: Date.now(),
            });
          }
        });
        callback(list);
      },
      () => {
        // Fallback silently without throwing or breaking UI
      }
    );
  } catch {
    return () => {};
  }
}

// LocalStorage helpers for current user
export function getSavedFriends(myUid: string = 'local'): FriendUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FRIENDS_PREFIX + myUid);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveFriendsLocally(myUid: string, friends: FriendUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FRIENDS_PREFIX + myUid, JSON.stringify(friends));
  } catch {}
}

export function getSavedRequests(myUid: string = 'local'): FriendRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS_PREFIX + myUid);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveRequestsLocally(myUid: string, requests: FriendRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.REQUESTS_PREFIX + myUid, JSON.stringify(requests));
  } catch {}
}

export function getSavedFollowing(myUid: string = 'local'): FollowRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOLLOWING_PREFIX + myUid);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveFollowingLocally(myUid: string, following: FollowRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FOLLOWING_PREFIX + myUid, JSON.stringify(following));
  } catch {}
}

export function getSavedFollowers(myUid: string = 'local'): FollowRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOLLOWERS_PREFIX + myUid);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveFollowersLocally(myUid: string, followers: FollowRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FOLLOWERS_PREFIX + myUid, JSON.stringify(followers));
  } catch {}
}

// Real-time Firestore listener for My Friends
export function subscribeToMyFriends(
  myUid: string,
  callback: (friends: FriendUser[]) => void
): () => void {
  // Start with local cache immediately
  callback(getSavedFriends(myUid));

  if (!db || !myUid) return () => {};

  try {
    const friendsCol = collection(db, 'users', myUid, 'friends');
    return onSnapshot(
      friendsCol,
      (snap) => {
        const list: FriendUser[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as FriendUser;
          if (data && data.uid) {
            list.push(data);
          }
        });
        saveFriendsLocally(myUid, list);
        callback(list);
      },
      () => {
        // Fallback to local cache quietly
        callback(getSavedFriends(myUid));
      }
    );
  } catch {
    return () => {};
  }
}

// Real-time Firestore listener for Friend Requests
export function subscribeToFriendRequests(
  myUid: string,
  callback: (requests: FriendRequest[]) => void
): () => void {
  callback(getSavedRequests(myUid));

  if (!db || !myUid) return () => {};

  try {
    const reqsCol = collection(db, 'friend_requests');
    return onSnapshot(
      reqsCol,
      (snap) => {
        const list: FriendRequest[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as FriendRequest;
          if (data && (data.toUid === myUid || data.fromUid === myUid)) {
            list.push({ ...data, id: docSnap.id });
          }
        });
        saveRequestsLocally(myUid, list);
        callback(list);
      },
      () => {
        callback(getSavedRequests(myUid));
      }
    );
  } catch {
    return () => {};
  }
}

// Real-time Firestore listener for Following
export function subscribeToFollowing(
  myUid: string,
  callback: (following: FollowRecord[]) => void
): () => void {
  callback(getSavedFollowing(myUid));

  if (!db || !myUid) return () => {};

  try {
    const folCol = collection(db, 'users', myUid, 'following');
    return onSnapshot(
      folCol,
      (snap) => {
        const list: FollowRecord[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as FollowRecord;
          if (data && data.uid) list.push(data);
        });
        saveFollowingLocally(myUid, list);
        callback(list);
      },
      () => {}
    );
  } catch {
    return () => {};
  }
}

// Real-time Firestore listener for Followers
export function subscribeToFollowers(
  myUid: string,
  callback: (followers: FollowRecord[]) => void
): () => void {
  callback(getSavedFollowers(myUid));

  if (!db || !myUid) return () => {};

  try {
    const folCol = collection(db, 'users', myUid, 'followers');
    return onSnapshot(
      folCol,
      (snap) => {
        const list: FollowRecord[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as FollowRecord;
          if (data && data.uid) list.push(data);
        });
        saveFollowersLocally(myUid, list);
        callback(list);
      },
      () => {}
    );
  } catch {
    return () => {};
  }
}

// Send Real Friend Request to a Real User in Firestore
export async function sendFriendRequest(
  fromUser: {
    uid: string;
    username: string;
    displayName?: string;
    avatarColors?: AvatarColors;
    shirtUrl?: string | null;
    pantsUrl?: string | null;
    backgroundUrl?: string | null;
  },
  targetUser: {
    uid: string;
    username: string;
    displayName?: string;
    avatarColors?: AvatarColors;
    shirtUrl?: string | null;
    pantsUrl?: string | null;
    backgroundUrl?: string | null;
  }
): Promise<boolean> {
  const reqId = `req_${fromUser.uid}_${targetUser.uid}`;
  const newReq: FriendRequest = {
    id: reqId,
    fromUid: fromUser.uid,
    fromUsername: fromUser.username,
    fromDisplayName: fromUser.displayName || fromUser.username,
    fromColors: fromUser.avatarColors,
    fromShirtUrl: fromUser.shirtUrl || null,
    fromPantsUrl: fromUser.pantsUrl || null,
    fromBackgroundUrl: fromUser.backgroundUrl || null,
    toUid: targetUser.uid,
    toUsername: targetUser.username,
    createdAt: Date.now(),
    status: 'pending',
  };

  const localReqs = getSavedRequests(fromUser.uid);
  if (localReqs.some((r) => r.toUid === targetUser.uid && r.status === 'pending')) {
    return false;
  }
  localReqs.push(newReq);
  saveRequestsLocally(fromUser.uid, localReqs);

  if (db) {
    try {
      const cleanReq = JSON.parse(JSON.stringify(newReq));
      await setDoc(doc(db, 'friend_requests', reqId), cleanReq);
      return true;
    } catch (err) {
      console.error('[Friends] Error writing friend request to Firestore:', err);
    }
  }
  return true;
}

// Accept Friend Request & write mutual friendship in Firestore
export async function acceptFriendRequest(
  request: FriendRequest,
  myUser: {
    uid: string;
    username: string;
    displayName?: string;
    avatarColors?: AvatarColors;
    shirtUrl?: string | null;
    pantsUrl?: string | null;
    backgroundUrl?: string | null;
  }
): Promise<void> {
  const localReqs = getSavedRequests(myUser.uid).filter((r) => r.id !== request.id);
  saveRequestsLocally(myUser.uid, localReqs);

  const myFriends = getSavedFriends(myUser.uid);
  const newFriendForMe: FriendUser = {
    uid: request.fromUid,
    username: request.fromUsername,
    displayName: request.fromDisplayName,
    avatarColors: request.fromColors,
    shirtUrl: request.fromShirtUrl || null,
    pantsUrl: request.fromPantsUrl || null,
    backgroundUrl: request.fromBackgroundUrl || null,
    isOnline: true,
    statusText: 'Online',
    addedAt: Date.now(),
  };

  if (!myFriends.some((f) => f.uid === newFriendForMe.uid)) {
    myFriends.unshift(newFriendForMe);
    saveFriendsLocally(myUser.uid, myFriends);
  }

  const friendSelfForOther: FriendUser = {
    uid: myUser.uid,
    username: myUser.username,
    displayName: myUser.displayName || myUser.username,
    avatarColors: myUser.avatarColors,
    shirtUrl: myUser.shirtUrl || null,
    pantsUrl: myUser.pantsUrl || null,
    backgroundUrl: myUser.backgroundUrl || null,
    isOnline: true,
    statusText: 'Online',
    addedAt: Date.now(),
  };

  if (db) {
    try {
      await deleteDoc(doc(db, 'friend_requests', request.id)).catch(() => {});
      const cleanForMe = JSON.parse(JSON.stringify(newFriendForMe));
      const cleanForOther = JSON.parse(JSON.stringify(friendSelfForOther));
      await setDoc(doc(db, 'users', myUser.uid, 'friends', request.fromUid), cleanForMe);
      await setDoc(doc(db, 'users', request.fromUid, 'friends', myUser.uid), cleanForOther);
    } catch (err) {
      console.error('[Friends] Error writing accepted friendship in Firestore:', err);
    }
  }
}

// Decline Friend Request
export async function declineFriendRequest(requestId: string, myUid: string): Promise<void> {
  const localReqs = getSavedRequests(myUid).filter((r) => r.id !== requestId);
  saveRequestsLocally(myUid, localReqs);

  if (db) {
    try {
      await deleteDoc(doc(db, 'friend_requests', requestId));
    } catch {}
  }
}

// Remove Friend
export async function removeFriend(friendUid: string, myUid: string): Promise<void> {
  const myFriends = getSavedFriends(myUid).filter((f) => f.uid !== friendUid);
  saveFriendsLocally(myUid, myFriends);

  if (db && myUid) {
    try {
      await deleteDoc(doc(db, 'users', myUid, 'friends', friendUid));
      await deleteDoc(doc(db, 'users', friendUid, 'friends', myUid));
    } catch {}
  }
}

// Follow User
export async function followUser(
  myUser: {
    uid: string;
    username: string;
    displayName?: string;
    avatarColors?: AvatarColors;
    shirtUrl?: string | null;
    pantsUrl?: string | null;
    backgroundUrl?: string | null;
  },
  targetUser: {
    uid: string;
    username: string;
    displayName?: string;
    avatarColors?: AvatarColors;
    shirtUrl?: string | null;
    pantsUrl?: string | null;
    backgroundUrl?: string | null;
  }
): Promise<void> {
  if (!myUser.uid || !targetUser.uid) return;

  const following = getSavedFollowing(myUser.uid);
  if (following.some((f) => f.uid === targetUser.uid)) return;

  const record: FollowRecord = {
    uid: targetUser.uid,
    username: targetUser.username,
    displayName: targetUser.displayName || targetUser.username,
    avatarColors: targetUser.avatarColors,
    shirtUrl: targetUser.shirtUrl || null,
    pantsUrl: targetUser.pantsUrl || null,
    backgroundUrl: targetUser.backgroundUrl || null,
    followedAt: Date.now(),
  };
  following.unshift(record);
  saveFollowingLocally(myUser.uid, following);

  const targetFollowers = getSavedFollowers(targetUser.uid);
  const followerRecord: FollowRecord = {
    uid: myUser.uid,
    username: myUser.username,
    displayName: myUser.displayName || myUser.username,
    avatarColors: myUser.avatarColors,
    shirtUrl: myUser.shirtUrl || null,
    pantsUrl: myUser.pantsUrl || null,
    backgroundUrl: myUser.backgroundUrl || null,
    followedAt: Date.now(),
  };
  if (!targetFollowers.some((f) => f.uid === myUser.uid)) {
    targetFollowers.unshift(followerRecord);
    saveFollowersLocally(targetUser.uid, targetFollowers);
  }

  if (db) {
    try {
      const cleanFollowing = JSON.parse(JSON.stringify(record));
      const cleanFollower = JSON.parse(JSON.stringify(followerRecord));
      await setDoc(doc(db, 'users', myUser.uid, 'following', targetUser.uid), cleanFollowing);
      await setDoc(doc(db, 'users', targetUser.uid, 'followers', myUser.uid), cleanFollower);
    } catch (err) {
      console.error('[Friends] Error writing follow in Firestore:', err);
    }
  }
}

// Unfollow User
export async function unfollowUser(myUid: string, targetUid: string): Promise<void> {
  if (!myUid || !targetUid) return;

  const following = getSavedFollowing(myUid).filter((f) => f.uid !== targetUid);
  saveFollowingLocally(myUid, following);

  const targetFollowers = getSavedFollowers(targetUid).filter((f) => f.uid !== myUid);
  saveFollowersLocally(targetUid, targetFollowers);

  if (db) {
    try {
      await deleteDoc(doc(db, 'users', myUid, 'following', targetUid));
      await deleteDoc(doc(db, 'users', targetUid, 'followers', myUid));
    } catch {}
  }
}
