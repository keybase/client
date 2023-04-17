package com.dropview;

import android.graphics.Color;

import androidx.annotation.Nullable;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.DropViewViewManagerDelegate;
import com.facebook.react.viewmanagers.DropViewViewManagerInterface;
import com.facebook.soloader.SoLoader;

@ReactModule(name = DropViewViewManager.NAME)
public class DropViewViewManager extends SimpleViewManager<DropViewView> implements DropViewViewManagerInterface<DropViewView> {

  public static final String NAME = "DropViewView";

  static {
    if (BuildConfig.CODEGEN_MODULE_REGISTRATION != null) {
      SoLoader.loadLibrary(BuildConfig.CODEGEN_MODULE_REGISTRATION);
    }
  }

  private final ViewManagerDelegate<DropViewView> mDelegate;

  public DropViewViewManager() {
    mDelegate = new DropViewViewManagerDelegate(this);
  }

  @Nullable
  @Override
  protected ViewManagerDelegate<DropViewView> getDelegate() {
    return mDelegate;
  }

  @Override
  public String getName() {
    return NAME;
  }

  @Override
  public DropViewView createViewInstance(ThemedReactContext context) {
    return new DropViewView(context);
  }

  @Override
  @ReactProp(name = "color")
  public void setColor(DropViewView view, String color) {
    view.setBackgroundColor(Color.parseColor(color));
  }
}
