// src/config/creators.ts
// Registry mapping Patreon campaigns to YouTube channels

export interface Creator {
  patreonId: string;
  name: string;
  youtube?: {
    channelId: string;
    handle?: string;
  };
  topics: string[];
}

export const CREATORS: Creator[] = [
  {
    patreonId: '5338573',
    name: 'iOS App Development with SwiftUI',
    youtube: {
      channelId: 'UCsuV4MRk_aB291SrchUVb4w',  // TODO: Add channel ID
      handle: 'Kavsoft',
    },
    topics: ['swift', 'swiftui', 'ios'],
  },
];

export function getByPatreonId(id: string): Creator | undefined {
  return CREATORS.find(c => c.patreonId === id);
}

export function getByYouTubeChannel(channelId: string): Creator | undefined {
  return CREATORS.find(c => c.youtube?.channelId === channelId);
}

export function withYouTube(): Creator[] {
  return CREATORS.filter(c => c.youtube?.channelId);
}
