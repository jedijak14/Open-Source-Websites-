package dev.opentube.tv;

import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.TypedValue;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Search. Live results when a key is present; when the API says "too many
 * requests" the viewer sees a normal sentence and the on-device catalogue's
 * matches, never an API error string.
 */
final class SearchScreen {

    private SearchScreen() {
    }

    static View build(final MainActivity activity) {
        final App app = App.get(activity);
        final Catalog catalog = app.catalog;
        final Handler main = new Handler(Looper.getMainLooper());

        LinearLayout body = Ui.page(activity);
        body.addView(Ui.text(activity, "Search", 34, Ui.TEXT, true));

        final EditText input = new EditText(activity);
        input.setSingleLine(true);
        input.setHint("Search channels and videos");
        input.setTextColor(Ui.TEXT);
        input.setHintTextColor(0xFF64748B);
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        input.setInputType(InputType.TYPE_CLASS_TEXT);
        input.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        input.setBackground(Ui.stroked(activity, Ui.SURFACE, 0xFF334155, 12, 2));
        input.setPadding(Ui.dp(activity, 18), Ui.dp(activity, 14), Ui.dp(activity, 18), Ui.dp(activity, 14));
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        inputParams.topMargin = Ui.dp(activity, 18);
        body.addView(input, inputParams);

        final TextView status = Ui.body(activity, "Press centre to type. Suggestions appear as you search.");
        status.setPadding(0, Ui.dp(activity, 14), 0, 0);
        body.addView(status);

        final LinearLayout results = Ui.column(activity);
        results.setPadding(0, Ui.dp(activity, 18), 0, 0);
        body.addView(results);

        final View.OnClickListener submit = new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                String query = input.getText().toString().trim();
                if (query.isEmpty()) return;
                run(app, catalog, activity, query, status, results, main);
            }
        };

        TextView go = Ui.button(activity, "Search", true, submit);
        LinearLayout.LayoutParams goParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        goParams.topMargin = Ui.dp(activity, 14);
        body.addView(go, goParams);

        input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView view, int actionId, KeyEvent event) {
                submit.onClick(view);
                return true;
            }
        });

        // A few suggested searches double as a quick way to test the app.
        List<View> chips = new ArrayList<>();
        String[] suggestions = {"compiler", "synth repair", "kyoto", "lofi", "rocket launch"};
        for (final String suggestion : suggestions) {
            TextView chip = Ui.text(activity, suggestion, 13, Ui.TEXT, false);
            chip.setFocusable(true);
            chip.setClickable(true);
            chip.setBackground(Ui.rounded(activity, Ui.SURFACE_HI, 18));
            chip.setPadding(Ui.dp(activity, 16), Ui.dp(activity, 9), Ui.dp(activity, 16), Ui.dp(activity, 9));
            chip.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    input.setText(suggestion);
                    submit.onClick(view);
                }
            });
            chips.add(chip);
        }
        LinearLayout chipRow = Ui.row(activity);
        for (View chip : chips) {
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            params.rightMargin = Ui.dp(activity, 10);
            chipRow.addView(chip, params);
        }
        LinearLayout.LayoutParams chipParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        chipParams.topMargin = Ui.dp(activity, 12);
        body.addView(chipRow, chipParams);

        input.requestFocus();
        return Ui.scroller(body);
    }

    private static void run(final App app, final Catalog catalog, final MainActivity activity,
                            final String query, final TextView status, final LinearLayout results,
                            final Handler main) {
        status.setText("Searching " + query + "…");
        status.setTextColor(Ui.TEXT_DIM);
        results.removeAllViews();

        new Thread(new Runnable() {
            @Override
            public void run() {
                List<Catalog.Video> found = new ArrayList<>();
                String message = null;
                boolean live = false;
                try {
                    Api api = new Api(app.prefs);
                    found = api.search(query, 24);
                    live = true;
                    if (found.isEmpty()) message = "Nothing live for “" + query + "”. Showing catalogue matches.";
                } catch (Api.Failure failure) {
                    if (failure.getMessage().equals("no-key")) {
                        message = App.get(activity).getString(R.string.need_key)
                                + " Showing catalogue matches.";
                    } else if (failure.quota) {
                        message = App.get(activity).getString(R.string.quota_fallback);
                    } else {
                        message = "Live search is unavailable right now. Showing catalogue matches.";
                    }
                }
                if (found.isEmpty()) {
                    found = local(catalog, query);
                }
                final List<Catalog.Video> videos = found;
                final String note = message;
                final boolean fromApi = live && !videos.isEmpty() && videos.get(0).live;
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        if (note != null) {
                            status.setText(note);
                            status.setTextColor(0xFFFBBF24);
                        } else {
                            status.setText(videos.size() + (videos.size() == 1 ? " result" : " results")
                                    + " for “" + query + "”" + (fromApi ? " · live from YouTube" : " · from the OpenTube catalogue"));
                            status.setTextColor(Ui.TEXT_DIM);
                        }
                        render(activity, catalog, videos, results);
                    }
                });
            }
        }, "ot-search").start();
    }

    private static List<Catalog.Video> local(Catalog catalog, String query) {
        String needle = query.toLowerCase(Locale.US);
        List<Catalog.Video> out = new ArrayList<>();
        for (Catalog.Video video : catalog.videos()) {
            String haystack = (video.title + ' ' + video.channelName + ' ' + video.category + ' '
                    + video.desc + ' ' + android.text.TextUtils.join(" ", video.tags)).toLowerCase(Locale.US);
            if (haystack.contains(needle)) out.add(video);
        }
        return out;
    }

    private static void render(MainActivity activity, Catalog catalog, List<Catalog.Video> videos,
                               LinearLayout results) {
        if (videos.isEmpty()) {
            TextView empty = Ui.body(activity, "No matches. Try a broader word.");
            results.addView(empty);
            return;
        }
        List<View> cards = new ArrayList<>();
        for (Catalog.Video video : videos) cards.add(HomeScreen.videoCard(activity, video));
        results.addView(Ui.cardRow(activity, null, cards));

        if (videos.size() > 5) {
            List<View> more = new ArrayList<>();
            for (int i = 5; i < videos.size(); i++) more.add(HomeScreen.videoCard(activity, videos.get(i)));
            results.addView(Ui.cardRow(activity, null, more));
        }
        View target = firstFocusable(results);
        if (target != null) target.requestFocus();
    }

    static View firstFocusable(View view) {
        if (view == null) return null;
        if (view.isFocusable() && view.getVisibility() == View.VISIBLE) return view;
        if (view instanceof android.view.ViewGroup) {
            android.view.ViewGroup group = (android.view.ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                View found = firstFocusable(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }
}
