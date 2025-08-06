package com.reactnativedropview

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

@ReactModule(name = DropViewViewManager.NAME)
class DropViewViewManager :
        DropViewViewManagerSpec<DropViewView>() {
    override fun getName(): String {
        return NAME
    }

    public override fun createViewInstance(context: ThemedReactContext): DropViewView {
        return DropViewView(context)
    }

    companion object {
        const val NAME = "DropViewView"
    }
}

