package dev.opentube.tv;

import android.content.Context;
import android.content.SharedPreferences;

/** Small typed wrapper over SharedPreferences. Nothing leaves the device. */
public final class Prefs {

    private final SharedPreferences sp;

    Prefs(Context context) {
        sp = context.getSharedPreferences("opentube-tv", Context.MODE_PRIVATE);
    }

    String get(String key, String fallback) {
        return sp.getString(key, fallback);
    }

    void put(String key, String value) {
        sp.edit().putString(key, value).apply();
    }

    boolean flag(String key, boolean fallback) {
        return sp.getBoolean(key, fallback);
    }

    void setFlag(String key, boolean value) {
        sp.edit().putBoolean(key, value).apply();
    }

    void remove(String key) {
        sp.edit().remove(key).apply();
    }

    /** API key: whatever is saved on the TV, else the one baked into the build. */
    public String apiKey() {
        String saved = get("api-key", "");
        if (saved != null && !saved.trim().isEmpty()) return saved.trim();
        return BuildConfig.API_KEY == null ? "" : BuildConfig.API_KEY.trim();
    }

    public void setApiKey(String key) {
        put("api-key", key == null ? "" : key.trim());
    }

    /** OAuth client for the TV "limited input" flow. */
    public String clientId() {
        String saved = get("client-id", "");
        if (saved != null && !saved.trim().isEmpty()) return saved.trim();
        return BuildConfig.CLIENT_ID == null ? "" : BuildConfig.CLIENT_ID.trim();
    }

    public String clientSecret() {
        String saved = get("client-secret", "");
        if (saved != null && !saved.trim().isEmpty()) return saved.trim();
        return BuildConfig.CLIENT_SECRET == null ? "" : BuildConfig.CLIENT_SECRET.trim();
    }

    public void setClient(String id, String secret) {
        put("client-id", id == null ? "" : id.trim());
        put("client-secret", secret == null ? "" : secret.trim());
    }

    public boolean canSignIn() {
        return !clientId().isEmpty() && !clientSecret().isEmpty();
    }

    public String baseUrl() {
        String saved = get("base-url", "");
        if (saved != null && !saved.trim().isEmpty()) {
            String url = saved.trim();
            return url.endsWith("/") ? url : url + "/";
        }
        return BuildConfig.SITE;
    }

    public void setBaseUrl(String url) {
        put("base-url", url == null ? "" : url.trim());
    }

    public boolean captionsOn() {
        return flag("captions", true);
    }

    public void setCaptionsOn(boolean on) {
        setFlag("captions", on);
    }

    public String token() {
        return get("token", "");
    }

    public void setToken(String json) {
        put("token", json == null ? "" : json);
    }

    public String accountKey() {
        String key = get("account-key", "");
        return key == null || key.isEmpty() ? null : key;
    }

    public void setAccountKey(String key) {
        if (key == null) remove("account-key");
        else put("account-key", key);
    }

    String scoped(String base) {
        String key = accountKey();
        return base + ':' + (key == null ? "guest" : key);
    }
}
