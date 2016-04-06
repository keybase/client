package io.keybase.android;

import com.facebook.react.bridge.JavaScriptModule;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import io.keybase.android.components.VisiblePassReactEditTextManager;
import io.keybase.android.modules.KeybaseEngine;

public class ReactPackage implements com.facebook.react.ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactApplicationContext) {
        List<NativeModule> modules = new ArrayList<>();

        modules.add(new KeybaseEngine(reactApplicationContext));

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
