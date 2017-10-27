package io.keybase.ossifrage.components;

import android.content.Context;
import android.text.InputType;

import com.facebook.react.views.textinput.ReactEditText;

public class CustomTextInput extends ReactEditText {
    private boolean autoScroll = false;

    public CustomTextInput(Context context) {
        super(context);
    }

    private boolean isMultiline() {
        return (getInputType() & InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0;
    }

    @Override
    public boolean isLayoutRequested() {
        if (isMultiline() && !autoScroll) {
            return true;
        }
        return false;
    }

    public void setAutoScroll(boolean autoScroll) {
        this.autoScroll = autoScroll;
    }
}