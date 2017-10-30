package io.keybase.ossifrage.components;

import android.text.InputType;
import android.util.TypedValue;

import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewDefaults;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.textinput.ReactTextInputManager;

import io.keybase.ossifrage.components.CustomTextInput;

public class CustomTextInputManager extends ReactTextInputManager {

    @Override
    public String getName() {
        return "CustomTextInput";
    }

    @Override
    public CustomTextInput createViewInstance(ThemedReactContext context) {
        CustomTextInput editText = new CustomTextInput(context);
        int inputType = editText.getInputType();
        editText.setInputType(inputType & (~InputType.TYPE_TEXT_FLAG_MULTI_LINE));
        editText.setReturnKeyType("done");
        editText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX,
          (int) Math.ceil(PixelUtil.toPixelFromSP(ViewDefaults.FONT_SIZE_SP)));
        return editText;
    }

    @ReactProp(name = "autoScroll", defaultBoolean = false)
    public void setAutoScroll(CustomTextInput view, boolean autoScroll) {
        view.setAutoScroll(autoScroll);
    }
}