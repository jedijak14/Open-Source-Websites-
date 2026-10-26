package dev.opentube.tv;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.List;

/**
 * View helpers. Everything is built in code: the layouts are simple enough that
 * XML would only add indirection, and the app has no support library to lean on.
 */
public final class Ui {

    public static final int BG = 0xFF0A1118;
    public static final int BG_ALT = 0xFF101A24;
    public static final int SURFACE = 0xFF16212C;
    public static final int SURFACE_HI = 0xFF1E2C39;
    public static final int TEXT = 0xFFF8FAFC;
    public static final int TEXT_DIM = 0xFF94A3B8;
    public static final int ACCENT = 0xFF4FD1C5;
    public static final int WARM = 0xFFFF6B5C;

    private Ui() {
    }

    public static int dp(Activity activity, float value) {
        return Math.round(activity.getResources().getDisplayMetrics().density * value);
    }

    public static int px(Activity activity, float dpValue) {
        return dp(activity, dpValue);
    }

    public static GradientDrawable rounded(Activity activity, int color, float radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(activity, radiusDp));
        return drawable;
    }

    public static GradientDrawable stroked(Activity activity, int fill, int stroke, float radiusDp, float strokeDp) {
        GradientDrawable drawable = rounded(activity, fill, radiusDp);
        drawable.setStroke(dp(activity, strokeDp), stroke);
        return drawable;
    }

    public static TextView text(Activity activity, CharSequence value, float sp, int color, boolean bold) {
        TextView view = new TextView(activity);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setTextColor(color);
        if (bold) view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
        view.setIncludeFontPadding(false);
        return view;
    }

    public static LinearLayout column(Activity activity) {
        LinearLayout layout = new LinearLayout(activity);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    public static LinearLayout row(Activity activity) {
        LinearLayout layout = new LinearLayout(activity);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        return layout;
    }

    /** Scrollable page body with consistent padding. */
    public static LinearLayout page(Activity activity) {
        ScrollView scroll = new ScrollView(activity);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        LinearLayout body = column(activity);
        int pad = dp(activity, 40);
        body.setPadding(pad, dp(activity, 24), pad, dp(activity, 48));
        scroll.addView(body, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        scroll.setTag(body);
        return body;
    }

    /** The ScrollView that wraps a {@link #page(Activity)} body. */
    public static View scroller(LinearLayout body) {
        return (View) body.getParent();
    }

    public static TextView sectionTitle(Activity activity, String title) {
        TextView view = text(activity, title, 22, TEXT, true);
        view.setPadding(dp(activity, 2), dp(activity, 26), 0, dp(activity, 12));
        return view;
    }

    public static TextView body(Activity activity, String value) {
        TextView view = text(activity, value, 14, TEXT_DIM, false);
        view.setLineSpacing(dp(activity, 4), 1f);
        return view;
    }

    /** Horizontal row of cards with its own scroll position and focus handoff. */
    public static View cardRow(Activity activity, String title, List<View> cards) {
        LinearLayout wrapper = column(activity);
        if (title != null && !title.isEmpty()) wrapper.addView(sectionTitle(activity, title));

        HorizontalScrollView scroll = new HorizontalScrollView(activity);
        scroll.setHorizontalScrollBarEnabled(false);
        scroll.setClipToPadding(false);
        LinearLayout strip = row(activity);
        strip.setPadding(0, dp(activity, 6), dp(activity, 40), dp(activity, 8));
        for (View card : cards) {
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            params.rightMargin = dp(activity, 16);
            strip.addView(card, params);
        }
        scroll.addView(strip, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        wrapper.addView(scroll);
        return wrapper;
    }

    /**
     * A focusable poster card: artwork, an optional corner badge, a title and a
     * meta line. The whole card is one focus target so a D-pad press never gets
     * stuck on a child.
     */
    public static View card(final Activity activity, String posterUrl, String title, String meta,
                            String badge, int widthDp, int imageHeightDp) {
        LinearLayout card = column(activity);
        card.setFocusable(true);
        card.setFocusableInTouchMode(true);
        card.setClickable(true);
        card.setPadding(dp(activity, 6), dp(activity, 6), dp(activity, 6), dp(activity, 6));
        card.setBackground(stroked(activity, 0x00000000, 0x00000000, 12, 2));

        FrameLayout art = new FrameLayout(activity);
        ImageView image = new ImageView(activity);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setBackgroundColor(SURFACE);
        art.addView(image, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        Net.image(image, posterUrl);

        if (badge != null && !badge.isEmpty()) {
            TextView chip = text(activity, badge, 11, Color.WHITE, true);
            chip.setBackground(rounded(activity, 0xCC0A1118, 5));
            chip.setPadding(dp(activity, 6), dp(activity, 3), dp(activity, 6), dp(activity, 3));
            FrameLayout.LayoutParams chipParams = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM | Gravity.END);
            chipParams.setMargins(0, 0, dp(activity, 6), dp(activity, 6));
            art.addView(chip, chipParams);
        }

        card.addView(art, new LinearLayout.LayoutParams(dp(activity, widthDp), dp(activity, imageHeightDp)));
        art.setBackground(rounded(activity, SURFACE, 9));
        art.setClipToOutline(true);

        TextView titleView = text(activity, title, 14, TEXT, true);
        titleView.setMaxLines(2);
        titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                dp(activity, widthDp), ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.topMargin = dp(activity, 8);
        card.addView(titleView, titleParams);

        if (meta != null && !meta.isEmpty()) {
            TextView metaView = text(activity, meta, 12, TEXT_DIM, false);
            metaView.setMaxLines(1);
            metaView.setEllipsize(android.text.TextUtils.TruncateAt.END);
            LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(
                    dp(activity, widthDp), ViewGroup.LayoutParams.WRAP_CONTENT);
            metaParams.topMargin = dp(activity, 3);
            card.addView(metaView, metaParams);
        }

        card.setOnFocusChangeListener(new View.OnFocusChangeListener() {
            @Override
            public void onFocusChange(View view, boolean hasFocus) {
                view.setBackground(hasFocus
                        ? stroked(activity, SURFACE_HI, ACCENT, 12, 2)
                        : stroked(activity, 0x00000000, 0x00000000, 12, 2));
                view.animate().scaleX(hasFocus ? 1.06f : 1f).scaleY(hasFocus ? 1.06f : 1f)
                        .setDuration(120).start();
            }
        });
        return card;
    }

    /** A plain row of text with a focus highlight, used by Settings. */
    public static View settingsRow(Activity activity, String title, String value, View.OnClickListener click) {
        LinearLayout row = column(activity);
        row.setFocusable(true);
        row.setClickable(true);
        row.setPadding(dp(activity, 20), dp(activity, 14), dp(activity, 20), dp(activity, 14));
        row.setBackground(stroked(activity, SURFACE, 0x00000000, 10, 2));
        row.setOnClickListener(click);
        TextView titleView = text(activity, title, 16, TEXT, true);
        row.addView(titleView);
        if (value != null && !value.isEmpty()) {
            TextView valueView = text(activity, value, 13, TEXT_DIM, false);
            valueView.setPadding(0, dp(activity, 4), 0, 0);
            row.addView(valueView);
        }
        final Activity host = activity;
        row.setOnFocusChangeListener(new View.OnFocusChangeListener() {
            @Override
            public void onFocusChange(View view, boolean hasFocus) {
                view.setBackground(hasFocus
                        ? stroked(activity, SURFACE_HI, ACCENT, 10, 2)
                        : stroked(activity, SURFACE, 0x00000000, 10, 2));
                view.animate().scaleX(hasFocus ? 1.02f : 1f).scaleY(hasFocus ? 1.02f : 1f)
                        .setDuration(110).start();
            }
        });
        return row;
    }

    /** A primary action button that behaves well with a D-pad. */
    public static TextView button(final Activity activity, String label, boolean primary, View.OnClickListener click) {
        final TextView view = text(activity, label, 15, primary ? 0xFF07131A : TEXT, true);
        view.setGravity(Gravity.CENTER);
        view.setFocusable(true);
        view.setClickable(true);
        view.setPadding(dp(activity, 26), dp(activity, 14), dp(activity, 26), dp(activity, 14));
        final int idle = primary ? ACCENT : SURFACE_HI;
        view.setBackground(rounded(activity, idle, 10));
        view.setOnClickListener(click);
        view.setOnFocusChangeListener(new View.OnFocusChangeListener() {
            @Override
            public void onFocusChange(View v, boolean hasFocus) {
                v.setBackground(stroked(activity, hasFocus ? 0xFFFFFFFF : idle,
                        hasFocus ? 0xFFFFFFFF : 0x00000000, 10, 2));
                v.animate().scaleX(hasFocus ? 1.05f : 1f).scaleY(hasFocus ? 1.05f : 1f)
                        .setDuration(110).start();
            }
        });
        return view;
    }

    public static void marginBottom(Activity activity, View view, int dpValue) {
        ViewGroup.LayoutParams params = view.getLayoutParams();
        if (params instanceof ViewGroup.MarginLayoutParams) {
            ((ViewGroup.MarginLayoutParams) params).bottomMargin = dp(activity, dpValue);
            view.setLayoutParams(params);
        }
    }

    public static String views(long count) {
        if (count >= 1000000) return String.format(java.util.Locale.US, "%.1fM views", count / 1000000.0);
        if (count >= 1000) return String.format(java.util.Locale.US, "%.1fK views", count / 1000.0);
        return count + (count == 1 ? " view" : " views");
    }

    public static String clock(int seconds) {
        if (seconds < 0) seconds = 0;
        int hours = seconds / 3600;
        int minutes = (seconds % 3600) / 60;
        int secs = seconds % 60;
        if (hours > 0) return String.format(java.util.Locale.US, "%d:%02d:%02d", hours, minutes, secs);
        return String.format(java.util.Locale.US, "%d:%02d", minutes, secs);
    }
}
