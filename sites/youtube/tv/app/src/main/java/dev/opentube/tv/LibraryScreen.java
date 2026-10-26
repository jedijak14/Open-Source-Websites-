package dev.opentube.tv;

import android.app.AlertDialog;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Library: watch history from this TV, the signed-in account's subscriptions and
 * liked videos, and what the taste model currently believes. Subscriptions are
 * deliberately read-only — subscribing happens in the YouTube app, and the rows
 * refresh here afterwards.
 */
final class LibraryScreen {

    private LibraryScreen() {
    }

    static View build(final MainActivity activity) {
        final App app = App.get(activity);
        final Catalog catalog = app.catalog;
        final Account.Sync sync = app.account.sync();

        LinearLayout body = Ui.page(activity);
        body.addView(Ui.text(activity, "Library", 34, Ui.TEXT, true));

        String who = app.account.signedIn()
                ? (sync.channel.title.isEmpty() ? "Connected to Google" : sync.channel.title)
                : "Not connected — watch history is kept on this TV";
        TextView subtitle = Ui.body(activity, who);
        subtitle.setPadding(0, Ui.dp(activity, 6), 0, 0);
        body.addView(subtitle);

        // History
        List<History.Entry> recent = app.history.recent(24);
        List<View> history = new ArrayList<>();
        for (final History.Entry entry : recent) {
            String meta = entry.channelName + " · " + Ui.clock(entry.position)
                    + (entry.duration > 0 ? " of " + Ui.clock(entry.duration) : "");
            View card = Ui.card(activity, entry.poster.startsWith("http") ? entry.poster : catalog.url(entry.poster),
                    entry.title, meta, "Watched", 236, 133);
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    Catalog.Video video = catalog.video(entry.id);
                    if (video == null) {
                        video = new Catalog.Video();
                        video.id = entry.id;
                        video.youtubeId = entry.videoId;
                        video.title = entry.title;
                        video.channelName = entry.channelName;
                        video.poster = entry.poster;
                        video.live = entry.live;
                    }
                    activity.openDetail(video);
                }
            });
            history.add(card);
        }
        body.addView(Ui.cardRow(activity, "Watch history", history));
        if (history.isEmpty()) {
            body.addView(Ui.body(activity, "Nothing watched yet. Anything you play is remembered here, per account."));
        }

        // Subscriptions
        if (app.account.signedIn()) {
            List<View> subs = new ArrayList<>();
            for (final Api.Sub sub : sync.subs) {
                View card = Ui.card(activity, sub.avatar, sub.title, "Subscription", null, 164, 164);
                card.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        activity.openChannel(sub.channelId, sub.title, sub.avatar);
                    }
                });
                subs.add(card);
            }
            body.addView(Ui.cardRow(activity, "Subscriptions (" + sync.subs.size() + ")", subs));
            if (sync.subs.isEmpty()) {
                body.addView(Ui.body(activity, "No subscriptions came back from Google yet. Pull them in from Settings → Sync now."));
            }
            TextView note = Ui.body(activity, activity.getString(R.string.subs_readonly));
            note.setPadding(0, Ui.dp(activity, 8), 0, 0);
            body.addView(note);

            List<View> liked = new ArrayList<>();
            for (Catalog.Video video : sync.liked) {
                View card = Ui.card(activity, video.poster, video.title,
                        video.channelName + (video.durationLabel.isEmpty() ? "" : " · " + video.durationLabel),
                        null, 236, 133);
                final Catalog.Video target = video;
                card.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        activity.openDetail(target);
                    }
                });
                liked.add(card);
            }
            if (!liked.isEmpty()) body.addView(Ui.cardRow(activity, "Liked videos", liked));
        } else {
            body.addView(Ui.cardRow(activity, "Subscriptions", new ArrayList<View>()));
            TextView hint = Ui.body(activity,
                    "Connect your Google account in Settings to bring in subscriptions and liked videos. "
                            + "Sign-in happens on your phone or computer — a short code is all the TV shows.");
            hint.setPadding(0, Ui.dp(activity, 6), 0, 0);
            body.addView(hint);
        }

        // Taste model
        LinearLayout taste = Ui.column(activity);
        taste.setBackground(Ui.rounded(activity, Ui.SURFACE, 12));
        taste.setPadding(Ui.dp(activity, 20), Ui.dp(activity, 18), Ui.dp(activity, 20), Ui.dp(activity, 18));
        taste.addView(Ui.text(activity, "What OpenTube has learned", 16, Ui.TEXT, true));
        TextView summary = Ui.body(activity, app.taste.summary());
        summary.setPadding(0, Ui.dp(activity, 6), 0, 0);
        taste.addView(summary);

        StringBuilder top = new StringBuilder();
        for (java.util.Map.Entry<String, Taste.Entry> entry : app.taste.topChannels(4)) {
            Catalog.Channel channel = catalog.channel(entry.getKey());
            String name = channel == null ? entry.getKey() : channel.name;
            if (top.length() > 0) top.append("  ·  ");
            top.append(name);
        }
        if (top.length() > 0) {
            TextView channels = Ui.body(activity, top.toString());
            channels.setPadding(0, Ui.dp(activity, 8), 0, 0);
            taste.addView(channels);
        }
        LinearLayout.LayoutParams tasteParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tasteParams.topMargin = Ui.dp(activity, 26);
        body.addView(taste, tasteParams);

        return Ui.scroller(body);
    }

    static void resetTaste(final MainActivity activity) {
        new AlertDialog.Builder(activity)
                .setTitle("Reset recommendations?")
                .setMessage("This forgets everything learned on this account. Watch history stays.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Reset", new android.content.DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(android.content.DialogInterface dialog, int which) {
                        App.get(activity).taste.reset();
                        activity.show(MainActivity.HOME);
                    }
                })
                .show();
    }
}
