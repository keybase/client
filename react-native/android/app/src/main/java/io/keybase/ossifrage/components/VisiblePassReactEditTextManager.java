package io.keybase.ossifrage.components;

import android.text.InputType;

import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.textinput.ReactEditText;
import com.facebook.react.views.textinput.ReactTextInputManager;

public class VisiblePassReactEditTextManager extends ReactTextInputManager {

    // I can't get the staged input type so this won't unset any staged flags
    private static void updateStagedInputTypeFlag(
      ReactEditText view,
      int flagsToUnset,
      int flagsToSet) {
        view.setInputType((view.getInputType() & ~flagsToUnset) | flagsToSet);
    }

    @ReactProp(name = "passwordVisible", defaultBoolean = false)
    public void setPasswordVisible(ReactEditText view, boolean passwordVisible) {
        updateStagedInputTypeFlag(
          view,
          passwordVisible ? 0 : InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
          passwordVisible ? InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD : 0);
    }
}
