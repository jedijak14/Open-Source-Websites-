/**
 * YouTube Data API v3 client for Node.js/server-side use.
 *
 * This module provides the same functionality as youtube-api.js but for use in
 * Node.js environments. It can be used to fetch YouTube data server-side,
 * which allows the API to work outside the browser.
 *
 * Usage:
 *   const { YouTubeAPI } = require('./youtube-api-node.js');
 *   const api = new YouTubeAPI('YOUR_API_KEY');
 *   const videos = await api.search('query');
 *
 * For OAuth-enabled endpoints (user data), you need to provide an access token:
 *   api.setAccessToken('OAUTH_ACCESS_TOKEN');
 *   const subs = await api.mySubscriptions();
 */

(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.OTYouTubeNode = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const BASE = 'https://www.googleapis.com/youtube/v3';

  class ApiError extends Error {
    constructor(message, info) {
      super(message);
      this.name = 'ApiError';
      this.status = (info && info.status) || 0;
      this.reason = (info && info.reason) || 'unknown';
      this.endpoint = (info && info.endpoint) || '';
    }
  }

  /**
   * YouTube Data API v3 client for Node.js
   */
  class YouTubeAPI {
    constructor(apiKey, options) {
      this.apiKey = apiKey || '';
      this.accessToken = '';
      this.cache = {};
      this.cacheTTL = (options && options.cacheTTL) || 10 * 60 * 1000; // 10 minutes
      this.maxCacheEntries = (options && options.maxCacheEntries) || 60;
    }

    setKey(key) {
      this.apiKey = key || '';
      this.clearCache();
    }

    getKey() {
      return this.apiKey;
    }

    setAccessToken(token) {
      this.accessToken = token || '';
      this.clearCache();
    }

    hasAccessToken() {
      return this.accessToken.length > 0;
    }

    clearCache() {
      this.cache = {};
    }

    cacheGet(url) {
      const hit = this.cache[url];
      if (hit && Date.now() - hit.t < this.cacheTTL) return hit.v;
      return null;
    }

    cacheSet(url, value) {
      this.cache[url] = { t: Date.now(), v: value };
      const urls = Object.keys(this.cache);
      if (urls.length > this.maxCacheEntries) {
        urls.sort((a, b) => this.cache[a].t - this.cache[b].t)
          .slice(0, urls.length - this.maxCacheEntries)
          .forEach((u) => delete this.cache[u]);
      }
    }

    /**
     * Make a request to the YouTube API
     */
    async request(endpoint, params) {
      const url = new URL(BASE + endpoint);
      
      // Add API key
      params.key = this.apiKey;
      
      // Add access token if available
      if (this.accessToken) {
        params.access_token = this.accessToken;
      }
      
      // Add params to URL
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, value);
        }
      });
      
      // Check cache
      const cached = this.cacheGet(url.toString());
      if (cached) return cached;
      
      // Make request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      try {
        // Use fetch if available (browser or Node.js 18+)
        if (typeof fetch === 'function') {
          const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const reason = this.mapErrorReason(errorData);
            throw new ApiError(
              errorData.error?.message || 'YouTube API request failed',
              { status: response.status, reason, endpoint: url.toString() }
            );
          }
          
          const data = await response.json();
          this.cacheSet(url.toString(), data);
          return data;
        } else {
          // Fallback for older Node.js - use https module
          throw new Error('fetch is not available. Use Node.js 18+ or provide a fetch polyfill.');
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    mapErrorReason(errorData) {
      const error = errorData.error || {};
      const reason = error.reason || error.code || '';
      
      const reasonMap = {
        quotaExceeded: 'The API quota for this key is used up.',
        dailyLimitExceeded: 'This key hit its daily quota.',
        keyInvalid: 'That API key was rejected.',
        keyExpired: 'That API key has expired.',
        accessNotConfigured: 'YouTube Data API v3 is not enabled for this key.',
        ipRefererBlocked: 'This key is restricted to other referrers.',
        forbidden: 'This key is not allowed to make that request.',
        badRequest: 'The request was rejected as invalid.',
        notFound: 'That video or channel is not available.',
        accessDenied: 'Access was denied. Check OAuth scopes.',
        unauthorized: 'The access token is invalid or expired.',
      };
      
      return reasonMap[reason] || reason || 'unknown';
    }

    /**
     * Paginated request helper
     */
    async paged(endpoint, params, maxPages) {
      const all = [];
      let pageToken = null;
      let pages = 0;
      const limit = maxPages || 4;

      do {
        const data = await this.request(endpoint, Object.assign({}, params, {
          pageToken,
          maxResults: 50,
        }));
        all.push(...(data.items || []));
        pageToken = data.nextPageToken;
        pages++;
      } while (pageToken && pages < limit);

      return all;
    }

    /* ------------------------------------------------------------ public endpoints */

    /**
     * Search for videos
     */
    async search(query, options) {
      const opts = options || {};
      const params = {
        q: query,
        type: opts.type || 'video',
        part: 'snippet',
        order: opts.order || 'relevance',
        safeSearch: 'moderate',
      };
      
      if (opts.channelId) params.channelId = opts.channelId;
      if (opts.maxResults) params.maxResults = opts.maxResults;
      if (opts.pageToken) params.pageToken = opts.pageToken;
      
      const data = await this.request('/search', params);
      return data.items || [];
    }

    /**
     * Get trending videos for a region
     */
    async trending(region, options) {
      const opts = options || {};
      const params = {
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        regionCode: region || 'US',
        maxResults: opts.maxResults || 50,
      };
      
      const data = await this.request('/videos', params);
      return data.items || [];
    }

    /**
     * Get video details
     */
    async videos(ids, options) {
      const opts = options || {};
      if (!Array.isArray(ids)) ids = [ids];
      
      const params = {
        part: opts.part || 'snippet,contentDetails,statistics,player',
        id: ids.join(','),
        maxResults: 50,
      };
      
      const data = await this.request('/videos', params);
      return data.items || [];
    }

    /**
     * Get channel details
     */
    async channels(ids, options) {
      const opts = options || {};
      if (!Array.isArray(ids)) ids = [ids];
      
      const params = {
        part: opts.part || 'snippet,contentDetails,statistics',
        id: ids.join(','),
        maxResults: 50,
      };
      
      const data = await this.request('/channels', params);
      return data.items || [];
    }

    /**
     * Get channel by username/handle
     */
    async channelByHandle(handle) {
      const params = {
        part: 'snippet,contentDetails,statistics',
        forHandle: handle,
        maxResults: 1,
      };
      
      const data = await this.request('/channels', params);
      return (data.items && data.items[0]) || null;
    }

    /* ------------------------------------------------------------ user endpoints (require OAuth) */

    /**
     * Get the authenticated user's channel
     */
    async myChannel() {
      if (!this.accessToken) {
        throw new ApiError('OAuth access token required for user endpoints.', {
          reason: 'missingAccessToken',
        });
      }
      
      const params = {
        part: 'snippet,contentDetails,statistics',
        mine: true,
        maxResults: 1,
      };
      
      const data = await this.request('/channels', params);
      return (data.items && data.items[0]) || null;
    }

    /**
     * Get the authenticated user's subscriptions
     */
    async mySubscriptions(options) {
      if (!this.accessToken) {
        throw new ApiError('OAuth access token required for user endpoints.', {
          reason: 'missingAccessToken',
        });
      }
      
      const opts = options || {};
      const params = {
        part: 'snippet,contentDetails',
        mine: true,
        maxResults: 50,
        order: opts.order || 'alphabetical',
      };
      
      return this.paged('/subscriptions', params, opts.maxPages || 4);
    }

    /**
     * Get the authenticated user's liked videos
     */
    async myLikedVideos(options) {
      if (!this.accessToken) {
        throw new ApiError('OAuth access token required for user endpoints.', {
          reason: 'missingAccessToken',
        });
      }
      
      const opts = options || {};
      const params = {
        part: 'snippet,contentDetails,statistics',
        myRating: 'like',
        maxResults: 50,
      };
      
      return this.paged('/videos', params, opts.maxPages || 2);
    }

    /**
     * Get the authenticated user's playlists
     */
    async myPlaylists(options) {
      if (!this.accessToken) {
        throw new ApiError('OAuth access token required for user endpoints.', {
          reason: 'missingAccessToken',
        });
      }
      
      const opts = options || {};
      const params = {
        part: 'snippet,contentDetails,status',
        mine: true,
        maxResults: 50,
      };
      
      return this.paged('/playlists', params, opts.maxPages || 4);
    }

    /**
     * Get videos from a playlist
     */
    async playlistItems(playlistId, options) {
      const opts = options || {};
      const params = {
        part: 'snippet,contentDetails,status',
        playlistId: playlistId,
        maxResults: 50,
      };
      
      return this.paged('/playlistItems', params, opts.maxPages || 4);
    }

    /**
     * Get the authenticated user's account data (channel + subscriptions + liked)
     */
    async myAccount() {
      if (!this.accessToken) {
        throw new ApiError('OAuth access token required.', {
          reason: 'missingAccessToken',
        });
      }
      
      const errors = {};
      const result = {
        channel: null,
        subscriptions: [],
        liked: [],
        playlists: [],
        errors,
      };
      
      try {
        result.channel = await this.myChannel();
      } catch (err) {
        errors.channel = err.message;
      }
      
      try {
        result.subscriptions = await this.mySubscriptions({ maxPages: 4 });
      } catch (err) {
        errors.subscriptions = err.message;
      }
      
      try {
        result.liked = await this.myLikedVideos({ maxPages: 2 });
      } catch (err) {
        errors.liked = err.message;
      }
      
      try {
        result.playlists = await this.myPlaylists({ maxPages: 2 });
      } catch (err) {
        errors.playlists = err.message;
      }
      
      return result;
    }

    /**
     * Test the API connection
     */
    async testConnection() {
      const params = {
        part: 'snippet',
        q: 'test',
        maxResults: 1,
        type: 'video',
      };
      
      const data = await this.request('/search', params);
      const first = (data.items && data.items[0]) || {};
      return {
        ok: true,
        sample: first.snippet && first.snippet.title,
      };
    }
  }

  return {
    YouTubeAPI,
    ApiError,
  };
});
