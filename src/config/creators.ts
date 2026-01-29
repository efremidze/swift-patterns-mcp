// src/config/creators.ts
// Registry mapping creators to their Patreon and YouTube

interface Creator {
  id: string;
  name: string;
  patreonCampaignId: string;
  youtubeChannelId?: string;
}

export const CREATORS: Creator[] = [
  {
    id: 'kavsoft',
    name: 'Kavsoft',
    patreonCampaignId: '5338573',
    youtubeChannelId: 'UCsuV4MRk_aB291SrchUVb4w',
  },
  {
    id: 'sucodee',
    name: "sucodee",
    patreonCampaignId: '9794927',
    youtubeChannelId: 'UC9YE4KZX3z89F0LkDRXjpJg',
  },
  {
    id: 'SwiftUICodes',
    name: 'SwiftUICodes',
    patreonCampaignId: '11011366',
    youtubeChannelId: 'UCvEdo8AyAUg_LqOr8rzTTbA',
  },
];

export function withYouTube(): Creator[] {
  return CREATORS.filter(c => c.youtubeChannelId);
}
