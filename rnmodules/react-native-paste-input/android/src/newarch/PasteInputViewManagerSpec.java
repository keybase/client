package com.pasteinput;

import android.view.View;

import androidx.annotation.Nullable;

import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.viewmanagers.PasteInputViewManagerDelegate;
import com.facebook.react.viewmanagers.PasteInputViewManagerInterface;
import com.facebook.soloader.SoLoader;

public abstract class PasteInputViewManagerSpec<T extends View> extends SimpleViewManager<T> implements PasteInputViewManagerInterface<T> {
  static {
    if (BuildConfig.CODEGEN_MODULE_REGISTRATION != null) {
      SoLoader.loadLibrary(BuildConfig.CODEGEN_MODULE_REGISTRATION);
    }
  }

  private final ViewManagerDelegate<T> mDelegate;

  public PasteInputViewManagerSpec() {
    mDelegate = new PasteInputViewManagerDelegate(this);
  }

  @Nullable
  @Override
  protected ViewManagerDelegate<T> getDelegate() {
    return mDelegate;
  }
}
