package io.keybase.ossifrage;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;

import io.keybase.ossifrage.components.KBTextInputManager;
import io.keybase.ossifrage.modules.IntentHandler;
import io.keybase.ossifrage.modules.KeybaseEngine;
import io.keybase.ossifrage.modules.KillableModule;
import io.keybase.ossifrage.modules.LogSend;
import io.keybase.ossifrage.modules.NativeLogger;
import io.keybase.ossifrage.modules.NativeSettings;
import io.keybase.ossifrage.modules.ScreenProtector;
import io.keybase.ossifrage.modules.ShareFiles;
import io.keybase.ossifrage.modules.Utils;

public class KBReactPackage implements com.facebook.react.ReactPackage {
    private List<KillableModule> killableModules = new ArrayList<>();

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactApplicationContext) {
        final Iterator<KillableModule> i = killableModules.iterator();
        while (i.hasNext()) {
            final KillableModule killableModule = i.next();
            killableModule.destroy();
            i.remove();
        }

        final KeybaseEngine kbEngine = new KeybaseEngine(reactApplicationContext);
        final LogSend logSend = new LogSend(reactApplicationContext);
        final ScreenProtector screenProtector = new ScreenProtector(reactApplicationContext);
        final NativeSettings nativeSettings = new NativeSettings(reactApplicationContext);
        final NativeLogger nativeLogger = new NativeLogger(reactApplicationContext);
        final ShareFiles shareFiles = new ShareFiles(reactApplicationContext);
        final IntentHandler intentHandler = new IntentHandler(reactApplicationContext);
        final Utils utils = new Utils(reactApplicationContext);

        killableModules.add(kbEngine);

        List<NativeModule> modules = new ArrayList<>();
        modules.add(kbEngine);
        modules.add(logSend);
        modules.add(screenProtector);
        modules.add(nativeSettings);
        modules.add(nativeLogger);
        modules.add(shareFiles);
        modules.add(intentHandler);
        modules.add(utils);

        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactApplicationContext) {
        return Arrays.<ViewManager>asList(
            new KBTextInputManager()
        );
    }
}
