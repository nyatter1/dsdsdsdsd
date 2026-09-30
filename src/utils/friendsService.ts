import { db, doc, getDoc, setDoc, collection, getDocs, query, where } from './firebase.ts';

export interface FriendUser {
  uid: string;
  username: string;
  displayName: string;
  avatarColor?: string;
  status: 'online' | 'in_experience' | 'offline';
  currentGameTitle?: string;
  lastSeen?: number;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  toUid: string;
  toUsername: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'declined';
}

const STORAGE_KEY_FRIENDS_PREFIX = 'rovix_friends_v1_';
const STORAGE_KEY_REQUESTS_PREFIX = 'rovix_friend_reqs_v1_';
const STORAGE_KEY_FOLLOWING_PREFIX = 'rovix_following_v1_';
const STORAGE_KEY_FOLLOWERS_PREFIX = 'rovix_followers_v1_';

// Initial default Rovix platform friends
const DEFAULT_PLATFORM_USERS: FriendUser[] = [
  {
    uid: 'user_builderman',
    username: 'Builderman',
    displayName: 'Builderman',
    avatarColor: '#f5cd2f',
    status: 'online',
    lastSeen: Date.now() - 1000 * 60 * 2,
  },
  {
    uid: 'user_rovix_dev',
    username: 'RovixDev',
    displayName: 'Rovix Creator',
    avatarColor: '#0d69ac',
    status: 'in_experience',
    currentGameTitle: 'Test Place',
    lastSeen: Date.now() - 1000 * 30,
  },
  {
    uid: 'user_pixel_builder',
    username: 'PixelBuilder',
    displayName: 'Pixel Master',
    avatarColor: '#27803a',
    status: 'online',
    lastSeen: Date.now() - 1000 * 60 * 15,
  },
  {
    uid: 'user_block_legend',
    username: 'BlockLegend',
    displayName: 'BlockLegend',
    avatarColor: '#b43232',
    status: 'offline',
    lastSeen: Date.now() - 1000 * 60 * 120,
  },
];

export function getLocalFriends(myUid: string): FriendUser[] {
  const raw = localStorage.getItem(STORAGE_KEY_FRIENDS_PREFIX + myUid);
  if (!raw) {
    // Seed with initial platform friends for a lively experience
    const initial = DEFAULT_PLATFORM_USERS.slice(0, 3);
    localStorage.setItem(STORAGE_KEY_FRIENDS_PREFIX + myUid, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalFriends(myUid: string, friends: FriendUser[]): void {
  localStorage.setItem(STORAGE_KEY_FRIENDS_PREFIX + myUid, JSON.stringify(friends));
}

export function getLocalFriendRequests(myUid: string): FriendRequest[] {
  const raw = localStorage.getItem(STORAGE_KEY_REQUESTS_PREFIX + myUid);
  if (!raw) {
    const initial: FriendRequest[] = [
      {
        id: 'req_seed_1',
        fromUid: 'user_block_legend',
        fromUsername: 'BlockLegend',
        fromDisplayName: 'BlockLegend',
        toUid: myUid,
        toUsername: 'You',
        timestamp: Date.now() - 1000 * 60 * 35,
        status: 'pending',
      },
    ];
    localStorage.setItem(STORAGE_KEY_REQUESTS_PREFIX + myUid, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalFriendRequests(myUid: string, reqs: FriendRequest[]): void {
  localStorage.setItem(STORAGE_KEY_REQUESTS_PREFIX + myUid, JSON.stringify(reqs));
}

export function getLocalFollowing(myUid: string): FriendUser[] {
  const raw = localStorage.getItem(STORAGE_KEY_FOLLOWING_PREFIX + myUid);
  if (!raw) {
    const initial = [DEFAULT_PLATFORM_USERS[0], DEFAULT_PLATFORM_USERS[1]];
    localStorage.setItem(STORAGE_KEY_FOLLOWING_PREFIX + myUid, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalFollowing(myUid: string, following: FriendUser[]): void {
  localStorage.setItem(STORAGE_KEY_FOLLOWING_PREFIX + myUid, JSON.stringify(following));
}

export function getLocalFollowers(myUid: string): FriendUser[] {
  const raw = localStorage.getItem(STORAGE_KEY_FOLLOWERS_PREFIX + myUid);
  if (!raw) {
    const initial = [DEFAULT_PLATFORM_USERS[2]];
    localStorage.setItem(STORAGE_KEY_FOLLOWERS_PREFIX + myUid, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalFollowers(myUid: string, followers: FriendUser[]): void {
  localStorage.setItem(STORAGE_KEY_FOLLOWERS_PREFIX + myUid, JSON.stringify(followers));
}

export async function searchUsers(queryText: string, currentUid: string): Promise<FriendUser[]> {
  const cleanQ = queryText.trim().toLowerCase();
  if (!cleanQ) return [];

  const resultsMap = new Map<string, FriendUser>();

  // 1. Check known mock/community users
  DEFAULT_PLATFORM_USERS.forEach((u) => {
    if (u.uid !== currentUid && (u.username.toLowerCase().includes(cleanQ) || u.displayName.toLowerCase().includes(cleanQ))) {
      resultsMap.set(u.uid, u);
    }
  });

  // 2. Query Firebase Firestore users collection
  if (db) {
    try {
      const usersCol = collection(db, 'users');
      const snap = await getDocs(usersCol);
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data && docSnap.id !== currentUid) {
          const uname = data.username || '';
          const dname = data.displayName || uname;
          if (uname.toLowerCase().includes(cleanQ) || dname.toLowerCase().includes(cleanQ)) {
            resultsMap.set(docSnap.id, {
              uid: docSnap.id,
              username: uname,
              displayName: dname,
              avatarColor: data.avatarColors?.head || '#f5cd2f',
              status: 'online',
              lastSeen: Date.now(),
            });
          }
        }
      });
    } catch (e) {
      console.warn('Firestore user search fallback:', e);
    }
  }

  return Array.from(resultsMap.values());
}
