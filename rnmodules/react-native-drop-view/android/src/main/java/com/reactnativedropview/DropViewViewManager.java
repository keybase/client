package com.reactnativedropview;

import android.graphics.Color;
import android.view.View;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ViewGroupManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

public class DropViewViewManager extends ViewGroupManager<FrameLayout> {
    public static final String REACT_CLASS = "DropView";

    @Override
    @NonNull
    public String getName() {
        return REACT_CLASS;
    }

    @Override
      public FrameLayout createViewInstance(ThemedReactContext reactContext) {
        return new FrameLayout(reactContext);
      }
}
