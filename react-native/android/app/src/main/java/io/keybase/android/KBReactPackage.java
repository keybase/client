package io.keybase.android;

import com.facebook.react.bridge.JavaScriptModule;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;

import io.keybase.android.components.VisiblePassReactEditTextManager;
import io.keybase.android.modules.KeybaseEngine;
import io.keybase.android.modules.KillableModule;

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
        killableModules.add(kbEngine);

        List<NativeModule> modules = new ArrayList<>();
        modules.add(kbEngine);

        return modules;
    }

    @Override
    public List<Class<? extends JavaScriptModule>> createJSModules() {
        List<Class<? extends JavaScriptModule>> modules = new ArrayList<>();
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactApplicationContext) {
        List<ViewManager> modules = Arrays.<ViewManager>asList(new VisiblePassReactEditTextManager());
        return modules;
    }
}
