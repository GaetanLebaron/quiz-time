package fr.quiztime.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Affiche le site Quiz Time en plein écran sur la TV.
 * Le site gère tout le jeu (QR code, questions, scores) ; l'appli ne fait que l'ouvrir,
 * garder l'écran allumé et proposer de réessayer en cas de coupure réseau.
 */
public class MainActivity extends Activity {

    private WebView web;
    private String siteUrl;
    private boolean showingError;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Pas de mise en veille de la TV pendant une partie.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        siteUrl = getString(R.string.site_url);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#211a57"));
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // localStorage : la TV garde le classement
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);                     // ignore la taille de police système
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Tout reste dans l'appli : il n'y a pas forcément de navigateur sur la TV.
                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
        });

        setContentView(web);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(siteUrl);
        web.requestFocus();
    }

    private void showError() {
        showingError = true;
        String html = "<html><body style=\"margin:0;height:100vh;display:flex;flex-direction:column;"
                + "align-items:center;justify-content:center;background:#211a57;color:#fff;"
                + "font-family:sans-serif;text-align:center\">"
                + "<h1 style=\"font-size:6vh\">Pas de connexion Internet</h1>"
                + "<p style=\"font-size:3.5vh;opacity:.8\">Vérifie le Wi-Fi de la TV, puis appuie sur OK pour réessayer.</p>"
                + "</body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    private void retry() {
        showingError = false;
        web.loadUrl(siteUrl);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (showingError && (keyCode == KeyEvent.KEYCODE_DPAD_CENTER
                || keyCode == KeyEvent.KEYCODE_ENTER
                || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER)) {
            retry();
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_BACK && !showingError && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
