package com.pasteinput;

import android.graphics.Color;

import androidx.annotation.Nullable;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

@ReactModule(name = PasteInputViewManager.NAME)
public class PasteInputViewManager extends PasteInputViewManagerSpec<PasteInputView> {

  public static final String NAME = "PasteInputView";

  @Override
  public String getName() {
    return NAME;
  }

  @Override
  public PasteInputView createViewInstance(ThemedReactContext context) {
    return new PasteInputView(context);
  }

  @Override
  @ReactProp(name = "color")
  public void setColor(PasteInputView view, @Nullable String color) {
    view.setBackgroundColor(Color.parseColor(color));
  }
}
