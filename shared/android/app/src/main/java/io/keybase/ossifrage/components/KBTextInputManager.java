package io.keybase.ossifrage.components;

import android.text.InputType;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.textinput.ReactEditText;

@ReactModule(
    name = "KBTextInput"
)
public class KBTextInputManager extends com.facebook.react.views.textinput.ReactTextInputManager {
  public static final String REACT_CLASS = "KBTextInput";

  @Override
  public String getName() {
    return REACT_CLASS;
  }
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
