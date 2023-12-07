package com.reactnativedropview;

import android.graphics.Color;

import androidx.annotation.Nullable;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

@ReactModule(name = DropViewViewManager.NAME)
public class DropViewViewManager extends DropViewViewManagerSpec<DropViewView> {

  public static final String NAME = "DropViewView";

  @Override
  public String getName() {
    return NAME;
  }

  @Override
  public DropViewView createViewInstance(ThemedReactContext context) {
    return new DropViewView(context);
  }
}
