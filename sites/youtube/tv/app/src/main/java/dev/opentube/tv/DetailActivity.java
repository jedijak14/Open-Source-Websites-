package dev.opentube.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/** Video, channel and movie details with the TV-sized action row. */
public class DetailActivity extends Activity {

    private App app;
    private Catalog catalog;
    private Catalog.Video video;
    private Catalog.Movie movie;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        app = App.get(this);
        catalog = app.catalog;

        String id = getIntent().getStringExtra("id");
        String movieId = getIntent().getStringExtra("movieId");

        if (movieId != null) {
            movie = catalog.movie(movieId);
        } else if (id != null) {
            video = catalog.video(id);
            if (video == null) video = fromIntent(id);
        }

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Ui.BG);
        LinearLayout body = Ui.column(this);
        scroll.addView(body, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        if (movie != null) {
            buildMovie(body);
        } else if (video != null) {
            buildVideo(body);
        } else {
            body.addView(Ui.body(this, "That item is no longer available."));
        }
        setContentView(scroll);

        if (movie != null && !movie.freeWithAds) {
            // The exact wording the catalogue promises for locked titles.
            showLocked();
        }
    }

    private Catalog.Video fromIntent(String id) {
        Catalog.Video live = new Catalog.Video();
        live.id = id;
        live.youtubeId = getIntent().getStringExtra("videoId") == null ? "" : getIntent().getStringExtra("videoId");
        live.title = getIntent().getStringExtra("title") == null ? "Video" : getIntent().getStringExtra("title");
        live.channelName = getIntent().getStringExtra("channelName") == null ? "" : getIntent().getStringExtra("channelName");
        live.poster = getIntent().getStringExtra("poster") == null ? "" : getIntent().getStringExtra("poster");
        live.desc = getIntent().getStringExtra("desc") == null ? "" : getIntent().getStringExtra("desc");
        live.durationLabel = getIntent().getStringExtra("duration") == null ? "" : getIntent().getStringExtra("duration");
        live.live = getIntent().getBooleanExtra("live", false);
        if (!live.live && live.youtubeId.isEmpty() && !live.poster.startsWith("http")) return null;
        return live;
    }

    private void buildVideo(LinearLayout body) {
        addBackdrop(body, video.live ? video.poster : catalog.url(video.poster), 300);

        LinearLayout content = Ui.column(this);
        int pad = Ui.dp(this, 48);
        content.setPadding(pad, Ui.dp(this, 18), pad, Ui.dp(this, 44));
        body.addView(content);

        TextView title = Ui.text(this, video.title, 30, Ui.TEXT, true);
        content.addView(title);

        String meta = video.channelName;
        if (video.durationLabel != null && !video.durationLabel.isEmpty()) meta += " · " + video.durationLabel;
        if (video.views > 0) meta += " · " + Ui.views(video.views);
        if (video.category != null && !video.category.isEmpty()) meta += " · " + video.category;
        TextView metaView = Ui.body(this, meta);
        metaView.setPadding(0, Ui.dp(this, 8), 0, 0);
        content.addView(metaView);

        LinearLayout actions = Ui.row(this);
        actions.setPadding(0, Ui.dp(this, 20), 0, Ui.dp(this, 10));
        int resume = video.hasLocalClip() ? app.history.resumePosition(video.id) : 0;

        String playLabel = resume > 0 ? "▶  Resume " + Ui.clock(resume / 1000) : "▶  Play";
        TextView play = Ui.button(this, playLabel, true, new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                startPlayback(0);
            }
        });
        actions.addView(play);

        if (resume > 0) {
            TextView restart = Ui.button(this, "Start over", false, new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    startPlayback(-1);
                }
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            params.leftMargin = Ui.dp(this, 14);
            actions.addView(restart, params);
        }

        if (!video.live && !video.channel.isEmpty()) {
            TextView channel = Ui.button(this, "Channel", false, new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    startActivity(new android.content.Intent(DetailActivity.this, ChannelActivity.class)
                            .putExtra("channelId", video.channel)
                            .putExtra("title", video.channelName));
                }
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            params.leftMargin = Ui.dp(this, 14);
            actions.addView(channel, params);
        }
        content.addView(actions);

        if (video.desc != null && !video.desc.isEmpty()) {
            TextView desc = Ui.body(this, video.desc);
            desc.setPadding(0, Ui.dp(this, 14), 0, 0);
            content.addView(desc);
        }

        if (video.live) {
            TextView note = Ui.body(this,
                    "This plays through YouTube's own player, so YouTube's ads appear here. "
                            + "That is the one place OpenTube cannot strip them.");
            note.setPadding(0, Ui.dp(this, 18), 0, 0);
            content.addView(note);
        }

        if (!video.chapters.isEmpty()) {
            content.addView(Ui.sectionTitle(this, "Chapters"));
            for (final int[] chapter : video.chapters) {
                View row = Ui.settingsRow(this, Ui.clock(chapter[0]), "Jump to this moment",
                        new View.OnClickListener() {
                            @Override
                            public void onClick(View view) {
                                startPlayback(chapter[0]);
                            }
                        });
                content.addView(row);
            }
        }

        if (!video.channel.isEmpty() && !video.live) {
            List<Catalog.Video> more = catalog.byChannel(video.channel);
            List<View> cards = new ArrayList<>();
            for (final Catalog.Video other : more) {
                if (other.id.equals(video.id)) continue;
                cards.add(HomeScreen.videoCard(this, other, new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        startActivity(new android.content.Intent(DetailActivity.this, DetailActivity.class)
                                .putExtra("id", other.id));
                    }
                }));
            }
            if (!cards.isEmpty()) content.addView(Ui.cardRow(this, "More from " + video.channelName, cards));
        }

        play.requestFocus();
    }

    private void buildMovie(LinearLayout body) {
        addBackdrop(body, catalog.url(movie.poster), 340);

        LinearLayout content = Ui.column(this);
        int pad = Ui.dp(this, 48);
        content.setPadding(pad, Ui.dp(this, 18), pad, Ui.dp(this, 44));
        body.addView(content);

        content.addView(Ui.text(this, movie.title, 30, Ui.TEXT, true));
        TextView meta = Ui.body(this, movie.year + " · " + movie.runtime + " · " + movie.rating
                + " · " + movie.channelName);
        meta.setPadding(0, Ui.dp(this, 8), 0, 0);
        content.addView(meta);

        LinearLayout actions = Ui.row(this);
        actions.setPadding(0, Ui.dp(this, 20), 0, Ui.dp(this, 10));
        String label = movie.freeWithAds ? "▶  Watch free" : "▶  Watch";
        TextView play = Ui.button(this, label, true, new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (movie.freeWithAds) {
                    PlayerActivity.playClip(DetailActivity.this, movie.title, movie.channelName, movie.clip, 0);
                } else {
                    showLocked();
                }
            }
        });
        actions.addView(play);
        content.addView(actions);

        TextView desc = Ui.body(this, movie.desc);
        desc.setPadding(0, Ui.dp(this, 16), 0, 0);
        content.addView(desc);

        TextView note = Ui.body(this, movie.freeWithAds
                ? "Free with ads — OpenTube plays the film with every ad stripped."
                : "Movies are tied to your Google Account, so playback is handled by Google Play. "
                + "OpenTube can show you the title, but it cannot rent it for you.");
        note.setPadding(0, Ui.dp(this, 16), 0, 0);
        content.addView(note);

        play.requestFocus();
    }

    private void addBackdrop(LinearLayout body, String posterUrl, int heightDp) {
        FrameLayout frame = new FrameLayout(this);
        ImageView image = new ImageView(this);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        Net.image(image, posterUrl);
        frame.addView(image, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        View scrim = new View(this);
        scrim.setBackground(new android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.BOTTOM_TOP,
                new int[]{0xFF0A1118, 0x220A1118}));
        frame.addView(scrim, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        body.addView(frame, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, heightDp)));
    }

    private void startPlayback(int startAt) {
        if (video.live) {
            android.content.Intent intent = new android.content.Intent(this, WebPlayerActivity.class);
            intent.putExtra("videoId", video.youtubeId);
            intent.putExtra("title", video.title);
            intent.putExtra("channelName", video.channelName);
            startActivity(intent);
            return;
        }
        if (!video.hasLocalClip()) {
            new AlertDialog.Builder(this)
                    .setTitle("No clip attached")
                    .setMessage("This title has no playable file in the bundled catalogue.")
                    .setPositiveButton("OK", null)
                    .show();
            return;
        }
        List<Catalog.Video> queue = video.channel.isEmpty()
                ? new ArrayList<Catalog.Video>() : catalog.byChannel(video.channel);
        String[] ids = new String[queue.size()];
        for (int i = 0; i < queue.size(); i++) ids[i] = queue.get(i).id;
        // -1 keeps whatever resume point the history has, 0 starts over.
        int start = startAt < 0 ? 0 : (startAt > 0 ? startAt : -1);
        PlayerActivity.play(this, video, ids, start);
    }

    private void showLocked() {
        new AlertDialog.Builder(this)
                .setTitle(movie == null ? "Movie" : movie.title)
                .setMessage(getString(R.string.movie_locked))
                .setPositiveButton("OK", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        // Stay on the details page; nothing else to do.
                    }
                })
                .show();
    }
}
