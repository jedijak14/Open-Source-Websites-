package dev.opentube.tv;

import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Music gets its own layout rather than a reused video grid: large square
 * artwork, an album-style shelf, and a one-press "Play all" that queues the
 * whole category so playback continues while the screen is off.
 */
final class MusicScreen {

    private MusicScreen() {
    }

    static View build(final MainActivity activity) {
        App app = App.get(activity);
        final Catalog catalog = app.catalog;
        final List<Catalog.Video> music = catalog.byCategory("Music");

        LinearLayout body = Ui.page(activity);

        LinearLayout header = Ui.row(activity);
        LinearLayout heading = Ui.column(activity);
        heading.addView(Ui.text(activity, "Music", 34, Ui.TEXT, true));
        TextView subtitle = Ui.body(activity, music.size() + " tracks from the OpenTube catalogue · no ads, ever");
        subtitle.setPadding(0, Ui.dp(activity, 6), 0, 0);
        heading.addView(subtitle);
        header.addView(heading, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView playAll = Ui.button(activity, "▶  Play all", true, new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (!music.isEmpty()) {
                    String[] ids = new String[music.size()];
                    for (int i = 0; i < music.size(); i++) ids[i] = music.get(i).id;
                    PlayerActivity.play(activity, music.get(0), ids);
                }
            }
        });
        header.addView(playAll);
        body.addView(header);

        // Album shelf: the first track of each channel becomes the "album".
        List<View> albums = new ArrayList<>();
        for (final Catalog.Channel channel : catalog.channels().values()) {
            List<Catalog.Video> tracks = new ArrayList<>();
            for (Catalog.Video video : music) {
                if (channel.slug.equals(video.channel)) tracks.add(video);
            }
            if (tracks.isEmpty()) continue;
            final Catalog.Video lead = tracks.get(0);
            View card = Ui.card(activity, catalog.url(lead.poster), channel.name,
                    tracks.size() + (tracks.size() == 1 ? " track" : " tracks") + " · " + lead.category,
                    "Album", 300, 300);
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    activity.openChannel(channel.slug, channel.name, catalog.url(channel.avatar));
                }
            });
            albums.add(card);
        }
        body.addView(Ui.cardRow(activity, "Albums", albums));

        List<View> tracks = new ArrayList<>();
        for (final Catalog.Video video : music) {
            View card = Ui.card(activity, catalog.url(video.poster), video.title,
                    video.channelName + " · " + video.durationLabel, "Track", 260, 160);
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    String[] ids = new String[music.size()];
                    for (int i = 0; i < music.size(); i++) ids[i] = music.get(i).id;
                    PlayerActivity.play(activity, video, ids);
                }
            });
            tracks.add(card);
        }
        body.addView(Ui.cardRow(activity, "Tracks", tracks));

        LinearLayout note = Ui.column(activity);
        note.setBackground(Ui.rounded(activity, Ui.SURFACE, 12));
        note.setPadding(Ui.dp(activity, 20), Ui.dp(activity, 16), Ui.dp(activity, 20), Ui.dp(activity, 16));
        note.addView(Ui.text(activity, "Playback", 15, Ui.TEXT, true));
        TextView detail = Ui.body(activity,
                "Music plays through the same D-pad player: centre to pause, left and right to seek, "
                        + "down for captions. The queue keeps going when a track ends.");
        detail.setPadding(0, Ui.dp(activity, 6), 0, 0);
        note.addView(detail);
        LinearLayout.LayoutParams noteParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        noteParams.topMargin = Ui.dp(activity, 28);
        body.addView(note, noteParams);

        return Ui.scroller(body);
    }
}
