package dev.opentube.tv;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The slice of the YouTube Data API the TV app needs, with errors translated
 * into something a person can act on. Quota failures are reported as
 * {@link #quota} so callers can fall back to the bundled catalogue instead of
 * putting an API error in front of the viewer.
 */
public final class Api {

    public static final class Failure extends Exception {
        public final boolean quota;
        public final boolean unauthorised;

        Failure(String message, boolean quota, boolean unauthorised) {
            super(message);
            this.quota = quota;
            this.unauthorised = unauthorised;
        }
    }

    public static final class Sub {
        public String channelId = "";
        public String title = "";
        public String avatar = "";
        public String description = "";
    }

    public static final class Profile {
        public String channelId = "";
        public String title = "";
        public String avatar = "";
        public long subscribers;
        public long videos;
    }

    private static final String ROOT = "https://www.googleapis.com/youtube/v3/";

    private final Prefs prefs;

    public Api(Prefs prefs) {
        this.prefs = prefs;
    }

    private JSONObject get(String endpoint, Map<String, String> params, String token) throws Failure {
        Map<String, String> query = new LinkedHashMap<>(params);
        if (token == null || token.isEmpty()) {
            String key = prefs.apiKey();
            if (key.isEmpty()) {
                throw new Failure("no-key", false, false);
            }
            query.put("key", key);
        }
        try {
            return Net.json(ROOT + endpoint + '?' + Net.encode(query), token);
        } catch (Net.HttpError error) {
            boolean quota = error.code == 403 && looksLikeQuota(error.reason);
            boolean auth = error.code == 401 || (error.code == 403 && !quota);
            throw new Failure(error.reason, quota, auth);
        } catch (Exception error) {
            throw new Failure("network", false, false);
        }
    }

    static boolean looksLikeQuota(String reason) {
        if (reason == null) return false;
        String lower = reason.toLowerCase();
        return lower.contains("quota") || lower.contains("dailylimit") || lower.contains("ratelimit")
                || lower.contains("exceeded");
    }

    public List<Catalog.Video> search(String text, int limit) throws Failure {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("part", "snippet");
        params.put("type", "video");
        params.put("maxResults", String.valueOf(limit));
        params.put("q", text);
        params.put("safeSearch", "moderate");
        JSONObject root = get("search", params, null);
        List<Catalog.Video> out = new ArrayList<>();
        JSONArray items = root.optJSONArray("items");
        if (items == null) return out;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            JSONObject id = item.optJSONObject("id");
            if (id == null) continue;
            Catalog.Video video = fromSnippet(item.optJSONObject("snippet"), id.optString("videoId"));
            if (video != null) out.add(video);
        }
        return out;
    }

    public List<Catalog.Video> mostPopular(int limit) throws Failure {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("part", "snippet,contentDetails,statistics");
        params.put("chart", "mostPopular");
        params.put("maxResults", String.valueOf(limit));
        JSONObject root = get("videos", params, null);
        return videosFrom(root);
    }

    /** Videos uploaded by a channel, using its uploads playlist (UU…). */
    public List<Catalog.Video> channelUploads(String channelId, int limit) throws Failure {
        String uploads = channelId.startsWith("UC") ? "UU" + channelId.substring(2) : channelId;
        Map<String, String> params = new LinkedHashMap<>();
        params.put("part", "snippet,contentDetails");
        params.put("playlistId", uploads);
        params.put("maxResults", String.valueOf(limit));
        JSONObject root = get("playlistItems", params, null);
        List<Catalog.Video> out = new ArrayList<>();
        JSONArray items = root.optJSONArray("items");
        if (items == null) return out;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            JSONObject snippet = item.optJSONObject("snippet");
            JSONObject details = item.optJSONObject("contentDetails");
            String videoId = details == null ? "" : details.optString("videoId", "");
            Catalog.Video video = fromSnippet(snippet, videoId);
            if (video != null) out.add(video);
        }
        return out;
    }

    public List<Catalog.Video> liked(String token) throws Failure {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("part", "snippet,contentDetails");
        params.put("myRating", "like");
        params.put("maxResults", "50");
        JSONObject root = get("videos", params, token);
        return videosFrom(root);
    }

    public Profile myProfile(String token) throws Failure {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("part", "snippet,statistics");
        params.put("mine", "true");
        JSONObject root = get("channels", params, token);
        JSONArray items = root.optJSONArray("items");
        Profile profile = new Profile();
        if (items == null || items.length() == 0) return profile;
        JSONObject row = items.optJSONObject(0);
        if (row == null) return profile;
        profile.channelId = row.optString("id");
        JSONObject snippet = row.optJSONObject("snippet");
        if (snippet != null) {
            profile.title = snippet.optString("title");
            profile.avatar = thumb(snippet);
        }
        JSONObject stats = row.optJSONObject("statistics");
        if (stats != null) {
            profile.subscribers = parseLong(stats.optString("subscriberCount"));
            profile.videos = parseLong(stats.optString("videoCount"));
        }
        return profile;
    }

    /** Subscriptions, following nextPageToken so a big list is not cut at 50. */
    public List<Sub> subscriptions(String token, int maxPages) throws Failure {
        List<Sub> out = new ArrayList<>();
        String page = "";
        for (int pages = 0; pages < maxPages; pages++) {
            Map<String, String> params = new LinkedHashMap<>();
            params.put("part", "snippet");
            params.put("mine", "true");
            params.put("maxResults", "50");
            params.put("order", "alphabetical");
            if (!page.isEmpty()) params.put("pageToken", page);
            JSONObject root = get("subscriptions", params, token);
            JSONArray items = root.optJSONArray("items");
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item == null) continue;
                    JSONObject snippet = item.optJSONObject("snippet");
                    if (snippet == null) continue;
                    Sub sub = new Sub();
                    JSONObject resource = snippet.optJSONObject("resourceId");
                    sub.channelId = resource == null ? "" : resource.optString("channelId");
                    sub.title = snippet.optString("title");
                    sub.description = snippet.optString("description");
                    sub.avatar = thumb(snippet);
                    if (!sub.channelId.isEmpty()) out.add(sub);
                }
            }
            page = root.optString("nextPageToken", "");
            if (page.isEmpty()) break;
        }
        return out;
    }

    private List<Catalog.Video> videosFrom(JSONObject root) {
        List<Catalog.Video> out = new ArrayList<>();
        JSONArray items = root.optJSONArray("items");
        if (items == null) return out;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            Catalog.Video video = fromSnippet(item.optJSONObject("snippet"), item.optString("id"));
            if (video == null) continue;
            JSONObject content = item.optJSONObject("contentDetails");
            if (content != null) {
                video.duration = parseDuration(content.optString("duration"));
                video.durationLabel = label(video.duration);
            }
            JSONObject stats = item.optJSONObject("statistics");
            if (stats != null) {
                video.views = parseLong(stats.optString("viewCount"));
                video.likes = parseLong(stats.optString("likeCount"));
            }
            out.add(video);
        }
        return out;
    }

    private Catalog.Video fromSnippet(JSONObject snippet, String videoId) {
        if (snippet == null || videoId == null || videoId.isEmpty()) return null;
        Catalog.Video video = new Catalog.Video();
        video.id = "yt:" + videoId;
        video.youtubeId = videoId;
        video.live = true;
        video.title = snippet.optString("title");
        video.channelName = snippet.optString("channelTitle");
        video.channel = snippet.optString("channelId");
        video.desc = snippet.optString("description");
        video.published = Catalog.parseDate(snippet.optString("publishedAt"));
        video.poster = thumb(snippet);
        JSONArray tags = snippet.optJSONArray("tags");
        if (tags != null) {
            for (int i = 0; i < tags.length(); i++) video.tags.add(tags.optString(i));
        }
        video.category = "";
        return video;
    }

    private static String thumb(JSONObject snippet) {
        JSONObject thumbs = snippet.optJSONObject("thumbnails");
        if (thumbs == null) return "";
        String[] order = {"maxres", "standard", "high", "medium", "default"};
        for (String name : order) {
            JSONObject size = thumbs.optJSONObject(name);
            if (size != null && !size.optString("url").isEmpty()) return size.optString("url");
        }
        return "";
    }

    static long parseLong(String value) {
        try {
            return Long.parseLong(value.trim());
        } catch (Exception ignored) {
            return 0L;
        }
    }

    /** ISO-8601 duration (PT1H2M3S) to seconds. */
    static int parseDuration(String iso) {
        if (iso == null || iso.isEmpty()) return 0;
        int seconds = 0;
        int number = 0;
        for (int i = 0; i < iso.length(); i++) {
            char c = iso.charAt(i);
            if (Character.isDigit(c)) {
                number = number * 10 + (c - '0');
            } else if (c == 'H') {
                seconds += number * 3600;
                number = 0;
            } else if (c == 'M') {
                seconds += number * 60;
                number = 0;
            } else if (c == 'S') {
                seconds += number;
                number = 0;
            }
        }
        return seconds;
    }

    static String label(int seconds) {
        if (seconds <= 0) return "";
        int hours = seconds / 3600;
        int minutes = (seconds % 3600) / 60;
        int secs = seconds % 60;
        if (hours > 0) return String.format(java.util.Locale.US, "%d:%02d:%02d", hours, minutes, secs);
        return String.format(java.util.Locale.US, "%d:%02d", minutes, secs);
    }
}
