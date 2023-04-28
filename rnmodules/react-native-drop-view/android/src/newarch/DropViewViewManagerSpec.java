package com.reactnativedropview;

import android.view.View;

import androidx.annotation.Nullable;
import android.widget.FrameLayout;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.viewmanagers.DropViewViewManagerDelegate;
import com.facebook.react.viewmanagers.DropViewViewManagerInterface;
import com.facebook.soloader.SoLoader;

public abstract class DropViewViewManagerSpec<T extends FrameLayout > extends ViewGroupManager<T> implements DropViewViewManagerInterface<T> {
  static {
    if (BuildConfig.CODEGEN_MODULE_REGISTRATION != null) {
      SoLoader.loadLibrary(BuildConfig.CODEGEN_MODULE_REGISTRATION);
    }
  }

  private final ViewManagerDelegate<T> mDelegate;

  public DropViewViewManagerSpec() {
    mDelegate = new DropViewViewManagerDelegate(this);
  }

  @Nullable
  @Override
  protected ViewManagerDelegate<T> getDelegate() {
    return mDelegate;
  }
}
