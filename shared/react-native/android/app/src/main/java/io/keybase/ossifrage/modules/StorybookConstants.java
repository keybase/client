package io.keybase.ossifrage.modules;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

import java.util.HashMap;
import java.util.Map;

import io.keybase.ossifrage.BuildConfig;

public class StorybookConstants extends ReactContextBaseJavaModule {
    public StorybookConstants(final ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public Map<String, Object> getConstants() {
        final boolean isStoryBook = BuildConfig.BUILD_TYPE == "storyBook";
        final Map<String, Object> constants = new HashMap<>();
        constants.put("isStorybook", isStoryBook);
        return constants;
    }

    @Override
    public String getName() {
        return "Storybook";
    }
}
