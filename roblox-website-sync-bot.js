/**
 * cocogrindclub.com -> Roblox Group Description ("bio"/About section) sync bot
 *
 * Polls the site's live server-status data on a timer and rewrites your
 * Roblox group's Description with the currently online servers + join links.
 *
 * SETUP:
 *   1. npm init -y
 *   2. npm install node-fetch@2 dotenv
 *   3. Set environment variables in a .env file (see bottom of this file)
 *   4. node roblox-website-sync-bot.js
 */

require('dotenv').config();
const fetch = require('node-fetch');

// ---- CONFIG ----
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;       // .ROBLOSECURITY value of the bot account
const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;   // numeric group id
const DESCRIPTION_CHAR_LIMIT = 1000;

const SUPABASE_URL =
  'https://fnromsiufecdxgaukuzh.supabase.co/rest/v1/roblox_servers' +
  '?select=id,server_number,host_name,host_name_2,status,secondary_status,' +
  'grind_goal,join_url,updated_at,notes,max_players' +
  '&order=server_number.asc';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Static text that always appears above the live server list.
// Edit this to whatever intro/rules copy your group description should keep.
const STATIC_HEADER =
  `Welcome to the community! Check below for currently active grind servers.\n\n`;

// ---- ROBLOX API HELPER ----
class RobloxClient {
  constructor(cookie) {
    this.cookie = cookie;
    this.csrfToken = null;
  }

  async request(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      Cookie: `.ROBLOSECURITY=${this.cookie}`,
      ...(this.csrfToken ? { 'x-csrf-token': this.csrfToken } : {}),
      ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });

    // Roblox replies 403 the first time and hands back the CSRF token to use.
    if (res.status === 403 && res.headers.get('x-csrf-token')) {
      this.csrfToken = res.headers.get('x-csrf-token');
      return this.request(url, options); // retry once with the token
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Roblox API error ${res.status}: ${body}`);
    }

    return res.status === 204 ? null : res.json().catch(() => null);
  }

  async updateDescription(groupId, description) {
    return this.request(`https://groups.roblox.com/v1/groups/${groupId}/description`, {
      method: 'PATCH',
      body: JSON.stringify({ description }),
    });
  }
}

const roblox = new RobloxClient(ROBLOX_COOKIE);

// ---- FETCH SERVER DATA FROM THE WEBSITE ----
async function fetchServers() {
  const res = await fetch(SUPABASE_URL, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to fetch server data: ${res.status} ${body}`);
  }

  return res.json();
}

// ---- BUILD THE DESCRIPTION TEXT ----
function isOnline(server) {
  // Adjust this if the site's actual "online" value looks different -
  // e.g. it might be "Online", "active", true, etc. Log a sample row
  // (see the console.log below on first run) to check the real value.
  return typeof server.status === 'string' && server.status.toLowerCase() === 'online';
}

function buildDescriptionText(servers) {
  const onlineServers = servers.filter(isOnline);
  let body = STATIC_HEADER;

  if (onlineServers.length === 0) {
    body += 'No grind servers online right now — check back soon!';
  } else {
    body += onlineServers
      .map((s) => {
        const label = s.host_name || `Server #${s.server_number}`;
        return `• ${label}: ${s.join_url}`;
      })
      .join('\n');
  }

  if (body.length > DESCRIPTION_CHAR_LIMIT) {
    body = body.slice(0, DESCRIPTION_CHAR_LIMIT - 1) + '…';
  }
  return body;
}

// ---- MAIN ----
async function syncOnce() {
  try {
    const servers = await fetchServers();

    console.log('Sample server row (check the "status" field value here):');
    if (servers.length > 0) console.log(JSON.stringify(servers[0], null, 2));

    const descriptionText = buildDescriptionText(servers);
    await roblox.updateDescription(ROBLOX_GROUP_ID, descriptionText);

    console.log(`[${new Date().toLocaleTimeString()}] Description updated:\n${descriptionText}\n`);
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Sync failed:`, err.message);
    process.exit(1); // non-zero exit so GitHub Actions marks the run as failed
  }
}

syncOnce();

/*
--- .env example ---
ROBLOX_COOKIE=your-bot-accounts-.ROBLOSECURITY-value
ROBLOX_GROUP_ID=987654321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
*/
