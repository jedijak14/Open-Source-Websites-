package dev.opentube.tv;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/**
 * The content the app ships with, generated from the website's own data file by
 * {@code tv/tools/build-catalog.mjs}. Every clip is original OpenTube content.
 */
public final class Catalog {

    public static final class Caption {
        public final int time;
        public final String text;

        Caption(int time, String text) {
            this.time = time;
            this.text = text;
        }
    }

    public static final class Channel {
        public String slug = "";
        public String name = "";
        public String handle = "";
        public String avatar = "";
        public String about = "";
        public long subscribers;
    }

    public static final class Video {
        public String id = "";
        public String title = "";
        public String channel = "";
        public String channelName = "";
        public String category = "";
        public String poster = "";
        public String clip = "";
        public String desc = "";
        public String durationLabel = "";
        public String match = "";
        public List<String> tags = new ArrayList<>();
        public List<int[]> chapters = new ArrayList<>();
        public List<Caption> captions = new ArrayList<>();
        public int duration;
        public long views;
        public long likes;
        public long published;
        /** True when the item came from the YouTube API rather than the bundle. */
        public boolean live;
        /** 11-character YouTube id, only for live items. */
        public String youtubeId = "";

        public boolean hasLocalClip() {
            return clip != null && !clip.isEmpty();
        }
    }

    public static final class Movie {
        public String id = "";
        public String title = "";
        public String channelName = "";
        public String poster = "";
        public String clip = "";
        public String desc = "";
        public String runtime = "";
        public String rating = "";
        public String price = "";
        public int year;
        public boolean freeWithAds;
    }

    private final String base;
    private final List<Video> videos = new ArrayList<>();
    private final Map<String, Channel> channels = new LinkedHashMap<>();
    private final List<String> categories = new ArrayList<>();
    private final List<Movie> movies = new ArrayList<>();

    private Catalog(String base) {
        this.base = base;
    }

    public String baseUrl() {
        return base;
    }

    public List<Video> videos() {
        return Collections.unmodifiableList(videos);
    }

    public Map<String, Channel> channels() {
        return channels;
    }

    public List<String> categories() {
        return categories;
    }

    public List<Movie> movies() {
        return movies;
    }

    public Channel channel(String slug) {
        return channels.get(slug);
    }

    public Video video(String id) {
        for (Video video : videos) {
            if (video.id.equals(id)) return video;
        }
        return null;
    }

    public Movie movie(String id) {
        for (Movie movie : movies) {
            if (movie.id.equals(id)) return movie;
        }
        return null;
    }

    public List<Video> byCategory(String category) {
        List<Video> out = new ArrayList<>();
        for (Video video : videos) {
            if (category.equalsIgnoreCase(video.category)) out.add(video);
        }
        return out;
    }

    public List<Video> byChannel(String slug) {
        List<Video> out = new ArrayList<>();
        for (Video video : videos) {
            if (slug.equals(video.channel)) out.add(video);
        }
        return out;
    }

    /** Absolute URL for a poster or avatar path from the catalogue. */
    public String url(String path) {
        if (path == null || path.isEmpty()) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        String root = base.endsWith("/") ? base : base + "/";
        return root + (path.startsWith("/") ? path.substring(1) : path);
    }

    public static Catalog load(Context context) {
        Catalog catalog = new Catalog(BuildConfig.SITE);
        try {
            String raw = readAsset(context, "catalog.json");
            JSONObject root = new JSONObject(raw);
            String base = root.optString("base", BuildConfig.SITE);
            catalog = new Catalog(base.endsWith("/") ? base : base + "/");

            JSONArray channels = root.optJSONArray("channels");
            if (channels != null) {
                for (int i = 0; i < channels.length(); i++) {
                    JSONObject row = channels.getJSONObject(i);
                    Channel channel = new Channel();
                    channel.slug = row.optString("slug");
                    channel.name = row.optString("name", channel.slug);
                    channel.handle = row.optString("handle");
                    channel.avatar = row.optString("avatar");
                    channel.about = row.optString("about");
                    channel.subscribers = row.optLong("subscribers");
                    catalog.channels.put(channel.slug, channel);
                }
            }

            JSONArray categories = root.optJSONArray("categories");
            if (categories != null) {
                for (int i = 0; i < categories.length(); i++) {
                    catalog.categories.add(categories.getString(i));
                }
            }

            JSONArray videos = root.optJSONArray("videos");
            if (videos != null) {
                for (int i = 0; i < videos.length(); i++) {
                    Video video = readVideo(videos.getJSONObject(i));
                    if (!video.id.isEmpty()) catalog.videos.add(video);
                }
            }

            String moviesRaw = readAsset(context, "movies.json");
            JSONObject movieRoot = new JSONObject(moviesRaw);
            JSONArray movies = movieRoot.optJSONArray("movies");
            if (movies != null) {
                for (int i = 0; i < movies.length(); i++) {
                    JSONObject row = movies.getJSONObject(i);
                    Movie movie = new Movie();
                    movie.id = row.optString("id");
                    movie.title = row.optString("title");
                    movie.channelName = row.optString("channelName");
                    movie.poster = row.optString("poster");
                    movie.clip = row.optString("clip");
                    movie.desc = row.optString("desc");
                    movie.runtime = row.optString("runtime");
                    movie.rating = row.optString("rating");
                    movie.price = row.optString("price");
                    movie.year = row.optInt("year");
                    movie.freeWithAds = row.optBoolean("freeWithAds", false);
                    catalog.movies.add(movie);
                }
            }
        } catch (Exception ignored) {
            // A missing bundle is not fatal: live results still work.
        }
        return catalog;
    }

    private static Video readVideo(JSONObject row) {
        Video video = new Video();
        video.id = row.optString("id");
        video.title = row.optString("title");
        video.channel = row.optString("channel");
        video.channelName = row.optString("channelName");
        video.category = row.optString("category");
        video.poster = row.optString("poster");
        video.clip = row.optString("clip");
        video.desc = row.optString("desc");
        video.durationLabel = row.optString("durationLabel");
        video.duration = row.optInt("duration");
        video.views = row.optLong("views");
        video.likes = row.optLong("likes");
        video.published = parseDate(row.optString("published"));

        JSONArray tags = row.optJSONArray("tags");
        if (tags != null) {
            for (int i = 0; i < tags.length(); i++) video.tags.add(tags.optString(i));
        }
        JSONArray chapters = row.optJSONArray("chapters");
        if (chapters != null) {
            for (int i = 0; i < chapters.length(); i++) {
                JSONArray pair = chapters.optJSONArray(i);
                if (pair != null && pair.length() >= 2) {
                    video.chapters.add(new int[]{pair.optInt(0), i});
                }
            }
        }
        JSONArray captions = row.optJSONArray("captions");
        if (captions != null) {
            for (int i = 0; i < captions.length(); i++) {
                JSONObject line = captions.optJSONObject(i);
                if (line == null) continue;
                video.captions.add(new Caption(line.optInt("time"), line.optString("text")));
            }
        }
        return video;
    }

    static long parseDate(String iso) {
        if (iso == null || iso.isEmpty()) return 0L;
        String[] patterns = {"yyyy-MM-dd", "yyyy-MM-dd'T'HH:mm:ss'Z'", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"};
        for (String pattern : patterns) {
            try {
                SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
                format.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date date = format.parse(iso);
                if (date != null) return date.getTime();
            } catch (ParseException ignored) {
                // try the next shape
            }
        }
        return 0L;
    }

    private static String readAsset(Context context, String name) throws Exception {
        InputStream in = context.getAssets().open(name);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) > 0) out.write(buffer, 0, read);
        in.close();
        return out.toString("UTF-8");
    }
}
