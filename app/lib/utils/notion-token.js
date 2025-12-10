/**
 * Notion Token Management Utilities
 * 
 * Token management with automatic refresh using OAuth credentials.
 */

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Check if token is expired or expiring soon
 */
function isTokenExpired() {
  const expiresAt = parseInt(process.env.NOTION_TOKEN_EXPIRES_AT || '0');
  const bufferMs = 2 * 60 * 1000; // 2 minute buffer
  return Date.now() >= expiresAt - bufferMs;
}

/**
 * Refresh Notion access token
 */
async function refreshNotionToken() {
  const refreshToken = process.env.NOTION_REFRESH_TOKEN;
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
      console.error('❌ Token refresh failed:', response.status, await response.text());
      return null;
    }

    const tokenData = await response.json();
    
    // Cache the new token
    cachedToken = tokenData.access_token;
    tokenExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

    console.log('✅ Token refreshed successfully, expires at:', new Date(tokenExpiresAt).toISOString());
    console.log('💡 Update .env with: NOTION_ACCESS_TOKEN=' + cachedToken);
    
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
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  // Check if env token is valid
  const envToken = process.env.NOTION_ACCESS_TOKEN;
  if (!envToken) {
    console.log('ℹ️ No Notion access token configured in .env');
    return null;
  }

  // Check if env token is expired
  if (isTokenExpired()) {
    console.log('🔄 Token expired, attempting refresh...');
    const refreshedToken = await refreshNotionToken();
    return refreshedToken || envToken; // Fallback to env token if refresh fails
  }

  // Cache and return env token
  cachedToken = envToken;
  tokenExpiresAt = parseInt(process.env.NOTION_TOKEN_EXPIRES_AT || '0');
  return envToken;
}

/**
 * Clear invalid token
 */
export function clearInvalidNotionToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
  console.log('⚠️ Token cleared - will attempt refresh on next request');
}
