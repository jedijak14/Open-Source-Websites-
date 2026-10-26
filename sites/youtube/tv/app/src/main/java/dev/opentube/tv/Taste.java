package dev.opentube.tv;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The on-device taste model, a small sibling of the website's recommender.
 * It learns from what this TV actually plays — completion, channel and category —
 * and from the signed-in account's subscriptions and liked videos. Nothing is
 * uploaded: the profile is stored per account in SharedPreferences.
 */
public final class Taste {

    private static final double HALF_LIFE_DAYS = 30.0;
    private static final double DAY_MS = 24 * 60 * 60 * 1000.0;

    private final Prefs prefs;
    private final Catalog catalog;
    private final Map<String, Entry> channels = new LinkedHashMap<>();
    private final Map<String, Entry> categories = new LinkedHashMap<>();
    private final Map<String, Double> seen = new HashMap<>();
    private String scope = "guest";

    static final class Entry {
        double weight;
        long last;
        int count;
    }

    Taste(Prefs prefs, Catalog catalog) {
        this.prefs = prefs;
        this.catalog = catalog;
    }

    public void useAccount(String accountKey) {
        scope = accountKey == null ? "guest" : accountKey;
        channels.clear();
        categories.clear();
        seen.clear();
        load();
    }

    public String scope() {
        return scope;
    }

    public boolean hasSignals() {
        return !channels.isEmpty() || !seen.isEmpty();
    }

    public int watchedCount() {
        return seen.size();
    }

    public List<Map.Entry<String, Entry>> topChannels(int limit) {
        List<Map.Entry<String, Entry>> list = new ArrayList<>(channels.entrySet());
        Collections.sort(list, new Comparator<Map.Entry<String, Entry>>() {
            @Override
            public int compare(Map.Entry<String, Entry> a, Map.Entry<String, Entry> b) {
                return Double.compare(squash(b.getValue().weight), squash(a.getValue().weight));
            }
        });
        return list.subList(0, Math.min(limit, list.size()));
    }

    public void reset() {
        channels.clear();
        categories.clear();
        seen.clear();
        prefs.put(key(), "");
    }

    private String key() {
        return "taste:" + scope;
    }

    private void load() {
        String raw = prefs.get(key(), "");
        if (raw == null || raw.isEmpty()) return;
        try {
            JSONObject root = new JSONObject(raw);
            readMap(root.optJSONObject("channels"), channels);
            readMap(root.optJSONObject("categories"), categories);
            JSONObject videos = root.optJSONObject("seen");
            if (videos != null) {
                Iterator<String> keys = videos.keys();
                while (keys.hasNext()) {
                    String id = keys.next();
                    seen.put(id, videos.optDouble(id, 0.0));
                }
            }
        } catch (Exception ignored) {
            // A corrupt profile is treated as an empty one.
        }
    }

    private void readMap(JSONObject source, Map<String, Entry> target) {
        if (source == null) return;
        Iterator<String> keys = source.keys();
        while (keys.hasNext()) {
            String name = keys.next();
            JSONObject row = source.optJSONObject(name);
            if (row == null) continue;
            Entry entry = new Entry();
            entry.weight = row.optDouble("w", 0);
            entry.last = row.optLong("last", 0);
            entry.count = row.optInt("n", 0);
            target.put(name, entry);
        }
    }

    private void save() {
        try {
            JSONObject root = new JSONObject();
            root.put("channels", writeMap(channels));
            root.put("categories", writeMap(categories));
            JSONObject videos = new JSONObject();
            for (Map.Entry<String, Double> entry : seen.entrySet()) {
                videos.put(entry.getKey(), entry.getValue());
            }
            root.put("seen", videos);
            prefs.put(key(), root.toString());
        } catch (Exception ignored) {
            // ignore
        }
    }

    private JSONObject writeMap(Map<String, Entry> source) throws Exception {
        JSONObject out = new JSONObject();
        for (Map.Entry<String, Entry> entry : source.entrySet()) {
            JSONObject row = new JSONObject();
            row.put("w", entry.getValue().weight);
            row.put("last", entry.getValue().last);
            row.put("n", entry.getValue().count);
            out.put(entry.getKey(), row);
        }
        return out;
    }

    private double decayed(Entry entry, long now) {
        if (entry == null) return 0;
        double days = Math.max(0, (now - entry.last) / DAY_MS);
        return entry.weight * Math.pow(0.5, days / HALF_LIFE_DAYS);
    }

    private void bump(Map<String, Entry> map, String name, double amount) {
        if (name == null || name.isEmpty() || amount == 0) return;
        long now = System.currentTimeMillis();
        Entry entry = map.get(name);
        if (entry == null) {
            entry = new Entry();
            map.put(name, entry);
        } else {
            entry.weight = decayed(entry, now);
        }
        entry.weight += amount;
        entry.last = now;
        entry.count += 1;
    }

    /** completion is 0..1 of the runtime that was watched. */
    public void record(Catalog.Video video, double completion) {
        if (video == null) return;
        double amount;
        if (completion >= 0.85) amount = 1.0;
        else if (completion >= 0.25) amount = completion;
        else amount = -0.3;
        bump(channels, video.channel, amount);
        bump(categories, video.category, amount * 0.55);
        seen.put(video.id, completion);
        save();
    }

    /** Subscriptions and liked videos from the Google account. */
    public void mergeAccount(Account.Sync sync) {
        if (sync == null) return;
        for (Api.Sub sub : sync.subs) {
            bump(channels, sub.channelId, 0.8);
        }
        for (Catalog.Video video : sync.liked) {
            bump(channels, video.channel, 0.6);
        }
        save();
    }

    private static double squash(double weight) {
        return weight / (1.0 + Math.abs(weight));
    }

    public double score(Catalog.Video video) {
        long now = System.currentTimeMillis();
        double channel = squash(decayed(channels.get(video.channel), now));
        double category = squash(decayed(categories.get(video.category), now));
        double freshness = 0;
        if (video.published > 0) {
            double days = Math.max(0, (now - video.published) / DAY_MS);
            freshness = Math.pow(0.5, days / 90.0);
        }
        double value = channel * 0.50 + category * 0.24 + freshness * 0.12;
        Double completion = seen.get(video.id);
        if (completion != null) {
            value -= completion >= 0.85 ? 0.22 : 0.08;
        }
        return value;
    }

    public List<Catalog.Video> rank(List<Catalog.Video> source) {
        List<Catalog.Video> out = new ArrayList<>(source);
        Collections.sort(out, new Comparator<Catalog.Video>() {
            @Override
            public int compare(Catalog.Video a, Catalog.Video b) {
                int byScore = Double.compare(score(b), score(a));
                if (byScore != 0) return byScore;
                return Long.compare(b.published, a.published);
            }
        });
        return out;
    }

    /** The line under the "For you" heading. */
    public String reason(Catalog.Video video) {
        long now = System.currentTimeMillis();
        Entry channel = channels.get(video.channel);
        if (channel != null && decayed(channel, now) > 0.4) {
            String name = video.channelName.isEmpty() ? video.channel : video.channelName;
            return "Because you watch " + name;
        }
        Entry category = categories.get(video.category);
        if (category != null && decayed(category, now) > 0.4) {
            return "Because you watch " + video.category;
        }
        if (seen.containsKey(video.id)) return "You have watched this before";
        return "New on OpenTube";
    }

    public String summary() {
        if (!hasSignals()) return "Nothing learned yet — watch something.";
        List<Map.Entry<String, Entry>> top = topChannels(1);
        StringBuilder out = new StringBuilder();
        out.append(seen.size()).append(seen.size() == 1 ? " video" : " videos").append(" in the model");
        if (!top.isEmpty()) {
            String name = top.get(0).getKey();
            Catalog.Channel channel = catalog.channel(name);
            out.append(" · strongest channel: ").append(channel == null ? name : channel.name);
        }
        return out.toString();
    }
}
