package com.reactnativedropview

import android.view.View
import com.facebook.react.uimanager.ViewGroupManager
import android.widget.FrameLayout

abstract class DropViewViewManagerSpec<T : FrameLayout> : ViewGroupManager<T>()
