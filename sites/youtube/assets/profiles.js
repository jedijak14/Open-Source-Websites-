/**
 * OpenTube — Multi-profile management system (Netflix-style)
 *
 * Each Google account can have multiple profiles.
 * Each profile has its own:
 *   - Display name
 *   - Avatar (color or image)
 *   - YouTube API key (optional, for live data)
 *   - Google OAuth client ID (optional, for sign-in)
 *   - Watch history
 *   - Recommendations
 *   - Preferences
 *
 * Profiles are stored in localStorage and tied to the Google account.
 *
 * Exposes window.OTProfiles.
 */
(function (global) {
  'use strict';

  const PROFILES_KEY = 'opentube:profiles:v1';
  const ACTIVE_PROFILE_KEY = 'opentube:active-profile';
  const ANON_PROFILE = 'anon';

  /* ------------------------------------------------------------ storage */

  function ls() {
    try {
      const store = global.localStorage;
      store.setItem('__probe__', '1');
      store.removeItem('__probe__');
      return store;
    } catch (err) {
      return null;
    }
  }

  function getAuth() {
    return global.OTAuth || null;
  }

  function getYouTubeAPI() {
    return global.OTYouTube || null;
  }

  function getAccountId() {
    const auth = getAuth();
    if (!auth || !auth.state || !auth.state.profile) return null;
    const channel = auth.state.profile.channel;
    return channel ? channel.channelId || channel.id : null;
  }

  /* ------------------------------------------------------------ profile data */

  function blankProfile(id) {
    return {
      id: id || 'profile-' + Date.now(),
      name: 'Profile ' + (Math.floor(Math.random() * 1000) + 1),
      avatar: null,
      color: getRandomColor(),
      createdAt: Date.now(),
      lastUsed: Date.now(),
      isKids: false,
      // API configuration for this profile
      apiKey: null,  // YouTube Data API key
      clientId: null, // Google OAuth client ID
      // Profile-specific data keys
      recKey: 'opentube:rec:' + id,
      historyKey: 'opentube:history:' + id,
      watchLaterKey: 'opentube:later:' + id,
      likesKey: 'opentube:likes:' + id,
      subsKey: 'opentube:subs:' + id,
    };
  }

  function getRandomColor() {
    const colors = [
      '#FF5470', '#FF7538', '#FFC107', '#FFEB3B',
      '#8BC34A', '#4CAF50', '#00BCD4', '#2196F3',
      '#673AB7', '#E91E63', '#9C27B0', '#3F51B5',
      '#009688', '#607D8B', '#795548', '#FF5722'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase().slice(0, 2);
  }

  /* ------------------------------------------------------------ profile management */

  function getAllProfiles() {
    const store = ls();
    if (!store) return {};
    try {
      return JSON.parse(store.getItem(PROFILES_KEY) || '{}');
    } catch (err) {
      return {};
    }
  }

  function saveProfiles(profiles) {
    const store = ls();
    if (!store) return false;
    try {
      store.setItem(PROFILES_KEY, JSON.stringify(profiles));
      return true;
    } catch (err) {
      return false;
    }
  }

  function getActiveProfileId() {
    const store = ls();
    if (!store) return ANON_PROFILE;
    try {
      return store.getItem(ACTIVE_PROFILE_KEY) || ANON_PROFILE;
    } catch (err) {
      return ANON_PROFILE;
    }
  }

  function setActiveProfileId(id) {
    const store = ls();
    if (!store) return false;
    try {
      store.setItem(ACTIVE_PROFILE_KEY, id);
      return true;
    } catch (err) {
      return false;
    }
  }

  function getActiveProfile() {
    const accountId = getAccountId();
    if (!accountId) {
      // If not signed in, check for anonymous profile
      const profiles = getAllProfiles();
      const activeId = getActiveProfileId();
      if (activeId !== ANON_PROFILE && profiles[activeId]) {
        return profiles[activeId];
      }
      return null;
    }
    
    const profiles = getAllProfiles()[accountId] || {};
    const activeId = getActiveProfileId();
    
    if (!profiles[activeId]) {
      const profileIds = Object.keys(profiles);
      if (profileIds.length > 0) {
        return profiles[profileIds[0]];
      }
      const newProfile = blankProfile('main');
      newProfile.name = 'Main Profile';
      profiles[newProfile.id] = newProfile;
      saveProfiles({ ...getAllProfiles(), [accountId]: profiles });
      setActiveProfileId(newProfile.id);
      return newProfile;
    }
    
    return profiles[activeId];
  }

  function getAccountProfiles() {
    const accountId = getAccountId();
    if (!accountId) return [];
    
    const allProfiles = getAllProfiles();
    const accountProfiles = allProfiles[accountId] || {};
    
    return Object.values(accountProfiles)
      .sort((a, b) => b.lastUsed - a.lastUsed || b.createdAt - a.createdAt);
  }

  /**
   * Get the current profile's API key, falling back to global settings.
   */
  function getCurrentApiKey() {
    const profile = getActiveProfile();
    if (profile && profile.apiKey) {
      return profile.apiKey;
    }
    
    const api = getYouTubeAPI();
    if (api && api.getKey) {
      return api.getKey();
    }
    
    return null;
  }

  /**
   * Set the API key for the current profile.
   */
  function setCurrentApiKey(key) {
    const profile = getActiveProfile();
    if (!profile) return false;
    
    const accountId = getAccountId();
    if (!accountId) return false;
    
    const profiles = getAllProfiles();
    if (!profiles[accountId] || !profiles[accountId][profile.id]) {
      return false;
    }
    
    profiles[accountId][profile.id].apiKey = key || null;
    saveProfiles(profiles);
    
    // Update the global YouTube API
    const youtubeApi = getYouTubeAPI();
    if (youtubeApi && youtubeApi.setKey) {
      youtubeApi.setKey(key || '');
    }
    
    return true;
  }

  /**
   * Get the current profile's OAuth client ID.
   */
  function getCurrentClientId() {
    const profile = getActiveProfile();
    if (profile && profile.clientId) {
      return profile.clientId;
    }
    
    const auth = getAuth();
    if (auth && auth.getClientId) {
      return auth.getClientId();
    }
    
    return null;
  }

  /**
   * Set the OAuth client ID for the current profile.
   */
  function setCurrentClientId(clientId) {
    const profile = getActiveProfile();
    if (!profile) return false;
    
    const accountId = getAccountId();
    if (!accountId) return false;
    
    const profiles = getAllProfiles();
    if (!profiles[accountId] || !profiles[accountId][profile.id]) {
      return false;
    }
    
    profiles[accountId][profile.id].clientId = clientId || null;
    saveProfiles(profiles);
    
    // Update the global auth
    const auth = getAuth();
    if (auth && auth.setClientId) {
      auth.setClientId(clientId || '');
    }
    
    return true;
  }

  function createProfile(options) {
    const accountId = getAccountId();
    if (!accountId) {
      throw new Error('No account signed in');
    }
    
    const profiles = getAllProfiles();
    if (!profiles[accountId]) {
      profiles[accountId] = {};
    }
    
    const newProfile = blankProfile();
    if (options) {
      if (options.name) newProfile.name = options.name;
      if (options.avatar) newProfile.avatar = options.avatar;
      if (options.color) newProfile.color = options.color;
      if (options.isKids !== undefined) newProfile.isKids = options.isKids;
      if (options.apiKey) newProfile.apiKey = options.apiKey;
      if (options.clientId) newProfile.clientId = options.clientId;
    }
    
    profiles[accountId][newProfile.id] = newProfile;
    saveProfiles(profiles);
    
    return newProfile;
  }

  function switchProfile(profileId) {
    const accountId = getAccountId();
    if (!accountId) {
      // Try to find profile across all accounts
      const allProfiles = getAllProfiles();
      let foundAccount = null;
      for (const accId in allProfiles) {
        if (allProfiles[accId][profileId]) {
          foundAccount = accId;
          break;
        }
      }
      if (!foundAccount) return false;
      accountId = foundAccount;
    }
    
    const profiles = getAllProfiles();
    if (!profiles[accountId] || !profiles[accountId][profileId]) {
      return false;
    }
    
    profiles[accountId][profileId].lastUsed = Date.now();
    saveProfiles(profiles);
    
    setActiveProfileId(profileId);
    
    // Switch recommender to this profile
    const rec = global.OTRec;
    if (rec) {
      rec.useAccount(profileId, { seedFromAnonymous: false });
    }
    
    // Update API key and client ID if profile has them
    const profile = profiles[accountId][profileId];
    if (profile.apiKey) {
      const youtubeApi = getYouTubeAPI();
      if (youtubeApi && youtubeApi.setKey) {
        youtubeApi.setKey(profile.apiKey);
      }
    }
    if (profile.clientId) {
      const auth = getAuth();
      if (auth && auth.setClientId) {
        auth.setClientId(profile.clientId);
      }
    }
    
    // Dispatch profile change event
    const event = new CustomEvent('profileChanged', { detail: { profileId } });
    document.dispatchEvent(event);
    
    return true;
  }

  function deleteProfile(profileId) {
    const accountId = getAccountId();
    if (!accountId) return false;
    
    const profiles = getAllProfiles();
    if (!profiles[accountId] || !profiles[accountId][profileId]) {
      return false;
    }
    
    const profileCount = Object.keys(profiles[accountId]).length;
    if (profileCount <= 1) {
      return false;
    }
    
    delete profiles[accountId][profileId];
    saveProfiles(profiles);
    
    const activeId = getActiveProfileId();
    if (activeId === profileId) {
      const remaining = Object.keys(profiles[accountId]);
      setActiveProfileId(remaining[0]);
      
      const rec = global.OTRec;
      if (rec) {
        rec.useAccount(remaining[0], { seedFromAnonymous: false });
      }
    }
    
    cleanupProfileStorage(profileId);
    
    return true;
  }

  function updateProfile(profileId, updates) {
    const accountId = getAccountId();
    if (!accountId) return false;
    
    const profiles = getAllProfiles();
    if (!profiles[accountId] || !profiles[accountId][profileId]) {
      return false;
    }
    
    const profile = profiles[accountId][profileId];
    if (updates.name !== undefined) profile.name = updates.name;
    if (updates.avatar !== undefined) profile.avatar = updates.avatar;
    if (updates.color !== undefined) profile.color = updates.color;
    if (updates.isKids !== undefined) profile.isKids = updates.isKids;
    if (updates.apiKey !== undefined) profile.apiKey = updates.apiKey;
    if (updates.clientId !== undefined) profile.clientId = updates.clientId;
    
    saveProfiles(profiles);
    return true;
  }

  /* ------------------------------------------------------------ storage management */

  function updateStorageKeys(profileId) {
    // The recommender already uses profile-specific keys
  }

  function getProfileById(profileId) {
    const allProfiles = getAllProfiles();
    for (const accountId in allProfiles) {
      const profiles = allProfiles[accountId];
      if (profiles[profileId]) {
        return profiles[profileId];
      }
    }
    return null;
  }

  function cleanupProfileStorage(profileId) {
    const store = ls();
    if (!store) return;
    
    const profile = getProfileById(profileId);
    if (!profile) return;
    
    try {
      store.removeItem(profile.recKey);
      store.removeItem(profile.historyKey);
      store.removeItem(profile.watchLaterKey);
      store.removeItem(profile.likesKey);
      store.removeItem(profile.subsKey);
    } catch (err) {
      // Ignore storage errors
    }
  }

  function migrateLegacyData() {
    const accountId = getAccountId();
    if (!accountId) return;
    
    const store = ls();
    if (!store) return;
    
    const profiles = getAllProfiles();
    if (!profiles[accountId]) {
      profiles[accountId] = {};
    }
    
    if (Object.keys(profiles[accountId]).length > 0) {
      return;
    }
    
    const mainProfile = blankProfile('main');
    mainProfile.name = 'Main Profile';
    
    // Try to get existing API key and client ID
    const youtubeApi = getYouTubeAPI();
    const auth = getAuth();
    
    if (youtubeApi && youtubeApi.getKey) {
      const key = youtubeApi.getKey();
      if (key) mainProfile.apiKey = key;
    }
    
    if (auth && auth.getClientId) {
      const clientId = auth.getClientId();
      if (clientId) mainProfile.clientId = clientId;
    }
    
    profiles[accountId][mainProfile.id] = mainProfile;
    saveProfiles(profiles);
    setActiveProfileId(mainProfile.id);
  }

  /* ------------------------------------------------------------ UI helpers */

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function renderProfilePicker() {
    const accountId = getAccountId();
    if (!accountId) {
      return renderSignInPrompt();
    }
    
    const profiles = getAccountProfiles();
    const activeId = getActiveProfileId();
    
    let html = '<div class="modal-backdrop" id="profile-modal-backdrop" style="z-index: 1000;">';
    html += '<div class="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">';
    html += '<div class="profile-modal__head">';
    html += '<div class="profile-modal__logo">';
    html += '<svg class="masthead__logo" viewBox="0 0 40 40" aria-hidden="true">';
    html += '<defs><linearGradient id="mark-g" x1="0" y1="0" x2="1" y2="1">';
    html += '<stop offset="0" stop-color="#ff5470"/><stop offset="1" stop-color="#d81b60"/>';
    html += '</linearGradient></defs>';
    html += '<rect x="2" y="4" width="36" height="32" rx="11" fill="url(#mark-g)"/>';
    html += '<path d="M16.5 13.6c0-1 1.1-1.6 2-1.1l11 6.4c.9.5.9 1.8 0 2.3l-11 6.4c-.9.5-2-.1-2-1.1V13.6Z" fill="#fff"/>';
    html += '<circle cx="11" cy="30" r="2.2" fill="#fff" fill-opacity=".9"/>';
    html += '</svg>';
    html += '</div>';
    html += '<h2 id="profile-modal-title">Who' + "'" + 's watching?</h2>';
    html += '</div>';
    html += '<div class="profile-modal__grid" id="profile-grid">';
    
    profiles.forEach((profile) => {
      const isActive = profile.id === activeId;
      const displayName = esc(profile.name);
      const initials = getInitials(profile.name);
      
      if (profile.avatar) {
        html += '<button class="profile-card' + (isActive ? ' profile-card--active' : '') + '" type="button" data-profile-id="' + esc(profile.id) + '" aria-label="' + displayName + (isActive ? ' (current)' : '') + '">';
        html += '<span class="profile-card__avatar" style="background-image: url(' + esc(profile.avatar) + ');"></span>';
        html += '<span class="profile-card__name">' + displayName + '</span></button>';
      } else {
        html += '<button class="profile-card' + (isActive ? ' profile-card--active' : '') + '" type="button" data-profile-id="' + esc(profile.id) + '" aria-label="' + displayName + (isActive ? ' (current)' : '') + '">';
        html += '<span class="profile-card__avatar" style="background-color: ' + esc(profile.color) + ';">' + initials + '</span>';
        html += '<span class="profile-card__name">' + displayName + '</span></button>';
      }
    });
    
    html += '<button class="profile-card profile-card--add" type="button" id="add-profile-btn" aria-label="Add profile">';
    html += '<span class="profile-card__avatar">+</span><span class="profile-card__name">Add profile</span></button>';
    html += '</div>';
    html += '<div class="profile-modal__footer">';
    html += '<button class="btn-pill" type="button" id="manage-profiles-btn">Manage profiles</button>';
    html += '<button class="btn-pill" type="button" id="profile-settings-btn">' + icon('settings', 'icon--sm') + ' Settings</button>';
    html += '</div></div></div>';
    
    return html;
  }

  function renderSignInPrompt() {
    let html = '<div class="modal-backdrop" id="profile-modal-backdrop" style="z-index: 1000;">';
    html += '<div class="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">';
    html += '<div class="profile-modal__head">';
    html += '<div class="profile-modal__logo">';
    html += '<svg class="masthead__logo" viewBox="0 0 40 40" aria-hidden="true">';
    html += '<defs><linearGradient id="mark-g" x1="0" y1="0" x2="1" y2="1">';
    html += '<stop offset="0" stop-color="#ff5470"/><stop offset="1" stop-color="#d81b60"/>';
    html += '</linearGradient></defs>';
    html += '<rect x="2" y="4" width="36" height="32" rx="11" fill="url(#mark-g)"/>';
    html += '<path d="M16.5 13.6c0-1 1.1-1.6 2-1.1l11 6.4c.9.5.9 1.8 0 2.3l-11 6.4c-.9.5-2-.1-2-1.1V13.6Z" fill="#fff"/>';
    html += '<circle cx="11" cy="30" r="2.2" fill="#fff" fill-opacity=".9"/>';
    html += '</svg>';
    html += '</div>';
    html += '<h2 id="profile-modal-title">Who' + "'" + 's watching?</h2>';
    html += '</div>';
    html += '<div class="profile-modal__grid" id="profile-grid">';
    html += '<div class="empty-state" style="text-align: center; grid-column: 1 / -1;">';
    html += '<p style="color: var(--text-secondary);">Sign in to create profiles</p></div></div>';
    html += '<div class="profile-modal__footer">';
    html += '<button class="btn-pill btn-pill--solid" type="button" id="profile-signin-btn">Sign in with Google</button>';
    html += '</div></div></div>';
    
    return html;
  }

  function renderManageProfiles() {
    const accountId = getAccountId();
    if (!accountId) return '';
    
    const profiles = getAccountProfiles();
    const activeId = getActiveProfileId();
    
    let html = '<div class="modal-backdrop" id="manage-modal-backdrop" style="z-index: 1001;">';
    html += '<div class="modal manage-modal" role="dialog" aria-modal="true" aria-labelledby="manage-modal-title">';
    html += '<div class="modal__head"><h2 id="manage-modal-title">Manage profiles</h2>';
    html += '<button class="icon-btn" id="manage-close" type="button" aria-label="Close">';
    html += '<svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg></button></div>';
    html += '<div class="modal__body"><p style="color: var(--text-secondary); margin-bottom: 16px;">Select a profile to edit or delete.</p>';
    html += '<div class="manage-profiles-list" id="manage-profiles-list">';
    
    profiles.forEach((profile) => {
      const isActive = profile.id === activeId;
      const displayName = esc(profile.name);
      const initials = getInitials(profile.name);
      
      html += '<div class="manage-profile-item" data-profile-id="' + esc(profile.id) + '">';
      html += '<div class="manage-profile-item__avatar">';
      
      if (profile.avatar) {
        html += '<img src="' + esc(profile.avatar) + '" alt="">';
      } else {
        html += '<span style="background-color: ' + esc(profile.color) + ';">' + initials + '</span>';
      }
      
      html += '</div><div class="manage-profile-item__info">';
      html += '<span class="manage-profile-item__name">' + displayName + '</span>';
      html += '<span class="manage-profile-item__status">' + (isActive ? 'Current profile' : '') + '</span>';
      
      // Show if profile has API key
      if (profile.apiKey) {
        html += '<span class="manage-profile-item__status">API key configured</span>';
      }
      
      html += '</div><div class="manage-profile-item__actions">';
      html += '<button class="btn-pill btn-pill--ghost" type="button" data-action="edit">Edit</button>';
      html += '<button class="btn-pill btn-pill--ghost" type="button" data-action="delete" ' + (profiles.length <= 1 ? 'disabled' : '') + '>Delete</button>';
      html += '</div></div>';
    });
    
    html += '</div></div><div class="modal__actions">';
    html += '<button class="btn-pill" type="button" id="manage-done">Done</button>';
    html += '</div></div></div>';
    
    return html;
  }

  function init() {
    const auth = getAuth();
    if (auth && auth.isSignedIn()) {
      migrateLegacyData();
    }
    
    if (auth && auth.onChange) {
      auth.onChange(() => {
        const accountId = getAccountId();
        if (accountId) {
          migrateLegacyData();
        }
        // When auth state changes, check if we should show profile picker
        checkShowProfilePicker();
      });
    }
    
    injectProfileModals();
    updateHeaderAvatar();
    setupEventListeners();
    
    // Show profile picker on first load if needed
    checkShowProfilePicker();
  }

  /**
   * Check if we should show the profile picker modal on page load.
   * Shows if: not signed in, or signed in but no active profile selected.
   */
  function checkShowProfilePicker() {
    const accountId = getAccountId();
    const activeProfile = getActiveProfile();
    
    // If we have an active profile, don't show picker
    if (activeProfile) return;
    
    // If signed in but no profile yet, create one and don't show picker
    if (accountId) {
      // This will create a main profile if none exists
      const profile = getActiveProfile();
      if (profile) return;
    }
    
    // Show profile picker for new visitors or when no profile is active
    setTimeout(() => {
      openProfilePicker();
    }, 100);
  }

  function injectProfileModals() {
    const existing = document.getElementById('profile-modal-backdrop');
    if (existing) return;
    
    const container = document.createElement('div');
    container.id = 'profile-modals-container';
    document.body.appendChild(container);
    
    container.innerHTML = renderProfilePicker();
  }

  function updateHeaderAvatar() {
    const avatarBtn = document.getElementById('avatar-btn');
    if (!avatarBtn) return;
    
    const accountId = getAccountId();
    const activeProfile = getActiveProfile();
    
    if (accountId && activeProfile) {
      const displayName = activeProfile.name;
      const initials = getInitials(displayName);
      
      if (activeProfile.avatar) {
        avatarBtn.innerHTML = '<img src="' + esc(activeProfile.avatar) + '" alt="" width="32" height="32" data-avatar data-name="' + esc(displayName) + '">';
      } else {
        avatarBtn.innerHTML = '<span class="avatar-fallback" style="background-color: ' + esc(activeProfile.color) + ';" data-avatar data-name="' + esc(displayName) + '">' + initials + '</span>';
      }
      avatarBtn.title = displayName;
      avatarBtn.setAttribute('aria-label', 'Switch profiles — ' + displayName);
      
      const img = avatarBtn.querySelector('img');
      if (img) {
        img.addEventListener('error', () => {
          img.replaceWith('<span class="avatar-fallback" style="background-color: ' + esc(activeProfile.color) + ';">' + initials + '</span>');
        }, { once: true });
      }
      return;
    }
    
    if (!accountId) {
      avatarBtn.textContent = 'Y';
      avatarBtn.title = '';
      avatarBtn.setAttribute('aria-label', 'Account');
    }
  }

  function updateAccountMenu(displayName) {
    const accountMenu = document.getElementById('account-menu');
    if (!accountMenu) return;
    
    const menuHead = accountMenu.querySelector('.menu__head');
    if (menuHead) {
      const nameEl = menuHead.querySelector('b');
      if (nameEl) {
        nameEl.textContent = displayName;
      }
      const spanEl = menuHead.querySelector('span');
      if (spanEl) {
        spanEl.textContent = '@' + displayName.toLowerCase().replace(/\s+/g, '') + ' · local profile';
      }
    }
  }

  function setupEventListeners() {
    document.addEventListener('click', (e) => {
      const profileCard = e.target.closest('.profile-card:not(.profile-card--add)');
      if (profileCard) {
        const profileId = profileCard.dataset.profileId;
        if (profileId) {
          switchProfile(profileId);
          closeProfilePicker();
          updateHeaderAvatar();
          
          const auth = getAuth();
          if (auth && auth.state && auth.state.profile) {
            auth.refreshProfile().catch(() => {});
          }
          return;
        }
      }
      
      if (e.target.closest('#add-profile-btn')) {
        createNewProfile();
        return;
      }
      
      if (e.target.closest('#manage-profiles-btn')) {
        closeProfilePicker();
        openManageProfiles();
        return;
      }
      
      if (e.target.closest('#profile-settings-btn')) {
        closeProfilePicker();
        window.location.href = 'settings.html';
        return;
      }
      
      if (e.target.closest('#profile-signin-btn')) {
        closeProfilePicker();
        const auth = getAuth();
        if (auth) {
          auth.signIn().catch(() => {});
        }
        return;
      }
      
      if (e.target.id === 'profile-modal-backdrop') {
        closeProfilePicker();
        return;
      }
    });
    
    document.addEventListener('click', (e) => {
      const manageClose = e.target.closest('#manage-close');
      if (manageClose) {
        closeManageProfiles();
        return;
      }
      
      const manageDone = e.target.closest('#manage-done');
      if (manageDone) {
        closeManageProfiles();
        return;
      }
      
      const manageBackdrop = e.target.closest('#manage-modal-backdrop');
      if (manageBackdrop && e.target === manageBackdrop) {
        closeManageProfiles();
        return;
      }
      
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const profileItem = actionBtn.closest('.manage-profile-item');
        if (profileItem) {
          const profileId = profileItem.dataset.profileId;
          const action = actionBtn.dataset.action;
          
          if (action === 'edit') {
            editProfile(profileId);
          } else if (action === 'delete') {
            deleteProfileConfirm(profileId);
          }
        }
        return;
      }
    });
  }

  function openProfilePicker() {
    const container = document.getElementById('profile-modals-container');
    if (!container) return;
    
    container.innerHTML = renderProfilePicker();
    container.style.display = 'block';
    
    const firstCard = container.querySelector('.profile-card');
    if (firstCard) {
      setTimeout(() => firstCard.focus(), 50);
    }
  }

  function closeProfilePicker() {
    const container = document.getElementById('profile-modals-container');
    if (container) {
      container.style.display = 'none';
    }
  }

  function openManageProfiles() {
    const container = document.getElementById('profile-modals-container');
    if (!container) return;
    
    container.innerHTML = renderManageProfiles();
    container.style.display = 'block';
  }

  function closeManageProfiles() {
    const container = document.getElementById('profile-modals-container');
    if (container) {
      container.innerHTML = renderProfilePicker();
      container.style.display = 'block';
    }
  }

  function createNewProfile() {
    const accountId = getAccountId();
    if (!accountId) {
      const auth = getAuth();
      if (auth) {
        auth.signIn().then(() => createNewProfile()).catch(() => {});
      }
      return;
    }
    
    const name = prompt('Enter profile name:');
    if (!name) return;
    
    const newProfile = createProfile({ name });
    switchProfile(newProfile.id);
    updateHeaderAvatar();
    closeProfilePicker();
    
    const auth = getAuth();
    if (auth && auth.state && auth.state.profile) {
      auth.refreshProfile().catch(() => {});
    }
  }

  function editProfile(profileId) {
    const profile = getProfileById(profileId);
    if (!profile) return;
    
    const newName = prompt('Edit profile name:', profile.name);
    if (!newName) return;
    
    updateProfile(profileId, { name: newName });
    closeManageProfiles();
    updateHeaderAvatar();
  }

  function deleteProfileConfirm(profileId) {
    const profile = getProfileById(profileId);
    if (!profile) return;
    
    if (confirm('Delete profile "' + profile.name + '"? This cannot be undone.')) {
      deleteProfile(profileId);
      closeManageProfiles();
      updateHeaderAvatar();
    }
  }

  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

  global.OTProfiles = {
    init,
    getAllProfiles,
    getAccountProfiles,
    getActiveProfile,
    getActiveProfileId,
    createProfile,
    switchProfile,
    deleteProfile,
    updateProfile,
    openProfilePicker,
    closeProfilePicker,
    renderProfilePicker,
    getRandomColor,
    getInitials,
    getCurrentApiKey,
    setCurrentApiKey,
    getCurrentClientId,
    setCurrentClientId,
    _internal: {
      getAccountId,
      migrateLegacyData,
      getProfileById,
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
