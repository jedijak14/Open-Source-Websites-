package dev.opentube.tv;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Google sign-in on a television. TVs have no usable keyboard for an OAuth
 * redirect, so this uses Google's device ("limited input") flow: the app shows a
 * short code and a URL, the viewer finishes on their phone, and the app polls
 * until the token arrives. Nothing is stored off the device.
 */
public final class Account {

    public interface DeviceListener {
        /** The code to show on screen; the viewer types it at {@code url}. */
        void onCode(String userCode, String url);

        /** Terminal state: signed in or not. */
        void onResult(boolean signedIn, String message);
    }

    public static final class Sync {
        public Api.Profile channel = new Api.Profile();
        public List<Api.Sub> subs = new ArrayList<>();
        public List<Catalog.Video> liked = new ArrayList<>();
        public long at;
    }

    private final Prefs prefs;
    private App app;
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean cancelled;
    private Sync cachedSync;

    Account(Prefs prefs) {
        this.prefs = prefs;
    }

    /** Wired by {@link App} so a finished sync can rebind the per-account state. */
    void attach(App application) {
        this.app = application;
    }

    public boolean signedIn() {
        JSONObject token = tokenJson();
        return token != null && (!token.optString("access", "").isEmpty() || !token.optString("refresh", "").isEmpty());
    }

    public String accountKey() {
        return prefs.accountKey();
    }

    /** Access token, refreshed if it has expired. Null when signed out. */
    public String token() {
        JSONObject token = tokenJson();
        if (token == null) return null;
        String access = token.optString("access", "");
        long expires = token.optLong("expires", 0L);
        if (!access.isEmpty() && expires > System.currentTimeMillis() + 60000) {
            return access;
        }
        String refresh = token.optString("refresh", "");
        if (refresh.isEmpty()) return access.isEmpty() ? null : access;
        try {
            java.util.Map<String, String> body = new java.util.LinkedHashMap<>();
            body.put("client_id", prefs.clientId());
            body.put("client_secret", prefs.clientSecret());
            body.put("grant_type", "refresh_token");
            body.put("refresh_token", refresh);
            JSONObject fresh = Net.json("https://oauth2.googleapis.com/token?" + Net.encode(body), null);
            String updated = fresh.optString("access_token", "");
            if (!updated.isEmpty()) {
                token.put("access", updated);
                token.put("expires", System.currentTimeMillis() + fresh.optLong("expires_in", 3600) * 1000L);
                prefs.setToken(token.toString());
                return updated;
            }
        } catch (Exception ignored) {
            // Fall through: the caller will surface "sign in again".
        }
        return access.isEmpty() ? null : access;
    }

    private JSONObject tokenJson() {
        String raw = prefs.token();
        if (raw == null || raw.isEmpty()) return null;
        try {
            return new JSONObject(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    /** Kicks off the device flow and polls until Google answers. */
    public void beginDeviceAuth(final DeviceListener listener) {
        cancelled = false;
        if (!prefs.canSignIn()) {
            listener.onResult(false, "Add a TV OAuth client ID and secret in Settings first.");
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    java.util.Map<String, String> body = new java.util.LinkedHashMap<>();
                    body.put("client_id", prefs.clientId());
                    body.put("scope", "https://www.googleapis.com/auth/youtube.readonly");
                    JSONObject start = Net.json("https://oauth2.googleapis.com/device/code?" + Net.encode(body), null);
                    final String deviceCode = start.optString("device_code");
                    final String userCode = start.optString("user_code");
                    String url = start.optString("verification_url", "https://www.google.com/device");
                    int interval = Math.max(5, start.optInt("interval", 5));
                    long expires = System.currentTimeMillis() + start.optLong("expires_in", 1800) * 1000L;

                    main.post(new Runnable() {
                        @Override
                        public void run() {
                            listener.onCode(userCode, url);
                        }
                    });

                    while (!cancelled && System.currentTimeMillis() < expires) {
                        Thread.sleep(interval * 1000L);
                        if (cancelled) break;
                        java.util.Map<String, String> poll = new java.util.LinkedHashMap<>();
                        poll.put("client_id", prefs.clientId());
                        poll.put("client_secret", prefs.clientSecret());
                        poll.put("device_code", deviceCode);
                        poll.put("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
                        try {
                            JSONObject token = Net.json("https://oauth2.googleapis.com/token?" + Net.encode(poll), null);
                            String access = token.optString("access_token", "");
                            if (!access.isEmpty()) {
                                JSONObject store = new JSONObject();
                                store.put("access", access);
                                store.put("refresh", token.optString("refresh_token", ""));
                                store.put("expires", System.currentTimeMillis() + token.optLong("expires_in", 3600) * 1000L);
                                prefs.setToken(store.toString());
                                main.post(new Runnable() {
                                    @Override
                                    public void run() {
                                        listener.onResult(true, "Signed in");
                                    }
                                });
                                return;
                            }
                        } catch (Net.HttpError error) {
                            String reason = error.reason == null ? "" : error.reason;
                            if (reason.contains("authorization_pending") || reason.contains("slow_down")) {
                                continue;
                            }
                            final String message = reason.contains("access_denied")
                                    ? "Sign-in was cancelled on the other device."
                                    : "Google rejected the sign-in: " + reason;
                            main.post(new Runnable() {
                                @Override
                                public void run() {
                                    listener.onResult(false, message);
                                }
                            });
                            return;
                        }
                    }
                    main.post(new Runnable() {
                        @Override
                        public void run() {
                            listener.onResult(false, "The sign-in code expired. Try again.");
                        }
                    });
                } catch (final Exception error) {
                    main.post(new Runnable() {
                        @Override
                        public void run() {
                            listener.onResult(false, "Could not reach Google. " + error.getMessage());
                        }
                    });
                }
            }
        }, "ot-device-auth").start();
    }

    public void cancelAuth() {
        cancelled = true;
    }

    public void signOut() {
        cancelled = true;
        String key = prefs.accountKey();
        prefs.setToken("");
        prefs.setAccountKey(null);
        if (key != null) prefs.remove("sync:" + key);
        cachedSync = null;
    }

    /** Last synced subscriptions/liked list, cached on the device. */
    public Sync sync() {
        if (cachedSync != null) return cachedSync;
        Sync sync = new Sync();
        String key = prefs.accountKey();
        if (key != null) {
            String raw = prefs.get("sync:" + key, "");
            if (raw != null && !raw.isEmpty()) {
                try {
                    JSONObject root = new JSONObject(raw);
                    sync.at = root.optLong("at");
                    JSONObject channel = root.optJSONObject("channel");
                    if (channel != null) {
                        sync.channel.channelId = channel.optString("channelId");
                        sync.channel.title = channel.optString("title");
                        sync.channel.avatar = channel.optString("avatar");
                        sync.channel.subscribers = channel.optLong("subscribers");
                        sync.channel.videos = channel.optLong("videos");
                    }
                    JSONArray subs = root.optJSONArray("subs");
                    if (subs != null) {
                        for (int i = 0; i < subs.length(); i++) {
                            JSONObject row = subs.optJSONObject(i);
                            if (row == null) continue;
                            Api.Sub sub = new Api.Sub();
                            sub.channelId = row.optString("channelId");
                            sub.title = row.optString("title");
                            sub.avatar = row.optString("avatar");
                            sub.description = row.optString("description");
                            sync.subs.add(sub);
                        }
                    }
                    JSONArray liked = root.optJSONArray("liked");
                    if (liked != null) {
                        for (int i = 0; i < liked.length(); i++) {
                            JSONObject row = liked.optJSONObject(i);
                            if (row == null) continue;
                            Catalog.Video video = new Catalog.Video();
                            video.id = row.optString("id");
                            video.youtubeId = row.optString("videoId");
                            video.title = row.optString("title");
                            video.channel = row.optString("channel");
                            video.channelName = row.optString("channelName");
                            video.poster = row.optString("poster");
                            video.duration = row.optInt("duration");
                            video.durationLabel = Api.label(video.duration);
                            video.live = true;
                            sync.liked.add(video);
                        }
                    }
                } catch (Exception ignored) {
                    // A corrupt cache is simply ignored; a refresh rewrites it.
                }
            }
        }
        cachedSync = sync;
        return sync;
    }

    /** Fetches the account's profile, subscriptions and liked videos. */
    public void refresh(final Runnable done, final Callback<Sync> callback) {
        final String token = token();
        if (token == null) {
            if (callback != null) callback.onResult(sync(), "Not signed in");
            if (done != null) done.run();
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                final Api api = new Api(prefs);
                final Sync sync = new Sync();
                String problem = null;
                try {
                    Api.Profile profile = api.myProfile(token);
                    if (!profile.channelId.isEmpty()) {
                        sync.channel = profile;
                        prefs.setAccountKey(profile.channelId);
                    }
                } catch (Api.Failure failure) {
                    problem = failure.getMessage();
                }
                try {
                    sync.subs = api.subscriptions(token, 4);
                } catch (Api.Failure failure) {
                    if (problem == null) problem = failure.getMessage();
                }
                try {
                    sync.liked = api.liked(token);
                } catch (Api.Failure failure) {
                    if (problem == null) problem = failure.getMessage();
                }
                sync.at = System.currentTimeMillis();
                store(sync);
                final String message = problem;
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        if (app != null) {
                            app.onAccountChanged();
                            app.taste.mergeAccount(sync);
                        }
                        if (callback != null) callback.onResult(sync, message);
                        if (done != null) done.run();
                    }
                });
            }
        }, "ot-account-sync").start();
    }

    public interface Callback<T> {
        void onResult(T value, String problem);
    }

    private void store(Sync sync) {
        String key = prefs.accountKey();
        if (key == null) return;
        try {
            JSONObject root = new JSONObject();
            root.put("at", sync.at);
            JSONObject channel = new JSONObject();
            channel.put("channelId", sync.channel.channelId);
            channel.put("title", sync.channel.title);
            channel.put("avatar", sync.channel.avatar);
            channel.put("subscribers", sync.channel.subscribers);
            channel.put("videos", sync.channel.videos);
            root.put("channel", channel);
            JSONArray subs = new JSONArray();
            for (Api.Sub sub : sync.subs) {
                JSONObject row = new JSONObject();
                row.put("channelId", sub.channelId);
                row.put("title", sub.title);
                row.put("avatar", sub.avatar);
                row.put("description", sub.description);
                subs.put(row);
            }
            root.put("subs", subs);
            JSONArray liked = new JSONArray();
            for (Catalog.Video video : sync.liked) {
                JSONObject row = new JSONObject();
                row.put("id", video.id);
                row.put("videoId", video.youtubeId);
                row.put("title", video.title);
                row.put("channel", video.channel);
                row.put("channelName", video.channelName);
                row.put("poster", video.poster);
                row.put("duration", video.duration);
                liked.put(row);
            }
            root.put("liked", liked);
            prefs.put("sync:" + key, root.toString());
            cachedSync = sync;
        } catch (Exception ignored) {
            // Serialising our own data cannot fail in practice.
        }
    }
}
