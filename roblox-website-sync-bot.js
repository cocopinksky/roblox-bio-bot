/**
 * cocogrindclub.com -> Roblox Group Description ("bio"/About section) sync bot
 *
 * Polls the site's live server-status data on a timer and rewrites your
 * Roblox group's Description with the currently online servers + join links,
 * sorted from least players to most/full.
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
  'grind_goal,join_url,updated_at,notes,max_players,current_players' +
  '&order=server_number.asc';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Static text that always appears above the live server list.
const STATIC_HEADER =
  `Welcome to Coco's GRIND CLUB! Happy grinding! 💖☁️\n\n`;

// Static text that always appears after the live server list.
const STATIC_FOOTER =
  `\n\nThis is Cocopinksky's Official Group & Adopt Me Grind Servers!`;

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
      ...(this.csrfToken ? { 'x-csrf-token':
