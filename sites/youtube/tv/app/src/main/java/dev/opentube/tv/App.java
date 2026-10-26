package dev.opentube.tv;

import android.app.Application;
import android.content.Context;

/**
 * Process-wide singletons. The app is deliberately tiny: a catalogue loaded from
 * assets, a preference store, the on-device taste model, the watch history and
 * the optional Google account.
 */
public final class App extends Application {

    private static App instance;

    public Catalog catalog;
    public Prefs prefs;
    public Taste taste;
    public History history;
    public Account account;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        prefs = new Prefs(this);
        catalog = Catalog.load(this);
        history = new History(prefs, catalog);
        account = new Account(prefs);
        account.attach(this);
        taste = new Taste(prefs, catalog);
        taste.useAccount(account.accountKey());
        history.useAccount(account.accountKey());
    }

    public static App get(Context context) {
        if (instance == null) {
            instance = (App) context.getApplicationContext();
        }
        return instance;
    }

    /** Re-binds the per-account state after a sign-in or sign-out. */
    public void onAccountChanged() {
        String key = account.accountKey();
        taste.useAccount(key);
        history.useAccount(key);
    }
}
