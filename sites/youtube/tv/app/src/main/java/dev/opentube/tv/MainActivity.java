package dev.opentube.tv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** The shell: a focusable navigation rail plus whichever screen is showing. */
public class MainActivity extends Activity {

    public static final int HOME = 0;
    public static final int MUSIC = 1;
    public static final int SEARCH = 2;
    public static final int LIBRARY = 3;
    public static final int SETTINGS = 4;

    private static final String[] LABELS = {"Home", "Music", "Search", "Library", "Settings"};

    private FrameLayout content;
    private LinearLayout nav;
    private int current = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Ui.BG);

        LinearLayout shell = Ui.row(this);
        shell.setGravity(Gravity.TOP);

        nav = buildNav();
        shell.addView(nav, new LinearLayout.LayoutParams(Ui.dp(this, 208), ViewGroup.LayoutParams.MATCH_PARENT));

        content = new FrameLayout(this);
        shell.addView(content, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f));

        root.addView(shell, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        show(HOME);
    }

    private LinearLayout buildNav() {
        LinearLayout rail = Ui.column(this);
        rail.setBackgroundColor(Ui.BG_ALT);
        rail.setPadding(Ui.dp(this, 18), Ui.dp(this, 30), Ui.dp(this, 18), Ui.dp(this, 24));

        TextView brand = Ui.text(this, "OpenTube", 24, Ui.TEXT, true);
        brand.setTypeface(brand.getTypeface(), Typeface.BOLD);
        brand.setLetterSpacing(0.02f);
        rail.addView(brand);

        TextView tagline = Ui.text(this, "TELEVISION", 11, Ui.ACCENT, true);
        tagline.setLetterSpacing(0.24f);
        tagline.setPadding(0, Ui.dp(this, 4), 0, Ui.dp(this, 22));
        rail.addView(tagline);

        for (int i = 0; i < LABELS.length; i++) {
            final int index = i;
            TextView item = Ui.text(this, LABELS[i], 16, Ui.TEXT_DIM, false);
            item.setFocusable(true);
            item.setClickable(true);
            item.setPadding(Ui.dp(this, 12), Ui.dp(this, 13), Ui.dp(this, 12), Ui.dp(this, 13));
            item.setBackground(Ui.rounded(this, 0x00000000, 9));
            item.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    show(index);
                }
            });
            item.setOnFocusChangeListener(new View.OnFocusChangeListener() {
                @Override
                public void onFocusChange(View view, boolean hasFocus) {
                    view.setBackground(hasFocus || current == index
                            ? Ui.rounded(MainActivity.this, Ui.SURFACE_HI, 9)
                            : Ui.rounded(MainActivity.this, 0x00000000, 9));
                    ((TextView) view).setTextColor(hasFocus || current == index ? Ui.TEXT : Ui.TEXT_DIM);
                }
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = Ui.dp(this, 6);
            rail.addView(item, params);
            item.setTag("nav-" + index);
        }

        TextView footnote = Ui.text(this, "No ads. Nothing tracked.\nMIT licensed.", 11, 0xFF64748B, false);
        footnote.setPadding(Ui.dp(this, 12), 0, 0, 0);
        LinearLayout.LayoutParams footnoteParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        footnoteParams.topMargin = Ui.dp(this, 18);
        rail.addView(footnote, footnoteParams);
        return rail;
    }

    /** Rebuilds the current screen, e.g. after a setting was changed. */
    public void reload() {
        int index = current;
        current = -1;
        show(index);
    }

    public void show(int index) {
        if (index == current) return;
        current = index;
        content.removeAllViews();

        View screen;
        switch (index) {
            case MUSIC:
                screen = MusicScreen.build(this);
                break;
            case SEARCH:
                screen = SearchScreen.build(this);
                break;
            case LIBRARY:
                screen = LibraryScreen.build(this);
                break;
            case SETTINGS:
                screen = SettingsScreen.build(this);
                break;
            default:
                screen = HomeScreen.build(this);
                break;
        }
        content.addView(screen, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        refreshNavHighlight();
        focusFirst(screen);
    }

    private void refreshNavHighlight() {
        for (int i = 0; i < LABELS.length; i++) {
            View item = nav.findViewWithTag("nav-" + i);
            if (item instanceof TextView) {
                TextView text = (TextView) item;
                boolean active = i == current;
                text.setTextColor(active ? Ui.TEXT : Ui.TEXT_DIM);
                if (!item.isFocused()) {
                    text.setBackground(Ui.rounded(this, active ? Ui.SURFACE_HI : 0x00000000, 9));
                }
            }
        }
    }

    /** Gives the screen keyboard focus so the D-pad works the moment it appears. */
    private void focusFirst(View root) {
        View target = findFocusable(root);
        if (target != null) target.requestFocus();
    }

    private View findFocusable(View view) {
        if (view == null) return null;
        if (view.isFocusable() && view.getVisibility() == View.VISIBLE) {
            return view;
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                View found = findFocusable(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }

    public void openDetail(Catalog.Video video) {
        Intent intent = new Intent(this, DetailActivity.class);
        intent.putExtra("id", video.id);
        if (video.live) {
            intent.putExtra("videoId", video.youtubeId);
            intent.putExtra("title", video.title);
            intent.putExtra("channelName", video.channelName);
            intent.putExtra("poster", video.poster);
            intent.putExtra("desc", video.desc);
            intent.putExtra("duration", video.durationLabel);
            intent.putExtra("live", true);
        }
        startActivity(intent);
    }

    public void openMovie(Catalog.Movie movie) {
        Intent intent = new Intent(this, DetailActivity.class);
        intent.putExtra("movieId", movie.id);
        startActivity(intent);
    }

    public void openChannel(String channelId, String title, String avatar) {
        Intent intent = new Intent(this, ChannelActivity.class);
        intent.putExtra("channelId", channelId);
        intent.putExtra("title", title);
        intent.putExtra("avatar", avatar);
        startActivity(intent);
    }

    @Override
    public void onBackPressed() {
        if (current != HOME) {
            show(HOME);
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Coming back from playback: the rows may have changed (history, taste).
        if (current == HOME || current == LIBRARY) {
            int keep = current;
            current = -1;
            show(keep);
        }
    }

    static TextView pill(Activity activity, String text, int color) {
        TextView view = Ui.text(activity, text, 12, color, true);
        view.setBackground(Ui.rounded(activity, 0x33000000 | (color & 0xFFFFFF), 6));
        view.setPadding(Ui.dp(activity, 8), Ui.dp(activity, 4), Ui.dp(activity, 8), Ui.dp(activity, 4));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        return view;
    }
}
