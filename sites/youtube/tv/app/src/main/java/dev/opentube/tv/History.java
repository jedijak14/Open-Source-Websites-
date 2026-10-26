package dev.opentube.tv;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Watch history, kept per account on the TV. Google's Data API stopped
 * exposing a viewer's YouTube watch history in 2016, so the honest thing is to
 * keep our own: every playback position is written here, which is also what
 * "continue watching" and the resume point read from.
 */
public final class History {

    public static final class Entry {
        public String id = "";
        public String videoId = "";
        public String title = "";
        public String channelName = "";
        public String poster = "";
        public int position;
        public int duration;
        public long at;
        public boolean live;
    }

    private final Prefs prefs;
    private final List<Entry> entries = new ArrayList<>();
    private String scope = "guest";

    History(Prefs prefs, Catalog catalog) {
        this.prefs = prefs;
    }

    public void useAccount(String accountKey) {
        scope = accountKey == null ? "guest" : accountKey;
        entries.clear();
        load();
    }

    private String key() {
        return "history:" + scope;
    }

    private void load() {
        String raw = prefs.get(key(), "");
        if (raw == null || raw.isEmpty()) return;
        try {
            JSONArray rows = new JSONArray(raw);
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.optJSONObject(i);
                if (row == null) continue;
                Entry entry = new Entry();
                entry.id = row.optString("id");
                entry.videoId = row.optString("videoId");
                entry.title = row.optString("title");
                entry.channelName = row.optString("channelName");
                entry.poster = row.optString("poster");
                entry.position = row.optInt("position");
                entry.duration = row.optInt("duration");
                entry.at = row.optLong("at");
                entry.live = row.optBoolean("live");
                entries.add(entry);
            }
        } catch (Exception ignored) {
            // ignore a corrupt cache
        }
        sort();
    }

    private void sort() {
        Collections.sort(entries, new Comparator<Entry>() {
            @Override
            public int compare(Entry a, Entry b) {
                return Long.compare(b.at, a.at);
            }
        });
    }

    private void save() {
        try {
            JSONArray rows = new JSONArray();
            for (Entry entry : entries) {
                JSONObject row = new JSONObject();
                row.put("id", entry.id);
                row.put("videoId", entry.videoId);
                row.put("title", entry.title);
                row.put("channelName", entry.channelName);
                row.put("poster", entry.poster);
                row.put("position", entry.position);
                row.put("duration", entry.duration);
                row.put("at", entry.at);
                row.put("live", entry.live);
                rows.put(row);
            }
            prefs.put(key(), rows.toString());
        } catch (Exception ignored) {
            // ignore
        }
    }

    public List<Entry> recent(int limit) {
        return new ArrayList<>(entries.subList(0, Math.min(limit, entries.size())));
    }

    public List<Entry> all() {
        return new ArrayList<>(entries);
    }

    /** Resume position in milliseconds, or 0 when there is nothing to resume. */
    public int resumePosition(String videoId) {
        for (Entry entry : entries) {
            if (entry.id.equals(videoId)) {
                // Do not offer to resume the last few seconds.
                if (entry.duration > 0 && entry.position > entry.duration - 15) return 0;
                return entry.position * 1000;
            }
        }
        return 0;
    }

    public void record(Catalog.Video video, int positionSeconds, int durationSeconds) {
        if (video == null) return;
        Entry found = null;
        for (Entry entry : entries) {
            if (entry.id.equals(video.id)) {
                found = entry;
                break;
            }
        }
        if (found == null) {
            found = new Entry();
            found.id = video.id;
            entries.add(found);
        }
        found.videoId = video.youtubeId == null ? "" : video.youtubeId;
        found.title = video.title;
        found.channelName = video.channelName;
        found.poster = video.poster;
        found.position = positionSeconds;
        found.duration = durationSeconds;
        found.at = System.currentTimeMillis();
        found.live = video.live;
        sort();
        if (entries.size() > 200) {
            entries.subList(200, entries.size()).clear();
        }
        save();
    }
}
