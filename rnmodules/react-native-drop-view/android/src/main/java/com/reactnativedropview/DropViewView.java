package com.reactnativedropview;

import androidx.annotation.Nullable;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import android.content.Context;
import android.util.AttributeSet;
import com.facebook.react.uimanager.ViewGroupManager;
import com.facebook.react.uimanager.ThemedReactContext;
import android.view.View;

public class DropViewView extends FrameLayout {
  public DropViewView(Context context) {
    super(context);
  }

  public DropViewView(Context context, @Nullable AttributeSet attrs) {
    super(context, attrs);
  }

  public DropViewView(Context context, @Nullable AttributeSet attrs, int defStyleAttr) {
    super(context, attrs, defStyleAttr);
  }

}
