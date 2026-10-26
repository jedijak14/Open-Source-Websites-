package dev.opentube.tv;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * YouTube playback for live results. YouTube only permits its own player for its
 * own videos, so this embeds the IFrame player and drives it from the D-pad:
 * centre toggles playback, left/right seek, down toggles captions. YouTube's ads
 * live inside this surface and cannot be removed — the details page says so.
 */
public class WebPlayerActivity extends Activity {

    private WebView web;
    private TextView hint;
    private boolean captions = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String videoId = getIntent().getStringExtra("videoId");
        String title = getIntent().getStringExtra("title");
        String channel = getIntent().getStringExtra("channelName");
        if (videoId == null) videoId = "";

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF000000);

        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        web.setBackgroundColor(0xFF000000);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        web.loadDataWithBaseURL("https://opentube-two.vercel.app/", html(videoId), "text/html", "utf-8", null);

        LinearLayoutOverlay overlay = new LinearLayoutOverlay(this, title, channel);
        root.addView(overlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP));

        hint = Ui.text(this, "● centre play/pause   ● left/right seek   ● down captions", 13, 0xFF94A3B8, false);
        hint.setPadding(Ui.dp(this, 52), 0, Ui.dp(this, 52), Ui.dp(this, 26));
        root.addView(hint, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));

        setContentView(root);
        js("otCaptions(" + (captions ? "true" : "false") + ")");
    }

    private static final class LinearLayoutOverlay extends android.widget.LinearLayout {
        LinearLayoutOverlay(Activity activity, String title, String channel) {
            super(activity);
            setOrientation(VERTICAL);
            setBackgroundColor(0xCC000000);
            setPadding(Ui.dp(activity, 52), Ui.dp(activity, 20), Ui.dp(activity, 52), Ui.dp(activity, 20));
            addView(Ui.text(activity, title == null ? "YouTube" : title, 18, Ui.TEXT, true));
            addView(Ui.text(activity, channel == null ? "" : channel, 12, 0xFFCBD5E1, false));
        }
    }

    private void js(String script) {
        if (web != null) web.evaluateJavascript(script, null);
    }

    private static String html(String videoId) {
        return "<!doctype html><html><head><meta name=\"viewport\" content=\"initial-scale=1\">"
                + "<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}"
                + "#p{width:100%;height:100%}</style></head><body><div id=\"p\"></div>"
                + "<script src=\"https://www.youtube.com/iframe_api\"></script>"
                + "<script>var player,ready=false;"
                + "function onYouTubeIframeAPIReady(){player=new YT.Player('p',{videoId:'" + videoId + "',"
                + "playerVars:{controls:0,disablekb:1,modestbranding:1,rel:0,iv_load_policy:3,playsinline:1,"
                + "cc_load_policy:1,fs:0},events:{onReady:function(){ready=true;player.playVideo();},"
                + "onError:function(){}}})};"
                + "function otPlay(){if(!ready)return;if(player.getPlayerState()==1){player.pauseVideo();}"
                + "else{player.playVideo();}}"
                + "function otSeek(d){if(!ready)return;player.seekTo(Math.max(0,player.getCurrentTime()+d),true);}"
                + "function otCaptions(on){if(!ready)return;try{if(on){player.loadModule('captions');"
                + "player.setOption('captions','track',{});player.setOption('captions','fontSize',2);}"
                + "else{player.unloadModule('captions');}}catch(e){}}"
                + "</script></body></html>";
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                js("otPlay()");
                return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
                js("otSeek(-10)");
                return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                js("otSeek(10)");
                return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                captions = !captions;
                js("otCaptions(" + (captions ? "true" : "false") + ")");
                hint.setText("Captions " + (captions ? "on" : "off")
                        + "   ● centre play/pause   ● left/right seek   ● down captions");
                return true;
            default:
                return super.onKeyDown(keyCode, event);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
    }
}
