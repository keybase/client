package com.reactnativedropview

import android.view.View
import android.widget.FrameLayout
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.DropViewViewManagerDelegate
import com.facebook.react.viewmanagers.DropViewViewManagerInterface
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.soloader.SoLoader

abstract class DropViewViewManagerSpec<T : FrameLayout> : ViewGroupManager<T>(), DropViewViewManagerInterface<T> {
    private val mDelegate: ViewManagerDelegate<T>

    init {
        mDelegate = DropViewViewManagerDelegate(this)
    }

    override fun getDelegate(): ViewManagerDelegate<T>? {
        return mDelegate
    }

}
