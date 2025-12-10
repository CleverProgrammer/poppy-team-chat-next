/**
 * Notion Token Management Utilities
 * 
 * Token management with automatic refresh using OAuth credentials.
 * Works in serverless environments by caching refreshed tokens in memory.
 */

let cachedToken = null;
let tokenExpiresAt = 0;
let refreshTokenValue = null; // Cache the latest refresh token

/**
 * Check if token is expired or expiring soon
 */
function isTokenExpired() {
  // If we have a cached expiration, use that (more accurate for refreshed tokens)
  if (tokenExpiresAt > 0) {
    const bufferMs = 2 * 60 * 1000; // 2 minute buffer
    return Date.now() >= tokenExpiresAt - bufferMs;
  }
  
  // Fall back to env var if no cache
  const expiresAt = parseInt(process.env.NOTION_TOKEN_EXPIRES_AT || '0');
  const bufferMs = 2 * 60 * 1000; // 2 minute buffer
  return Date.now() >= expiresAt - bufferMs;
}

/**
 * Refresh Notion access token
 */
async function refreshNotionToken() {
  // Use cached refresh token if available (from previous refresh), otherwise use env
  const refreshToken = refreshTokenValue || process.env.NOTION_REFRESH_TOKEN;
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    console.error('❌ Missing refresh credentials in .env');
    return null;
  }

  console.log('🔄 Refreshing Notion token...');

  try {
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch('https://mcp.notion.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenRequestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token refresh failed:', response.status, errorText);
      return null;
    }

    const tokenData = await response.json();
    
    // Cache the new tokens (refresh token rotates on each refresh)
    cachedToken = tokenData.access_token;
    refreshTokenValue = tokenData.refresh_token; // Store new refresh token
    tokenExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

    console.log('✅ Token refreshed successfully, expires at:', new Date(tokenExpiresAt).toISOString());
    
    return cachedToken;
  } catch (error) {
    console.error('❌ Error refreshing token:', error);
    return null;
  }
}

/**
 * Get valid Notion access token, refreshing if needed
 * @returns {Promise<string|null>} Access token or null if not configured
 */
export async function getValidNotionToken() {
  // If we have a cached valid token, return it
  if (cachedToken && tokenExpiresAt > 0 && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  // Check if env token is valid
  const envToken = process.env.NOTION_ACCESS_TOKEN;
  if (!envToken) {
    console.log('ℹ️ No Notion access token configured in .env');
    return null;
  }

  // Initialize cache from env on first run
  if (!cachedToken) {
    cachedToken = envToken;
    tokenExpiresAt = parseInt(process.env.NOTION_TOKEN_EXPIRES_AT || '0');
  }

  // Check if token is expired or expiring soon
  if (isTokenExpired()) {
    console.log('🔄 Token expired or expiring soon, attempting refresh...');
    const refreshedToken = await refreshNotionToken();
    
    if (refreshedToken) {
      return refreshedToken;
    }
    
    // If refresh failed, try using env token anyway (might still work)
    console.log('⚠️ Using env token as fallback');
    return envToken;
  }

  return cachedToken;
}

/**
 * Clear invalid token
 */
export function clearInvalidNotionToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
  console.log('⚠️ Token cleared - will attempt refresh on next request');
}
