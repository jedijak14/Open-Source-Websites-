package dev.opentube.tv;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;
import android.widget.ImageView;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Map;

/** Tiny HTTP + image helper. No third-party networking library is used. */
public final class Net {

    public static final class HttpError extends Exception {
        public final int code;
        public final String reason;

        HttpError(int code, String reason) {
            super(reason + " (" + code + ")");
            this.code = code;
            this.reason = reason;
        }
    }

    private static final int TIMEOUT = 15000;
    private static final LruCache<String, Bitmap> CACHE = new LruCache<String, Bitmap>(24 * 1024 * 1024) {
        @Override
        protected int sizeOf(String key, Bitmap value) {
            return value.getByteCount();
        }
    };
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private Net() {
    }

    public static String encode(Map<String, String> params) {
        StringBuilder out = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (entry.getValue() == null) continue;
            if (out.length() > 0) out.append('&');
            try {
                out.append(URLEncoder.encode(entry.getKey(), "UTF-8"));
                out.append('=');
                out.append(URLEncoder.encode(entry.getValue(), "UTF-8"));
            } catch (Exception ignored) {
                // Encoding UTF-8 cannot fail in practice.
            }
        }
        return out.toString();
    }

    public static String text(String url, String bearer) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(TIMEOUT);
        connection.setReadTimeout(TIMEOUT);
        connection.setRequestProperty("Accept", "application/json");
        if (bearer != null && !bearer.isEmpty()) {
            connection.setRequestProperty("Authorization", "Bearer " + bearer);
        }
        int code = connection.getResponseCode();
        InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String body = stream == null ? "" : readAll(stream);
        connection.disconnect();
        if (code >= 400) {
            throw new HttpError(code, reasonOf(body));
        }
        return body;
    }

    public static JSONObject json(String url, String bearer) throws Exception {
        return new JSONObject(text(url, bearer));
    }

    private static String reasonOf(String body) {
        try {
            JSONObject root = new JSONObject(body);
            JSONObject error = root.optJSONObject("error");
            if (error == null) return root.optString("error", "request failed");
            String message = error.optString("message", "");
            String reason = error.optString("status", "");
            org.json.JSONArray errors = error.optJSONArray("errors");
            if (errors != null && errors.length() > 0) {
                JSONObject first = errors.optJSONObject(0);
                if (first != null) {
                    reason = first.optString("reason", reason);
                    if (message.isEmpty()) message = first.optString("message", "");
                }
            }
            return reason.isEmpty() ? message : reason;
        } catch (Exception ignored) {
            return "request failed";
        }
    }

    private static String readAll(InputStream stream) throws Exception {
        BufferedInputStream in = new BufferedInputStream(stream);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) > 0) out.write(buffer, 0, read);
        in.close();
        return out.toString("UTF-8");
    }

    private static Bitmap fetchBitmap(String url) {
        Bitmap cached = CACHE.get(url);
        if (cached != null) return cached;
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(TIMEOUT);
            connection.setReadTimeout(TIMEOUT);
            connection.setInstanceFollowRedirects(true);
            InputStream in = connection.getInputStream();
            Bitmap bitmap = BitmapFactory.decodeStream(new BufferedInputStream(in));
            in.close();
            connection.disconnect();
            if (bitmap != null) CACHE.put(url, bitmap);
            return bitmap;
        } catch (Exception ignored) {
            return null;
        }
    }

    /** Loads a poster into a view, cancelling stale loads via the view tag. */
    public static void image(final ImageView view, final String url) {
        if (view == null) return;
        if (url == null || url.isEmpty()) {
            view.setImageDrawable(null);
            return;
        }
        view.setTag(url);
        Bitmap cached = CACHE.get(url);
        if (cached != null) {
            view.setImageBitmap(cached);
            return;
        }
        view.setImageDrawable(null);
        new Thread(new Runnable() {
            @Override
            public void run() {
                final Bitmap bitmap = fetchBitmap(url);
                MAIN.post(new Runnable() {
                    @Override
                    public void run() {
                        if (bitmap != null && url.equals(view.getTag())) {
                            view.setImageBitmap(bitmap);
                        }
                    }
                });
            }
        }, "ot-image").start();
    }
}
