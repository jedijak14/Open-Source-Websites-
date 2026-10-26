# Multi-Profile System Implementation

## Overview

This document describes the implementation of the Netflix-style multi-profile system for OpenTube, with permanent Google sign-in and YouTube TV-like UI.

## Changes Made

### 1. **Permanent Google Sign-in** (`assets/auth.js`)

**Changes:**
- Changed token storage from `sessionStorage` to `localStorage`
- Added `REFRESH_TOKEN_KEY` and `TOKEN_EXPIRY_KEY` constants
- Updated `restoreToken()` to read from localStorage
- Updated `persistToken()` to save to localStorage with refresh token support
- Updated `forgetToken()` to clear all token-related storage
- Updated `signOut()` to also clear profile system

**Result:** Google sign-in now persists across browser sessions. Users stay signed in until they explicitly sign out.

### 2. **Multi-Profile System** (`assets/profiles.js` - NEW FILE)

**Features:**
- Netflix-style profile picker modal with "Who's watching?" UI
- Multiple profiles per Google account
- Each profile has:
  - Custom name
  - Custom avatar (image URL or colored initial)
  - Custom color (for initial avatars)
  - Profile-specific storage keys for:
    - Recommendations (`opentube:rec:{profileId}`)
    - Watch history (`opentube:history:{profileId}`)
    - Watch later (`opentube:later:{profileId}`)
    - Likes (`opentube:likes:{profileId}`)
    - Subscriptions (`opentube:subs:{profileId}`)
  - Last used timestamp
  - Creation timestamp

**Key Functions:**
- `getAllProfiles()` - Get all profiles for all accounts
- `getAccountProfiles()` - Get profiles for current account
- `getActiveProfile()` - Get currently active profile
- `createProfile(options)` - Create a new profile
- `switchProfile(profileId)` - Switch to a different profile
- `deleteProfile(profileId)` - Delete a profile (prevents deleting last profile)
- `updateProfile(profileId, updates)` - Update profile properties
- `openProfilePicker()` - Open the profile picker modal
- `renderProfilePicker()` - Render the profile picker UI
- `renderManageProfiles()` - Render the manage profiles UI

### 3. **Profile-Aware Storage** (`assets/app.js`)

**Changes:**
- Updated `Store` object to support profile-specific storage
- Added `profilePrefix` to Store for profile-specific keys
- Added `setProfile(prefix)` method
- Added `getStorageKey(key)` method to generate profile-prefixed keys
- Updated `load()` to load profile-specific data
- Added event listener for `profileChanged` to reload Store when profile switches

**Result:** Each profile now has its own preferences (theme, sidebar, theater mode, etc.) and watch history.

### 4. **Recommender Integration**

**Changes:**
- The recommender already supported per-account profiles via `useAccount()`
- Updated to work seamlessly with the new profile system
- When switching profiles, the recommender automatically switches to that profile's data

**Result:** Recommendations are now profile-specific and persist across sessions.

### 5. **UI Updates**

#### CSS (`assets/styles.css`)

Added styles for:
- Profile picker modal (`.profile-modal`)
- Profile cards (`.profile-card`)
- Profile card avatars (`.profile-card__avatar`)
- Profile card names (`.profile-card__name`)
- Manage profiles modal (`.manage-modal`)
- Manage profile items (`.manage-profile-item`)
- Avatar fallback styling (`.avatar-fallback`)
- YouTube TV-like styling (dark theme by default)

#### Header (`assets/app.js`)

**Changes:**
- Updated `paintHeaderAvatar()` to display the active profile's avatar
- Updated avatar button click handler to open profile picker
- Profile avatars now show colored initials or custom images
- Added profile name to account menu

#### Settings Page (`settings.html`, `assets/settings.js`)

**Changes:**
- Added "Profiles" section to settings navigation
- Added profiles management panel
- Shows all profiles for the current account
- Allows switching between profiles
- Allows adding new profiles
- Allows managing profiles (edit/delete)
- Updated "Clear all" to also clear profile data

### 6. **HTML Updates**

Added `profiles.js` script to all HTML files:
- `index.html`
- `watch.html`
- `channel.html`
- `search.html`
- `library.html`
- `settings.html`

## Google API Capabilities

### ✅ **Subscriptions - WORKS**
- YouTube Data API v3 with `youtube.readonly` scope supports reading subscriptions
- Implemented via `mySubscriptions()` in `youtube-api.js`
- Returns up to 200 subscriptions per account
- Synced to profile-specific storage

### ✅ **Watch History - WORKS (with limitations)**
- Google does NOT expose watch history through YouTube Data API v3
- **Solution:** Google Takeout import
- Users can export watch history from https://takeout.google.com/
- Imported history is stored per-profile
- History from Takeout is merged into recommendations

### ✅ **Profile Switching - WORKS**
- Multiple profiles per Google account
- Each profile maintains separate:
  - Watch history
  - Recommendations
  - Preferences
  - Likes/dislikes
  - Subscriptions
- Profile switching is instant and persists across sessions

### ❌ **Real-time History Sync - NOT POSSIBLE**
- YouTube does not provide API access to watch history
- Only solution is Takeout import (manual process)
- This is a Google API limitation, not an implementation issue

## UI/UX Improvements

### Profile Picker Modal
- Dark theme matching YouTube TV
- "Who's watching?" title
- Grid of profile cards with avatars
- "Add profile" button
- "Manage profiles" button
- Settings button

### Profile Cards
- Circular avatars with:
  - Custom images (if set)
  - Colored initials (if no image)
  - Random colors from predefined palette
- Profile name below avatar
- Active profile highlighted with border

### Manage Profiles
- List of all profiles
- Edit profile name
- Delete profile (with confirmation)
- Shows last used date
- Indicates current profile

### Header Integration
- Profile avatar in header
- Click opens profile picker
- Shows profile name in account menu
- Updates dynamically when switching profiles

## Storage Structure

### LocalStorage Keys

**Global:**
- `opentube:profiles:v1` - All profiles for all accounts
- `opentube:active-profile` - Currently active profile ID
- `opentube:youtube-key` - API key
- `opentube:google-client-id` - OAuth client ID
- `opentube:live` - Live data settings

**Per-Profile:**
- `opentube:rec:{profileId}` - Recommendation data
- `opentube:history:{profileId}` - Watch history
- `opentube:later:{profileId}` - Watch later list
- `opentube:likes:{profileId}` - Liked videos
- `opentube:subs:{profileId}` - Subscriptions
- `opentube:v1:{profileId}` - Preferences (theme, sidebar, etc.)

**SessionStorage (deprecated):**
- `opentube:google-token` - NOW STORED IN LOCALSTORAGE
- `opentube:google-refresh-token` - Refresh token (if available)
- `opentube:google-token-expiry` - Token expiry timestamp

## Testing

### Manual Testing

1. **Sign in with Google**
   - Click avatar button → Sign in with Google
   - Verify token persists after page refresh

2. **Create Profiles**
   - After signing in, click avatar button
   - Click "Add profile"
   - Enter name, verify profile is created

3. **Switch Profiles**
   - Create multiple profiles
   - Click different profile cards
   - Verify recommendations and history are profile-specific

4. **Manage Profiles**
   - Click "Manage profiles"
   - Edit profile name
   - Delete profile (verify last profile cannot be deleted)

5. **Watch History**
   - Import Takeout history
   - Verify it appears in Library → History
   - Switch profiles, verify history is profile-specific

6. **Subscriptions**
   - Sign in with Google
   - Go to Library → Subscriptions
   - Verify subscriptions load from YouTube API
   - Verify they're profile-specific

### Automated Tests

All existing tests (287 checks) should still pass. The profile system is additive and doesn't break existing functionality.

## Known Limitations

1. **YouTube Watch History API Access**
   - Google does not provide read access to watch history via API
   - Only solution is manual Takeout import
   - This is a Google API limitation

2. **Real-time Sync**
   - Profile data syncs when switching profiles
   - No real-time sync across devices (no backend)
   - All data is local to the browser

3. **Profile Avatars**
   - Currently supports:
     - Custom image URLs
     - Colored initials
   - No image upload (would require backend)
   - Users can use Gravatar or other image URLs

4. **Kids Profiles**
   - `isKids` flag exists but not fully implemented
   - Can be extended for parental controls

## Future Enhancements

1. **Profile Icons**
   - Add icon picker for profiles
   - Predefined avatar options

2. **Profile PINs**
   - Add PIN protection for profiles
   - Parental controls

3. **Profile Sync**
   - Sync profiles across devices via encrypted storage
   - Requires backend or encrypted localStorage sync

4. **Better Avatar Selection**
   - Integrate with Google account avatars
   - Allow image upload to backend (if added)

5. **Profile Preferences**
   - Per-profile theme settings
   - Per-profile playback preferences

## Files Modified

1. `assets/profiles.js` - NEW - Profile management system
2. `assets/auth.js` - Permanent sign-in with localStorage
3. `assets/app.js` - Profile-aware Store and header integration
4. `assets/styles.css` - Profile picker and YouTube TV styling
5. `assets/settings.js` - Profile management in settings
6. `settings.html` - Profile section in settings
7. All HTML files - Added profiles.js script tag

## Backward Compatibility

- All existing functionality preserved
- Existing users automatically migrate to profile system
- Anonymous users (not signed in) continue to work as before
- Legacy data is automatically migrated to main profile

## Security Considerations

1. **Token Storage**
   - Tokens now stored in localStorage (persistent)
   - Still only accessible to same-origin scripts
   - No server-side storage

2. **Profile Data**
   - All profile data stored locally
   - No data sent to external servers
   - Each profile isolated from others

3. **OAuth Scope**
   - Only `youtube.readonly` scope requested
   - No write access to YouTube
   - Read-only access to subscriptions, likes, playlists

## Conclusion

This implementation adds a complete Netflix-style multi-profile system to OpenTube with:
- ✅ Permanent Google sign-in
- ✅ Multiple profiles per account
- ✅ Profile-specific recommendations
- ✅ Profile-specific watch history
- ✅ Profile-specific preferences
- ✅ YouTube TV-like UI
- ✅ Subscriptions sync (read-only)
- ✅ Watch history via Takeout import

The implementation is fully backward compatible and maintains all existing functionality while adding the requested features.
