package io.keybase.ossifrage.modules;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.ComponentName;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.common.logging.FLog;

import me.leolin.shortcutbadger.Badger;
import me.leolin.shortcutbadger.ShortcutBadger;
import me.leolin.shortcutbadger.impl.SamsungHomeBadger;

public class ApplicationBadgeHelper extends ReactContextBaseJavaModule {
    private static final String NAME = "ApplicationBadgeHelper";
    private static final String LOG_TAG = "ApplicationBadgeHelper";
    private static final Badger LEGACY_SAMSUNG_BADGER = new SamsungHomeBadger();

    public static ApplicationBadgeHelper INSTANCE;
    private final ReactApplicationContext reactContext;
    private Boolean applyAutomaticBadger;
    private Boolean applySamsungBadger;
    private ComponentName componentName;

    @Override
    public String getName() {
        return NAME;
    }

    public ApplicationBadgeHelper(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        ApplicationBadgeHelper.INSTANCE = this;
    }

    @ReactMethod
    public void setApplicationIconBadgeNumber(int number) {
        if (null == componentName) {
            componentName = this.reactContext.getPackageManager().getLaunchIntentForPackage(this.reactContext.getPackageName()).getComponent();
        }
        tryAutomaticBadge(number);
        tryLegacySamsungBadge( number);
    }

    private void tryAutomaticBadge(int number) {
        if (null == applyAutomaticBadger) {
            applyAutomaticBadger = ShortcutBadger.applyCount(this.reactContext, number);
            if (applyAutomaticBadger) {
                FLog.i(LOG_TAG, "First attempt to use automatic badger succeeded; permanently enabling method.");
            } else {
                FLog.i(LOG_TAG, "First attempt to use automatic badger failed; permanently disabling method.");
            }
            return;
        } else if (!applyAutomaticBadger) {
            return;
        }
        ShortcutBadger.applyCount(this.reactContext, number);
    }

    private void tryLegacySamsungBadge(int number) {
        // First attempt to apply legacy samsung badge. Check if eligible, then attempt it.
        if (null == applySamsungBadger) {
            applySamsungBadger = isLegacySamsungLauncher() && applyLegacySamsungBadge(number);
            if (applySamsungBadger) {
                FLog.i(LOG_TAG, "First attempt to use legacy Samsung badger succeeded; permanently enabling method.");
            } else {
                FLog.w(LOG_TAG, "First attempt to use legacy Samsung badger failed; permanently disabling method.");
            }
            return;
        } else if (!applySamsungBadger) {
            return;
        }
        applyLegacySamsungBadge(number);
    }

    private boolean isLegacySamsungLauncher() {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_HOME);
        ResolveInfo resolveInfo = this.reactContext.getPackageManager().resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY);

        if (resolveInfo == null || resolveInfo.activityInfo.name.toLowerCase().contains("resolver")) {
            return false;
        }

        String currentHomePackage = resolveInfo.activityInfo.packageName;
        return LEGACY_SAMSUNG_BADGER.getSupportLaunchers().contains(currentHomePackage);
    }

    private boolean applyLegacySamsungBadge(int number) {
        try {
            LEGACY_SAMSUNG_BADGER.executeBadge(this.reactContext, componentName, number);
            return true;
        } catch (Exception e) {
            FLog.w(LOG_TAG, "Legacy Samsung badger failed", e);
            return false;
        }
    }
}
