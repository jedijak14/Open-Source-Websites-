package dev.opentube.tv;

import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/** Home: continue watching, the learned "For you" row, movies and categories. */
final class HomeScreen {

    private HomeScreen() {
    }

    static View build(final MainActivity activity) {
        final App app = App.get(activity);
        final Catalog catalog = app.catalog;

        LinearLayout body = Ui.page(activity);

        TextView title = Ui.text(activity, app.taste.hasSignals() ? "For you" : "OpenTube", 34, Ui.TEXT, true);
        body.addView(title);

        String reason = app.taste.hasSignals()
                ? app.taste.reason(app.taste.rank(catalog.videos()).get(0))
                : "Original channels, no ads, no tracking.";
        TextView subtitle = Ui.body(activity, reason);
        subtitle.setPadding(0, Ui.dp(activity, 6), 0, 0);
        body.addView(subtitle);

        // Continue watching
        List<View> resume = new ArrayList<>();
        for (History.Entry entry : app.history.recent(8)) {
            Catalog.Video video = catalog.video(entry.id);
            if (video == null) {
                video = synthetic(entry);
            }
            final Catalog.Video target = video;
            View card = Ui.card(activity, catalog.url(entry.poster), entry.title,
                    entry.channelName, "Resume", 236, 133);
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    activity.openDetail(target);
                }
            });
            resume.add(card);
        }
        if (!resume.isEmpty()) body.addView(Ui.cardRow(activity, "Continue watching", resume));

        // Learned recommendations
        List<View> recommended = new ArrayList<>();
        for (Catalog.Video video : app.taste.rank(catalog.videos())) {
            recommended.add(videoCard(activity, video));
        }
        body.addView(Ui.cardRow(activity, "Recommended for you", recommended));

        // Movies
        List<View> movieCards = new ArrayList<>();
        for (final Catalog.Movie movie : catalog.movies()) {
            View card = Ui.card(activity, catalog.url(movie.poster), movie.title,
                    movie.year + " · " + movie.runtime + " · " + movie.rating,
                    movie.freeWithAds ? "Free with ads" : movie.price, 220, 300);
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    activity.openMovie(movie);
                }
            });
            movieCards.add(card);
        }
        body.addView(Ui.cardRow(activity, "Movies", movieCards));

        // Subscriptions, when an account is connected
        if (app.account.signedIn()) {
            Account.Sync sync = app.account.sync();
            if (!sync.subs.isEmpty()) {
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
                body.addView(Ui.cardRow(activity, "Your subscriptions", subs));
            }
        }

        // Category shelves
        for (String category : catalog.categories()) {
            if ("All".equals(category)) continue;
            List<Catalog.Video> videos = catalog.byCategory(category);
            if (videos.isEmpty()) continue;
            List<View> cards = new ArrayList<>();
            for (Catalog.Video video : videos) cards.add(videoCard(activity, video));
            body.addView(Ui.cardRow(activity, category, cards));
        }

        // Channels
        List<View> channels = new ArrayList<>();
        for (final Catalog.Channel channel : catalog.channels().values()) {
            View card = Ui.card(activity, catalog.url(channel.avatar), channel.name,
                    Ui.views(channel.subscribers).replace("views", "subscribers"), null, 164, 164);
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    activity.openChannel(channel.slug, channel.name, catalog.url(channel.avatar));
                }
            });
            channels.add(card);
        }
        body.addView(Ui.cardRow(activity, "Channels", channels));

        return Ui.scroller(body);
    }

    static View videoCard(final MainActivity activity, final Catalog.Video video) {
        return videoCard(activity, video, new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                activity.openDetail(video);
            }
        });
    }

    /** The same card for screens that are not the main shell. */
    static View videoCard(final android.app.Activity activity, final Catalog.Video video,
                          View.OnClickListener click) {
        String meta = (video.durationLabel == null || video.durationLabel.isEmpty() ? "" : video.durationLabel + " · ")
                + Ui.views(video.views) + " · " + video.channelName;
        String posterUrl = video.live ? video.poster : App.get(activity).catalog.url(video.poster);
        View card = Ui.card(activity, posterUrl, video.title, meta,
                video.live ? "YouTube" : "OpenTube", 236, 133);
        card.setOnClickListener(click);
        return card;
    }

    private static Catalog.Video synthetic(History.Entry entry) {
        Catalog.Video video = new Catalog.Video();
        video.id = entry.id;
        video.youtubeId = entry.videoId;
        video.title = entry.title;
        video.channelName = entry.channelName;
        video.poster = entry.poster;
        video.live = entry.live;
        video.channel = entry.channelName;
        return video;
    }
}
