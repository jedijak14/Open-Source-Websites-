package dev.opentube.tv;

import android.app.AlertDialog;
import android.content.DialogInterface;
import android.text.InputType;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Settings: API key, Google sign-in, captions and the taste model. */
final class SettingsScreen {

    private SettingsScreen() {
    }

    static View build(final MainActivity activity) {
        final App app = App.get(activity);
        final Prefs prefs = app.prefs;

        LinearLayout body = Ui.page(activity);
        body.addView(Ui.text(activity, "Settings", 34, Ui.TEXT, true));
        body.addView(Ui.body(activity, "Everything stays on this device. There is no OpenTube account."));

        body.addView(Ui.sectionTitle(activity, "Google account"));

        String accountLine;
        if (app.account.signedIn()) {
            Account.Sync sync = app.account.sync();
            accountLine = sync.channel.title.isEmpty() ? "Connected" : "Connected as " + sync.channel.title;
        } else {
            accountLine = "Not connected";
        }
        body.addView(Ui.settingsRow(activity, accountLine, "Subscriptions, liked videos and profile come from here",
                new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        startSignIn(activity);
                    }
                }));

        if (app.account.signedIn()) {
            body.addView(Ui.settingsRow(activity, "Sync now",
                    lastSync(app), new View.OnClickListener() {
                        @Override
                        public void onClick(View view) {
                            syncNow(activity);
                        }
                    }));
            body.addView(Ui.settingsRow(activity, "Sign out", "Removes the token from this TV",
                    new View.OnClickListener() {
                        @Override
                        public void onClick(View view) {
                            app.account.signOut();
                            app.onAccountChanged();
                            activity.show(MainActivity.SETTINGS);
                        }
                    }));
        }

        body.addView(Ui.settingsRow(activity, "OAuth client ID",
                shorten(prefs.clientId(), "not set"), new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        edit(activity, "OAuth client ID", prefs.clientId(), new ValueSink() {
                            @Override
                            public void accept(String value) {
                                prefs.setClient(value, prefs.clientSecret());
                                activity.show(MainActivity.SETTINGS);
                            }
                        });
                    }
                }));

        body.addView(Ui.settingsRow(activity, "OAuth client secret",
                prefs.clientSecret().isEmpty() ? "not set" : "saved", new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        edit(activity, "OAuth client secret", "", new ValueSink() {
                            @Override
                            public void accept(String value) {
                                prefs.setClient(prefs.clientId(), value);
                                activity.show(MainActivity.SETTINGS);
                            }
                        });
                    }
                }));

        body.addView(Ui.body(activity,
                "Sign-in uses Google's TV flow: a short code appears on screen and you finish on your phone at "
                        + "google.com/device. The app needs a “TVs and Limited Input devices” OAuth client from "
                        + "Google Cloud Console; create one and paste it above, or bake it in at build time."));

        body.addView(Ui.sectionTitle(activity, "YouTube data"));
        body.addView(Ui.settingsRow(activity, "API key",
                prefs.apiKey().isEmpty() ? "not set — search falls back to the bundled catalogue"
                        : shorten(prefs.apiKey(), "saved"), new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        edit(activity, "YouTube API key", prefs.apiKey(), new ValueSink() {
                            @Override
                            public void accept(String value) {
                                prefs.setApiKey(value);
                                activity.show(MainActivity.SETTINGS);
                            }
                        });
                    }
                }));
        body.addView(Ui.settingsRow(activity, "Content server", prefs.baseUrl(),
                new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        edit(activity, "Content server", prefs.baseUrl(), new ValueSink() {
                            @Override
                            public void accept(String value) {
                                prefs.setBaseUrl(value);
                                activity.show(MainActivity.SETTINGS);
                            }
                        });
                    }
                }));

        body.addView(Ui.sectionTitle(activity, "Playback"));
        body.addView(Ui.settingsRow(activity, "Captions",
                prefs.captionsOn() ? "On when available" : "Off", new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        prefs.setCaptionsOn(!prefs.captionsOn());
                        activity.show(MainActivity.SETTINGS);
                    }
                }));

        body.addView(Ui.sectionTitle(activity, "Recommendations"));
        body.addView(Ui.settingsRow(activity, "What OpenTube has learned", app.taste.summary(),
                new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        LibraryScreen.resetTaste(activity);
                    }
                }));

        body.addView(Ui.sectionTitle(activity, "About"));
        TextView about = Ui.body(activity,
                "OpenTube " + BuildConfig.VERSION_NAME + " · MIT licensed\n"
                        + "Original channels and clips. No advertising, no trackers, no accounts to create.\n"
                        + "Playback streams the OpenTube catalogue from " + prefs.baseUrl() + ".");
        body.addView(about);

        return Ui.scroller(body);
    }

    private static String lastSync(App app) {
        long at = app.account.sync().at;
        if (at == 0) return "never";
        long minutes = (System.currentTimeMillis() - at) / 60000L;
        if (minutes < 1) return "just now";
        if (minutes < 60) return minutes + " min ago";
        return (minutes / 60) + " h ago";
    }

    private static String shorten(String value, String fallback) {
        if (value == null || value.isEmpty()) return fallback;
        if (value.length() <= 22) return value;
        return value.substring(0, 12) + "…" + value.substring(value.length() - 6);
    }

    private interface ValueSink {
        void accept(String value);
    }

    private static void edit(final MainActivity activity, String title, String current, final ValueSink sink) {
        final EditText input = new EditText(activity);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT);
        input.setText(current == null ? "" : current);
        input.setTextColor(Ui.TEXT);
        input.setHintTextColor(0xFF64748B);
        input.setPadding(Ui.dp(activity, 16), Ui.dp(activity, 12), Ui.dp(activity, 16), Ui.dp(activity, 12));

        new AlertDialog.Builder(activity)
                .setTitle(title)
                .setView(input)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Save", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        sink.accept(input.getText().toString().trim());
                    }
                })
                .show();
    }

    private static void startSignIn(final MainActivity activity) {
        final App app = App.get(activity);
        if (app.account.signedIn()) {
            syncNow(activity);
            return;
        }
        if (!app.prefs.canSignIn()) {
            new AlertDialog.Builder(activity)
                    .setTitle("OAuth client needed")
                    .setMessage("Add a TV OAuth client ID and secret in Settings first. "
                            + "Google Cloud Console → Credentials → OAuth client → “TVs and Limited Input devices”.")
                    .setPositiveButton("OK", null)
                    .show();
            return;
        }

        final TextView message = new TextView(activity);
        message.setTextColor(Ui.TEXT);
        int pad = Ui.dp(activity, 24);
        message.setPadding(pad, pad, pad, pad);
        message.setTextSize(18);

        final AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle("Connect Google")
                .setView(message)
                .setNegativeButton("Cancel", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        app.account.cancelAuth();
                    }
                })
                .create();
        dialog.show();

        message.setText("Asking Google for a code…");
        app.account.beginDeviceAuth(new Account.DeviceListener() {
            @Override
            public void onCode(final String userCode, final String url) {
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        message.setText("On your phone or computer, open\n\n" + url + "\n\nand enter\n\n"
                                + userCode + "\n\nThis screen updates by itself when you are done.");
                    }
                });
            }

            @Override
            public void onResult(final boolean ok, final String detail) {
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        dialog.dismiss();
                        if (ok) {
                            syncNow(activity);
                        } else {
                            new AlertDialog.Builder(activity)
                                    .setTitle("Not signed in")
                                    .setMessage(detail)
                                    .setPositiveButton("OK", null)
                                    .show();
                        }
                    }
                });
            }
        });
    }

    private static void syncNow(final MainActivity activity) {
        final App app = App.get(activity);
        final AlertDialog progress = new AlertDialog.Builder(activity)
                .setTitle("Syncing your account")
                .setMessage("Fetching profile, subscriptions and liked videos…")
                .setCancelable(false)
                .create();
        progress.show();
        app.account.refresh(new Runnable() {
            @Override
            public void run() {
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        progress.dismiss();
                        activity.show(MainActivity.SETTINGS);
                    }
                });
            }
        }, new Account.Callback<Account.Sync>() {
            @Override
            public void onResult(Account.Sync value, final String problem) {
                if (problem == null) return;
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        new AlertDialog.Builder(activity)
                                .setTitle("Sync finished with a problem")
                                .setMessage(problem)
                                .setPositiveButton("OK", null)
                                .show();
                    }
                });
            }
        });
    }
}
