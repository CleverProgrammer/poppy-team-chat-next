// ═══════════════════════════════════════════════════════════════════════════════
// AIRTABLE CLIENT - Fetches records from Airtable REST API with pagination
// Supports in-memory SQL via alasql for accurate calculations
// ═══════════════════════════════════════════════════════════════════════════════

// alasql is marked as serverExternalPackages in next.config.mjs
// so Node.js handles it natively (avoids Turbopack react-native-fs issue)
import alasql from 'alasql'

const AIRTABLE_API_URL = 'https://api.airtable.com/v0'
const RECORDS_PER_PAGE = 100 // Airtable max

/**
 * Parse an Airtable URL to extract base, table, and view IDs
 * Example: https://airtable.com/appXXX/tblYYY/viwZZZ
 */
export function parseAirtableUrl(url) {
  if (!url) return {}
  const match = url.match(/airtable\.com\/(app[a-zA-Z0-9]+)\/(tbl[a-zA-Z0-9]+)(?:\/(viw[a-zA-Z0-9]+))?/)
  if (!match) return {}
  return {
    baseId: match[1],
    tableId: match[2],
    viewId: match[3] || null,
  }
}

/**
 * Get default Airtable config from environment variables
 */
function getDefaultConfig() {
  return {
    apiKey: process.env.AIRTABLE_API_KEY,
    baseId: process.env.AIRTABLE_DEFAULT_BASE,
    tableId: process.env.AIRTABLE_DEFAULT_TABLE,
    viewId: process.env.AIRTABLE_DEFAULT_VIEW,
  }
}

/**
 * Fetch ALL records from an Airtable table/view with automatic pagination
 * Airtable returns max 100 records per request, so we loop through pages
 *
 * @param {object} options
 * @param {string} options.baseId - Airtable base ID (e.g., appXXX)
 * @param {string} options.tableId - Airtable table ID (e.g., tblYYY)
 * @param {string} [options.viewId] - Airtable view ID (e.g., viwZZZ)
 * @param {string} [options.filterByFormula] - Airtable formula filter
 * @param {string[]} [options.fields] - Specific fields to return
 * @param {number} [options.maxRecords] - Maximum records to fetch (default: all)
 * @returns {Promise<{records: object[], fieldNames: string[]}>}
 */
export async function fetchAllRecords(options = {}) {
  const config = getDefaultConfig()
  const baseId = options.baseId || config.baseId
  const tableId = options.tableId || config.tableId
  const viewId = options.viewId || config.viewId
  const apiKey = config.apiKey

  if (!apiKey) throw new Error('AIRTABLE_API_KEY is not configured')
  if (!baseId || !tableId) throw new Error('Airtable base ID and table ID are required')

  const allRecords = []
  let offset = null
  let pageCount = 0
  const maxPages = options.maxRecords ? Math.ceil(options.maxRecords / RECORDS_PER_PAGE) : 50 // Safety limit

  do {
    // Build URL with query params
    const params = new URLSearchParams()
    if (viewId) params.append('view', viewId)
    if (options.filterByFormula) params.append('filterByFormula', options.filterByFormula)
    if (options.fields) {
      options.fields.forEach(f => params.append('fields[]', f))
    }
    if (offset) params.append('offset', offset)
    params.append('pageSize', String(RECORDS_PER_PAGE))

    const url = `${AIRTABLE_API_URL}/${baseId}/${tableId}?${params.toString()}`

    console.log(`📊 Airtable: Fetching page ${pageCount + 1}...`)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`📊 Airtable: API error ${response.status}:`, errorBody)
      throw new Error(`Airtable API error ${response.status}: ${errorBody}`)
    }

    const data = await response.json()
    const records = data.records || []

    // Flatten records: extract fields and include record ID
    for (const record of records) {
      const fields = { ...record.fields }

      // Clean up Amount field - ensure it's a number, not a string like "-$249"
      if (fields.Amount !== undefined && typeof fields.Amount === 'string') {
        const cleaned = fields.Amount.replace(/[$,]/g, '')
        const parsed = parseFloat(cleaned)
        if (!isNaN(parsed)) fields.Amount = parsed
      }

      // Clean up ROI field if it's a string
      if (fields['money we made on them (ROI)'] !== undefined && typeof fields['money we made on them (ROI)'] === 'string') {
        const cleaned = fields['money we made on them (ROI)'].replace(/[$,]/g, '')
        const parsed = parseFloat(cleaned)
        if (!isNaN(parsed)) fields['money we made on them (ROI)'] = parsed
      }

      // Flatten nested objects (Created By, Last Modified By come as {id, email, name})
      if (fields['Created By'] && typeof fields['Created By'] === 'object') {
        fields['Created By'] = fields['Created By'].name || fields['Created By'].email || ''
      }
      if (fields['Last Modified By'] && typeof fields['Last Modified By'] === 'object') {
        fields['Last Modified By'] = fields['Last Modified By'].name || fields['Last Modified By'].email || ''
      }

      // Account is a linked record array - keep first ID or empty string
      if (Array.isArray(fields['Account'])) {
        fields['Account'] = fields['Account'][0] || ''
      }

      allRecords.push({
        _id: record.id,
        ...fields,
      })
    }

    offset = data.offset || null
    pageCount++

    console.log(`📊 Airtable: Page ${pageCount} returned ${records.length} records (total: ${allRecords.length})`)

    // Respect max records limit
    if (options.maxRecords && allRecords.length >= options.maxRecords) {
      allRecords.splice(options.maxRecords)
      break
    }
  } while (offset && pageCount < maxPages)

  // Extract unique field names from all records
  const fieldNames = [...new Set(allRecords.flatMap(r => Object.keys(r).filter(k => k !== '_id')))]

  console.log(`📊 Airtable: Fetched ${allRecords.length} total records with ${fieldNames.length} fields`)

  return { records: allRecords, fieldNames }
}

/**
 * Fetch records from Airtable and run an SQL query on them using alasql
 * This is the main entry point for the AI tool
 *
 * @param {object} options
 * @param {string} options.sql - SQL query to run (use ? as table reference or "records")
 * @param {string} [options.viewUrl] - Airtable view URL to fetch from
 * @param {string} [options.viewId] - Airtable view ID (alternative to viewUrl)
 * @param {string} [options.filterByFormula] - Airtable formula filter (applied before SQL)
 * @returns {Promise<{result: any, recordCount: number, fieldNames: string[], sql: string}>}
 */
export async function queryAirtableWithSQL(options = {}) {
  // Resolve view from URL if provided
  let viewId = options.viewId
  let baseId, tableId

  if (options.viewUrl) {
    const parsed = parseAirtableUrl(options.viewUrl)
    baseId = parsed.baseId
    tableId = parsed.tableId
    viewId = parsed.viewId || viewId
  }

  // Fetch all records
  const { records, fieldNames } = await fetchAllRecords({
    baseId,
    tableId,
    viewId,
    filterByFormula: options.filterByFormula,
  })

  if (!options.sql) {
    // No SQL provided - return raw data summary
    return {
      result: records.slice(0, 20), // Return first 20 for preview
      recordCount: records.length,
      fieldNames,
      sql: null,
      note: records.length > 20
        ? `Showing first 20 of ${records.length} records. Provide an SQL query to analyze all data.`
        : `Showing all ${records.length} records.`,
    }
  }

  // Run SQL query using alasql
  // alasql uses ? as a placeholder for data arrays
  let sql = options.sql.trim()

  // Allow users to reference "records" as the table name — replace with ?
  // Handle FROM records, FROM [records], FROM `records`
  sql = sql.replace(/\bFROM\s+(?:\[?records\]?|`records`)/gi, 'FROM ?')

  // If query doesn't have FROM ?, add it (for simple queries like SELECT COUNT(*))
  if (!sql.includes('?') && !sql.toLowerCase().includes('from')) {
    sql = sql + ' FROM ?'
  }

  console.log(`📊 Airtable SQL: Running query: ${sql}`)
  console.log(`📊 Airtable SQL: Against ${records.length} records`)

  try {
    const result = alasql(sql, [records])

    console.log(`📊 Airtable SQL: Query returned ${Array.isArray(result) ? result.length + ' rows' : 'a value'}`)

    return {
      result,
      recordCount: records.length,
      fieldNames,
      sql,
    }
  } catch (sqlError) {
    console.error(`📊 Airtable SQL: Query error:`, sqlError)
    return {
      error: `SQL query failed: ${sqlError.message}`,
      recordCount: records.length,
      fieldNames,
      sql,
      hint: `Available fields: ${fieldNames.join(', ')}. Use [Field Name] for fields with spaces. Example: SELECT [AI CATEGORY], SUM([Amount]) as total FROM ? GROUP BY [AI CATEGORY]`,
    }
  }
}

/**
 * Get a summary of what's available in the Airtable view
 * Useful for Claude to understand the data before querying
 *
 * @param {object} options
 * @param {string} [options.viewUrl] - Airtable view URL
 * @param {string} [options.viewId] - Airtable view ID
 * @returns {Promise<object>} Schema summary with fields, record count, and sample data
 */
export async function describeAirtableView(options = {}) {
  let viewId = options.viewId
  let baseId, tableId

  if (options.viewUrl) {
    const parsed = parseAirtableUrl(options.viewUrl)
    baseId = parsed.baseId
    tableId = parsed.tableId
    viewId = parsed.viewId || viewId
  }

  // Fetch a small sample to understand the schema
  const { records, fieldNames } = await fetchAllRecords({
    baseId,
    tableId,
    viewId,
    maxRecords: 10,
  })

  // Infer field types from sample data
  const fieldInfo = fieldNames.map(name => {
    const sampleValues = records
      .map(r => r[name])
      .filter(v => v !== undefined && v !== null)
      .slice(0, 3)

    const firstValue = sampleValues[0]
    let inferredType = 'unknown'
    if (typeof firstValue === 'number') inferredType = 'number'
    else if (typeof firstValue === 'string') inferredType = 'text'
    else if (typeof firstValue === 'boolean') inferredType = 'boolean'
    else if (Array.isArray(firstValue)) inferredType = 'array'
    else if (firstValue instanceof Object) inferredType = 'object'

    return {
      name,
      type: inferredType,
      sampleValues: sampleValues.slice(0, 3),
    }
  })

  // Get total record count (fetch all just for count)
  const { records: allRecords } = await fetchAllRecords({ baseId, tableId, viewId })

  return {
    recordCount: allRecords.length,
    fields: fieldInfo,
    sampleRecords: records.slice(0, 3),
    availableForSQL: true,
    hint: 'Use query_airtable with an SQL query to analyze this data. Field names with spaces need [brackets]. Example: SELECT [AI CATEGORY], SUM([Amount]) FROM ? GROUP BY [AI CATEGORY]',
  }
}
