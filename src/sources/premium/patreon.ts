// src/sources/premium/patreon.ts

import { getValidAccessToken } from "./patreon-oauth.js"

const API_BASE = "https://www.patreon.com/api/oauth2/v2"

export interface PatreonCreator {
  id: string
  name: string
  url?: string
  isSwiftRelated?: boolean
}

interface PatreonApiResponse {
  data: unknown
  included?: Array<{
    id: string
    type: string
    attributes: Record<string, unknown>
    relationships?: Record<string, { data: { id: string; type: string } }>
  }>
}

export class PatreonSource {
  private clientId: string
  private clientSecret: string

  constructor() {
    this.clientId = process.env.PATREON_CLIENT_ID || ""
    this.clientSecret = process.env.PATREON_CLIENT_SECRET || ""
  }

  private async request(path: string): Promise<PatreonApiResponse> {
    const accessToken = await getValidAccessToken(this.clientId, this.clientSecret)
    if (!accessToken) {
      throw new Error("No valid access token. Please run setup first.")
    }

    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!res.ok) {
      throw new Error(`Patreon API error ${res.status}`)
    }

    return res.json() as Promise<PatreonApiResponse>
  }

  /**
   * Returns creators the user PAYS (patron memberships)
   * Uses identity endpoint with memberships.campaign include
   */
  async getPatronMemberships(): Promise<PatreonCreator[]> {
    const res = await this.request(
      "/identity" +
        "?include=memberships.campaign" +
        "&fields[member]=patron_status" +
        "&fields[campaign]=name,url"
    )

    const included = res.included ?? []

    const memberships = included.filter(
      (i) =>
        i.type === "member" &&
        i.attributes?.patron_status === "active_patron"
    )

    const creators: PatreonCreator[] = []

    for (const member of memberships) {
      const campaignId = member.relationships?.campaign?.data?.id
      if (!campaignId) continue

      const campaign = included.find(
        (i) => i.type === "campaign" && i.id === campaignId
      )

      if (!campaign?.attributes?.name) continue

      creators.push({
        id: campaign.id,
        name: campaign.attributes.name,
        url: campaign.attributes.url,
        isSwiftRelated: isSwiftRelated(campaign.attributes.name)
      })
    }

    if (creators.length === 0) {
      throw new Error(
        "No active Patreon memberships found. You must be a paying patron of at least one creator."
      )
    }

    return creators
  }

  /**
   * Alias for backwards compatibility with setup.ts
   */
  async getSubscribedCreators(): Promise<PatreonCreator[]> {
    return this.getPatronMemberships()
  }

  /**
   * Optional: creator-owned campaigns (NOT subscriptions)
   */
  async getOwnedCampaigns(): Promise<PatreonCreator[]> {
    const res = await this.request("/campaigns")
    const data = res.data as Array<{
      id: string
      attributes: { name: string; url?: string }
    }>

    return data.map((c) => ({
      id: c.id,
      name: c.attributes.name,
      url: c.attributes.url
    }))
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret)
  }
}

function isSwiftRelated(name: string): boolean {
  const lower = name.toLowerCase()
  const keywords = ["swift", "swiftui", "ios", "apple", "xcode", "uikit", "iphone", "ipad"]
  return keywords.some((k) => lower.includes(k))
}

export default PatreonSource
