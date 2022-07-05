package io.keybase.ossifrage.components;

import android.content.Context;

import com.facebook.react.views.textinput.ReactEditText;

public class KBTextInput extends ReactEditText {
  private boolean mEnabled = false;

  public KBTextInput(Context context) {
    super(context);
  }

  @Override
  public void setEnabled(boolean enabled) {
    this.mEnabled = enabled;
    super.setEnabled(enabled);
  }

  @Override
  public void onAttachedToWindow() {
    super.onAttachedToWindow();
    try {
      if (!mEnabled)
        return;
      super.setEnabled(false);
      super.setEnabled(mEnabled);
    } catch (Exception e) {
      e.printStackTrace();
    }
  }
}
