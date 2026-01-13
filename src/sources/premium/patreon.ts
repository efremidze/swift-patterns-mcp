// src/sources/premium/patreon.ts

import fetch from "node-fetch"

const API_BASE = "https://www.patreon.com/api/oauth2/v2"

export interface PatreonCreator {
  id: string
  name: string
  url?: string
}

export class PatreonSource {
  constructor(private accessToken: string) {}

  private async request(path: string) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      }
    })

    if (!res.ok) {
      throw new Error(`Patreon API error ${res.status}`)
    }

    return res.json()
  }

  /**
   * ✅ CORRECT WAY
   * Returns creators the user PAYS (patron memberships)
   */
  async getPatronMemberships(): Promise<PatreonCreator[]> {
    const res = await this.request(
      "/identity?include=memberships.campaign"
    )

    const included = res.included ?? []

    const memberships = included.filter(
      (i: any) =>
        i.type === "member" &&
        i.attributes?.patron_status === "active_patron"
    )

    if (memberships.length === 0) {
      throw new Error(
        "No active Patreon memberships found. You must be a paying patron of at least one creator."
      )
    }

    return memberships.map((member: any) => {
      const campaignId = member.relationships.campaign.data.id

      const campaign = included.find(
        (i: any) => i.type === "campaign" && i.id === campaignId
      )

      return {
        id: campaign.id,
        name: campaign.attributes.name,
        url: campaign.attributes.url
      }
    })
  }

  /**
   * Optional: creator-owned campaigns (NOT subscriptions)
   * Keep only if you want creator-mode later
   */
  async getOwnedCampaigns(): Promise<PatreonCreator[]> {
    const res = await this.request("/campaigns")

    return res.data.map((c: any) => ({
      id: c.id,
      name: c.attributes.name,
      url: c.attributes.url
    }))
  }

  /**
   * Fetch posts from a creator the user is entitled to
   */
  async fetchPosts(campaignId: string) {
    return this.request(
      `/campaigns/${campaignId}/posts`
    )
  }
}
