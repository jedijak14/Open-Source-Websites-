package dev.opentube.tv;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/** A channel page: artwork, about text and its videos. */
public class ChannelActivity extends Activity {

    private App app;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        app = App.get(this);

        final String channelId = getIntent().getStringExtra("channelId") == null
                ? "" : getIntent().getStringExtra("channelId");
        String title = getIntent().getStringExtra("title") == null
                ? "Channel" : getIntent().getStringExtra("title");
        String avatar = getIntent().getStringExtra("avatar");

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Ui.BG);
        final LinearLayout body = Ui.column(this);
        scroll.addView(body, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);

        LinearLayout header = Ui.row(this);
        header.setPadding(Ui.dp(this, 48), Ui.dp(this, 40), Ui.dp(this, 48), Ui.dp(this, 10));

        ImageView badge = new ImageView(this);
        badge.setScaleType(ImageView.ScaleType.CENTER_CROP);
        Net.image(badge, avatar == null ? "" : avatar);
        badge.setBackground(Ui.rounded(this, Ui.SURFACE, 60));
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(Ui.dp(this, 96), Ui.dp(this, 96));
        header.addView(badge, badgeParams);

        LinearLayout text = Ui.column(this);
        text.setPadding(Ui.dp(this, 22), 0, 0, 0);
        text.addView(Ui.text(this, title, 30, Ui.TEXT, true));
        Catalog.Channel local = app.catalog.channel(channelId);
        String about = local == null ? "Synced from your subscriptions"
                : local.about;
        TextView aboutView = Ui.body(this, about);
        aboutView.setPadding(0, Ui.dp(this, 8), 0, 0);
        text.addView(aboutView);
        header.addView(text);
        body.addView(header);

        final LinearLayout results = Ui.column(this);
        results.setPadding(Ui.dp(this, 48), Ui.dp(this, 10), Ui.dp(this, 48), Ui.dp(this, 40));
        body.addView(results);

        if (local != null) {
            List<Catalog.Video> videos = app.catalog.byChannel(channelId);
            results.addView(Ui.cardRow(this, "Videos", cards(videos)));
            if (videos.isEmpty()) results.addView(Ui.body(this, "No videos in the bundled catalogue yet."));
        } else {
            TextView loading = Ui.body(this, "Loading videos from YouTube…");
            results.addView(loading);
            loadUploads(channelId, results, loading);
        }

        View focus = SearchScreen.firstFocusable(results);
        if (focus != null) focus.requestFocus();
    }

    private void loadUploads(final String channelId, final LinearLayout results, final TextView loading) {
        if (channelId.isEmpty()) {
            loading.setText("This channel has no id, so its uploads cannot be listed.");
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                List<Catalog.Video> videos = new ArrayList<>();
                String problem = null;
                try {
                    videos = new Api(app.prefs).channelUploads(channelId, 25);
                } catch (Api.Failure failure) {
                    problem = failure.quota
                            ? "YouTube is limiting requests right now. Try again in a little while."
                            : "This channel's videos could not be loaded.";
                }
                final List<Catalog.Video> loaded = videos;
                final String note = problem;
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        loading.setVisibility(View.GONE);
                        if (note != null) {
                            results.addView(Ui.body(ChannelActivity.this, note));
                        }
                        if (!loaded.isEmpty()) {
                            results.addView(Ui.cardRow(ChannelActivity.this, "Uploads", cards(loaded)));
                            View focus = SearchScreen.firstFocusable(results);
                            if (focus != null) focus.requestFocus();
                        }
                    }
                });
            }
        }, "ot-channel").start();
    }

    private List<View> cards(List<Catalog.Video> videos) {
        List<View> cards = new ArrayList<>();
        for (Catalog.Video video : videos) {
            View card = Ui.card(this, video.live ? video.poster : app.catalog.url(video.poster),
                    video.title, video.durationLabel + " · " + video.channelName,
                    video.live ? "YouTube" : "OpenTube", 236, 133);
            final Catalog.Video target = video;
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    android.content.Intent intent = new android.content.Intent(ChannelActivity.this, DetailActivity.class);
                    intent.putExtra("id", target.id);
                    startActivity(intent);
                }
            });
            cards.add(card);
        }
        return cards;
    }
}
