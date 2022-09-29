package io.keybase.ossifrage;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;

import io.keybase.ossifrage.modules.GoJSIBridge;
import io.keybase.ossifrage.modules.KeybaseEngine;
import io.keybase.ossifrage.modules.KillableModule;

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
        final GoJSIBridge kbJSI = new GoJSIBridge(reactApplicationContext);

        killableModules.add(kbEngine);

        List<NativeModule> modules = new ArrayList<>();
        modules.add(kbEngine);
        modules.add(kbJSI);

        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactApplicationContext) {
        return Arrays.<ViewManager>asList();
    }
}
