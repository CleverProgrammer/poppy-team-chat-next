/**
 * RocketReach API Client
 * For looking up people's contact info (emails, phone numbers, LinkedIn, etc.)
 * 
 * Works great with Tavily - use Tavily to find person's name + company,
 * then use RocketReach to get their actual contact info.
 */

const ROCKETREACH_API_KEY = process.env.ROCKETREACH_API_KEY

/**
 * Look up a person's contact information by name and current employer
 * @param {string} name - Person's full name (e.g., "Petr Nikolaev")
 * @param {string} currentEmployer - Company they work at (e.g., "Raycast")
 * @returns {object} - Person's profile with email, phone, LinkedIn, etc.
 */
export async function lookupPerson(name, currentEmployer) {
  if (!ROCKETREACH_API_KEY) {
    throw new Error('ROCKETREACH_API_KEY environment variable not set')
  }

  console.log(`🚀 RocketReach: Looking up ${name} at ${currentEmployer}`)

  // Build URL with query params
  const params = new URLSearchParams()
  if (name) params.append('name', name)
  if (currentEmployer) params.append('current_employer', currentEmployer)

  const url = `https://api.rocketreach.co/api/v2/person/lookup?${params.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Api-Key': ROCKETREACH_API_KEY,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`🚀 RocketReach: API Error ${response.status}:`, errorText)
    
    if (response.status === 404) {
      return {
        found: false,
        message: `No profile found for ${name} at ${currentEmployer}`,
      }
    }
    
    throw new Error(`RocketReach API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log(`🚀 RocketReach: Found profile for ${name}`)

  // Return cleaned up profile with the most useful fields
  return {
    found: true,
    name: data.name,
    firstName: data.first_name,
    lastName: data.last_name,
    title: data.current_title,
    company: data.current_employer,
    email: data.email || data.emails?.[0],
    emails: data.emails || [],
    phone: data.phone || data.phones?.[0]?.number,
    phones: data.phones || [],
    linkedIn: data.linkedin_url,
    twitter: data.twitter_url,
    location: data.location,
    city: data.city,
    region: data.region,
    country: data.country_code,
    profile: data,  // Full profile for advanced use
  }
}

/**
 * Search for people matching criteria
 * @param {object} criteria - Search criteria
 * @param {string} criteria.name - Person's name (partial match)
 * @param {string} criteria.company - Company name
 * @param {string} criteria.title - Job title
 * @param {string} criteria.location - Location/city
 * @returns {array} - List of matching profiles
 */
export async function searchPeople(criteria) {
  if (!ROCKETREACH_API_KEY) {
    throw new Error('ROCKETREACH_API_KEY environment variable not set')
  }

  console.log(`🚀 RocketReach: Searching for people:`, criteria)

  const response = await fetch('https://api.rocketreach.co/api/v2/search', {
    method: 'POST',
    headers: {
      'Api-Key': ROCKETREACH_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        name: criteria.name ? [criteria.name] : undefined,
        current_employer: criteria.company ? [criteria.company] : undefined,
        current_title: criteria.title ? [criteria.title] : undefined,
        location: criteria.location ? [criteria.location] : undefined,
      },
      start: 1,
      page_size: 10,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`🚀 RocketReach: Search Error ${response.status}:`, errorText)
    throw new Error(`RocketReach search error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log(`🚀 RocketReach: Found ${data.profiles?.length || 0} profiles`)

  return {
    total: data.pagination?.total || 0,
    profiles: (data.profiles || []).map(p => ({
      name: p.name,
      title: p.current_title,
      company: p.current_employer,
      email: p.teaser?.emails?.[0],
      linkedIn: p.linkedin_url,
      location: p.location,
      id: p.id,  // Can be used for full lookup later
    })),
  }
}

export default {
  lookupPerson,
  searchPeople,
}

