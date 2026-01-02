/**
 * Supabase Direct Query Client
 *
 * Uses Supabase's REST API for read-only database queries.
 * Works in serverless environments (Vercel, etc.) without needing MCP.
 *
 * Environment variables required:
 * - SUPABASE_PROJECT_REF: Your project reference ID
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for direct DB access (keep secret!)
 *
 * Or use the anon key for RLS-protected queries:
 * - SUPABASE_ANON_KEY: Anonymous/public key
 */

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

/**
 * Check if Supabase is configured for direct queries
 */
export function isSupabaseConfigured() {
  return !!(
    SUPABASE_PROJECT_REF &&
    SUPABASE_PROJECT_REF !== 'YOUR_PROJECT_REF_HERE' &&
    (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)
  )
}

/**
 * Get the Supabase REST API base URL
 */
function getSupabaseUrl() {
  return `https://${SUPABASE_PROJECT_REF}.supabase.co`
}

/**
 * Get the appropriate API key (service role preferred for internal queries)
 */
function getApiKey() {
  return SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
}

/**
 * Execute a raw SQL query via Supabase's RPC endpoint
 * @param {string} sql - The SQL query to execute
 * @returns {Promise<any>} Query results
 */
export async function executeSQL(sql) {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase not configured. Set SUPABASE_PROJECT_REF and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  const url = `${getSupabaseUrl()}/rest/v1/rpc/execute_sql`
  const apiKey = getApiKey()

  // First, try the RPC endpoint (if a function exists)
  // If not, we'll use the pg_query approach
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: sql }),
    })

    if (response.ok) {
      return await response.json()
    }
  } catch (e) {
    // RPC function doesn't exist, fall back to direct approach
  }

  // For aggregate queries, we can't use PostgREST directly
  // We need to use the Supabase query builder or create a view/function
  throw new Error('Direct SQL execution requires an RPC function. Use queryRevenue() instead.')
}

/**
 * Query revenue from mv_all_payments_v2 using PostgREST
 * @param {Date} startDate - Start of the date range
 * @param {Date} endDate - End of the date range
 * @returns {Promise<{totalDollars: number, transactionCount: number}>}
 */
export async function queryRevenue(startDate, endDate) {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase not configured. Set SUPABASE_PROJECT_REF and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  const baseUrl = `${getSupabaseUrl()}/rest/v1/mv_all_payments_v2`
  const apiKey = getApiKey()

  // Format dates for PostgREST query
  const startISO = startDate instanceof Date ? startDate.toISOString() : startDate
  const endISO = endDate instanceof Date ? endDate.toISOString() : endDate

  // Query for the sum and count using PostgREST
  // We need to select all matching rows and aggregate client-side
  // OR use a database function/view for server-side aggregation

  // Fetch all matching rows and aggregate client-side
  // Using limit=100000 to bypass PostgREST default limit (usually 1000)
  const url = `${baseUrl}?datetime=gte.${startISO}&datetime=lte.${endISO}&select=income&limit=100000`

  console.log(`📊 Supabase Query: Fetching revenue from ${startISO} to ${endISO}`)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Prefer: 'count=exact', // Get total count in header
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`📊 Supabase Query Error:`, errorText)
    throw new Error(`Supabase query failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const count = parseInt(response.headers.get('content-range')?.split('/')[1] || '0', 10)

  // DEBUG: Log row counts to diagnose limit issues
  console.log(`📊 Supabase DEBUG: Header says ${count} total rows`)
  console.log(`📊 Supabase DEBUG: Actually received ${data.length} rows`)
  console.log(`📊 Supabase DEBUG: URL was: ${url}`)

  // Sum up the income client-side
  const totalDollars = data.reduce((sum, row) => sum + (parseFloat(row.income) || 0), 0)

  console.log(`📊 Supabase Query: $${totalDollars.toFixed(2)} from ${count} transactions`)

  return {
    totalDollars,
    transactionCount: count,
    firstTransaction: data.length > 0 ? data[0].datetime : null,
    lastTransaction: data.length > 0 ? data[data.length - 1].datetime : null,
  }
}

/**
 * Query revenue using a direct SQL approach via PostgREST RPC
 * Requires a database function to be created first
 */
export async function queryRevenueSQL(startDate, endDate) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured.')
  }

  const baseUrl = getSupabaseUrl()
  const apiKey = getApiKey()

  // Format dates
  const startISO = startDate instanceof Date ? startDate.toISOString() : startDate
  const endISO = endDate instanceof Date ? endDate.toISOString() : endDate

  // Call the RPC function for revenue query
  const url = `${baseUrl}/rest/v1/rpc/get_revenue_summary`

  console.log(`📊 Supabase RPC: Querying revenue from ${startISO} to ${endISO}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      start_date: startISO,
      end_date: endISO,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    // If RPC doesn't exist, fall back to row-by-row query
    if (
      response.status === 404 ||
      errorText.includes('function') ||
      errorText.includes('not exist')
    ) {
      console.log(`📊 Supabase: RPC not available, using row query...`)
      return queryRevenue(startDate, endDate)
    }
    console.error(`📊 Supabase RPC Error:`, errorText)
    throw new Error(`Supabase RPC failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  // Handle both array and single object responses
  const result = Array.isArray(data) ? data[0] : data

  console.log(
    `📊 Supabase RPC SUCCESS: $${result?.total_dollars} from ${result?.transaction_count} transactions (server-side aggregation)`
  )

  return {
    totalDollars: parseFloat(result?.total_dollars || result?.total || 0),
    transactionCount: parseInt(result?.transaction_count || result?.count || 0, 10),
    firstTransaction: result?.first_transaction || null,
    lastTransaction: result?.last_transaction || null,
  }
}

export default {
  isSupabaseConfigured,
  executeSQL,
  queryRevenue,
  queryRevenueSQL,
}
