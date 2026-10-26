package dev.opentube.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.VideoView;

import java.util.ArrayList;
import java.util.List;

/**
 * The TV playback surface. A remote only has a handful of keys, so each one does
 * something useful and is spelled out on screen:
 *
 *   centre / play-pause  play or pause      left / right   seek 10 seconds
 *   down                 captions on/off    up             show the controls
 *   back                 leave
 *
 * Captions are rendered from the catalogue's own transcript lines, which keeps
 * them in sync with seeking and needs no sidecar files.
 */
public class PlayerActivity extends Activity {

    private static final int SEEK_STEP_MS = 10000;

    private VideoView videoView;
    private ProgressBar progress;
    private TextView clock;
    private TextView caption;
    private TextView titleView;
    private TextView hintView;
    private View topBar;
    private View bottomBar;
    private View scrimTop;
    private View scrimBottom;

    private App app;
    private Catalog.Video video;
    private List<Catalog.Caption> captions = new ArrayList<>();
    private String clipUrl = "";
    private String titleText = "";
    private String subtitleText = "";
    private String[] queue = new String[0];
    private int queueIndex = -1;
    private int startAt = -1;
    private int captionIndex = -1;
    private boolean captionsOn;
    private boolean prepared;
    private long watchedMs;
    private long lastTickAt;
    private int lastPosition;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            update();
            handler.postDelayed(this, 250);
        }
    };
    private final Runnable hideChrome = new Runnable() {
        @Override
        public void run() {
            if (videoView != null && videoView.isPlaying()) showChrome(false);
        }
    };

    public static void play(Activity activity, Catalog.Video video) {
        play(activity, video, new String[0], -1);
    }

    public static void play(Activity activity, Catalog.Video video, String[] queue) {
        play(activity, video, queue, -1);
    }

    public static void play(Activity activity, Catalog.Video video, String[] queue, int startSeconds) {
        Intent intent = new Intent(activity, PlayerActivity.class);
        intent.putExtra("id", video.id);
        intent.putExtra("queue", queue);
        intent.putExtra("startAt", startSeconds);
        activity.startActivity(intent);
    }

    public static void playClip(Activity activity, String title, String subtitle, String clip, int startSeconds) {
        Intent intent = new Intent(activity, PlayerActivity.class);
        intent.putExtra("clip", clip);
        intent.putExtra("title", title);
        intent.putExtra("subtitle", subtitle);
        intent.putExtra("startAt", startSeconds);
        activity.startActivity(intent);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        app = App.get(this);
        captionsOn = app.prefs.captionsOn();

        clipUrl = getIntent().getStringExtra("clip") == null ? "" : getIntent().getStringExtra("clip");
        titleText = getIntent().getStringExtra("title") == null ? "" : getIntent().getStringExtra("title");
        subtitleText = getIntent().getStringExtra("subtitle") == null ? "" : getIntent().getStringExtra("subtitle");
        queue = getIntent().getStringArrayExtra("queue") == null ? new String[0] : getIntent().getStringArrayExtra("queue");
        startAt = getIntent().getIntExtra("startAt", -1);
        String id = getIntent().getStringExtra("id");

        if (id != null) {
            video = app.catalog.video(id);
            if (video != null) {
                titleText = video.title;
                subtitleText = video.channelName;
                clipUrl = video.hasLocalClip() ? app.catalog.url(video.clip) : "";
                captions = video.captions;
            }
        }
        if (clipUrl != null && !clipUrl.isEmpty() && clipUrl.startsWith("assets/")) {
            clipUrl = app.catalog.url(clipUrl);
        }

        buildUi();
        if (queue.length > 0 && video != null) {
            for (int i = 0; i < queue.length; i++) {
                if (queue[i].equals(video.id)) queueIndex = i;
            }
        }
        start(clipUrl);
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);

        videoView = new VideoView(this);
        root.addView(videoView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        scrimTop = new View(this);
        scrimTop.setBackground(new android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.BOTTOM_TOP,
                new int[]{0x00000000, 0xCC000000}));
        root.addView(scrimTop, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 190), Gravity.TOP));

        scrimBottom = new View(this);
        scrimBottom.setBackground(new android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{0x00000000, 0xE6000000}));
        root.addView(scrimBottom, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 260), Gravity.BOTTOM));

        LinearLayout top = Ui.column(this);
        top.setPadding(Ui.dp(this, 52), Ui.dp(this, 34), Ui.dp(this, 52), 0);
        topBar = top;
        titleView = Ui.text(this, titleText, 22, Ui.TEXT, true);
        top.addView(titleView);
        TextView sub = Ui.text(this, subtitleText, 13, 0xFFCBD5E1, false);
        sub.setPadding(0, Ui.dp(this, 6), 0, 0);
        top.addView(sub);
        root.addView(topBar, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP));

        caption = Ui.text(this, "", 21, 0xFFFFFFFF, false);
        caption.setGravity(Gravity.CENTER);
        // Keep long caption lines inside the safe area on a 16:9 screen.
        caption.setMaxWidth(Ui.dp(this, 1180));
        caption.setBackground(Ui.rounded(this, 0xCC000000, 6));
        caption.setPadding(Ui.dp(this, 18), Ui.dp(this, 10), Ui.dp(this, 18), Ui.dp(this, 10));
        caption.setVisibility(View.GONE);
        FrameLayout.LayoutParams captionParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        captionParams.bottomMargin = Ui.dp(this, 150);
        root.addView(caption, captionParams);

        LinearLayout bottom = Ui.column(this);
        bottom.setPadding(Ui.dp(this, 52), 0, Ui.dp(this, 52), Ui.dp(this, 40));
        bottomBar = bottom;
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(1000);
        bottom.addView(progress, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 4)));

        LinearLayout meta = Ui.row(this);
        meta.setPadding(0, Ui.dp(this, 10), 0, 0);
        clock = Ui.text(this, "0:00 / 0:00", 13, 0xFFE2E8F0, false);
        meta.addView(clock);
        hintView = Ui.text(this, "", 13, 0xFF94A3B8, false);
        LinearLayout.LayoutParams hintParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hintParams.leftMargin = Ui.dp(this, 18);
        meta.addView(hintView, hintParams);
        bottom.addView(meta);

        root.addView(bottomBar, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));

        setContentView(root);
        updateHint();
    }

    private void start(String url) {
        if (url == null || url.isEmpty()) {
            showChrome(true);
            hintView.setText("This title has no playable file.");
            return;
        }
        videoView.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
            @Override
            public void onPrepared(MediaPlayer player) {
                prepared = true;
                int resume = startAt >= 0 ? startAt * 1000
                        : (video != null ? app.history.resumePosition(video.id) : 0);
                if (resume > 0) videoView.seekTo(resume);
                videoView.start();
                lastTickAt = System.currentTimeMillis();
                handler.post(tick);
                handler.postDelayed(hideChrome, 3500);
            }
        });
        videoView.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer player) {
                finishPlayback(true);
            }
        });
        videoView.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer player, int what, int extra) {
                showChrome(true);
                hintView.setText("This clip could not be played. Check the connection and try again.");
                return true;
            }
        });
        videoView.setVideoURI(Uri.parse(url));
    }

    private void update() {
        if (!prepared) return;
        int position = videoView.getCurrentPosition();
        int duration = Math.max(1, videoView.getDuration());
        progress.setProgress((int) (1000L * position / duration));
        clock.setText(Ui.clock(position / 1000) + " / " + Ui.clock(duration / 1000));

        if (videoView.isPlaying()) {
            long now = System.currentTimeMillis();
            watchedMs += Math.max(0, now - lastTickAt);
            lastTickAt = now;
        }
        lastPosition = position;
        renderCaptions(position);
    }

    private void renderCaptions(int positionMs) {
        if (!captionsOn || captions.isEmpty()) {
            caption.setVisibility(View.GONE);
            captionIndex = -1;
            return;
        }
        int seconds = positionMs / 1000;
        int found = -1;
        for (int i = 0; i < captions.size(); i++) {
            if (captions.get(i).time <= seconds) found = i;
        }
        if (found < 0) {
            caption.setVisibility(View.GONE);
            captionIndex = -1;
            return;
        }
        captionIndex = found;
        Catalog.Caption line = captions.get(found);
        caption.setText(line.text);
        caption.setVisibility(View.VISIBLE);
    }

    private void updateHint() {
        if (hintView != null) {
            hintView.setText("● centre play/pause   ● left/right seek   ● down captions "
                    + (captionsOn ? "(on)" : "(off)"));
        }
    }

    private void togglePlay() {
        if (!prepared) return;
        if (videoView.isPlaying()) {
            videoView.pause();
            showChrome(true);
        } else {
            videoView.start();
            lastTickAt = System.currentTimeMillis();
            handler.postDelayed(hideChrome, 3000);
        }
    }

    private void seek(int deltaMs) {
        if (!prepared) return;
        int target = Math.max(0, Math.min(videoView.getDuration() - 1000,
                videoView.getCurrentPosition() + deltaMs));
        videoView.seekTo(target);
        showChrome(true);
        update();
    }

    private void toggleCaptions() {
        captionsOn = !captionsOn;
        app.prefs.setCaptionsOn(captionsOn);
        updateHint();
        if (!captionsOn) caption.setVisibility(View.GONE);
        showChrome(true);
    }

    private void showChrome(boolean visible) {
        int visibility = visible ? View.VISIBLE : View.GONE;
        topBar.setVisibility(visibility);
        bottomBar.setVisibility(visibility);
        scrimTop.setVisibility(visibility);
        scrimBottom.setVisibility(visibility);
        if (visible) {
            handler.removeCallbacks(hideChrome);
            handler.postDelayed(hideChrome, 3500);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                togglePlay();
                return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                seek(-SEEK_STEP_MS);
                return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                seek(SEEK_STEP_MS);
                return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                toggleCaptions();
                return true;
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_MENU:
                showChrome(true);
                return true;
            case KeyEvent.KEYCODE_MEDIA_NEXT:
                if (queueIndex >= 0) advance();
                return true;
            default:
                return super.onKeyDown(keyCode, event);
        }
    }

    private void advance() {
        if (queue.length == 0) return;
        int next = queueIndex + 1;
        if (next >= queue.length) next = 0;
        Catalog.Video following = app.catalog.video(queue[next]);
        if (following == null) return;
        queueIndex = next;
        video = following;
        titleText = following.title;
        subtitleText = following.channelName;
        captions = following.captions;
        clipUrl = following.hasLocalClip() ? app.catalog.url(following.clip) : "";
        titleView.setText(titleText);
        startAt = 0;
        watchedMs = 0;
        prepared = false;
        captionIndex = -1;
        start(clipUrl);
    }

    private void finishPlayback(boolean completed) {
        saveProgress(completed);
        if (completed && queue.length > 0 && queueIndex >= 0) {
            advance();
            return;
        }
        finish();
    }

    private void saveProgress(boolean completed) {
        if (video == null) return;
        int duration = videoView.getDuration() / 1000;
        int position = completed ? duration : lastPosition / 1000;
        if (duration > 0) {
            app.history.record(video, position, duration);
            double completion = done(duration, position);
            if (watchedMs > 3000 || completed) {
                app.taste.record(video, completed ? 1.0 : completion);
            }
        }
    }

    private static double done(int duration, int position) {
        if (duration <= 0) return 0;
        return Math.min(1.0, Math.max(0.0, position / (double) duration));
    }

    @Override
    public void onBackPressed() {
        saveProgress(false);
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        saveProgress(false);
        handler.removeCallbacks(tick);
        handler.removeCallbacks(hideChrome);
        if (prepared && videoView != null) videoView.pause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (prepared) {
            handler.post(tick);
            lastTickAt = System.currentTimeMillis();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        if (videoView != null) videoView.stopPlayback();
    }
}
