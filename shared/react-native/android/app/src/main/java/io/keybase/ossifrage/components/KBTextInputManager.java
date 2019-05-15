package io.keybase.ossifrage.components;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.ThemedReactContext;

@ReactModule(
    name = "KBAndroidTextInput"
)
public class KBTextInputManager extends com.facebook.react.views.textinput.ReactTextInputManager {
  @Override
  public KBTextInput createViewInstance(ThemedReactContext context) {
    KBTextInput editText = new KBTextInput(context);
    int inputType = editText.getInputType();
    editText.setInputType(inputType & -131073);
    editText.setReturnKeyType("done");
    editText.setTextSize(0, (float)((int)Math.ceil((double) PixelUtil.toPixelFromSP(14.0F))));
    return editText;
  }
}
