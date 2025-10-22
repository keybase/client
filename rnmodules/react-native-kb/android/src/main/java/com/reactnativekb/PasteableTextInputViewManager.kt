package com.reactnativekb

import android.view.View
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.PasteableTextInputManagerInterface
import com.facebook.react.viewmanagers.PasteableTextInputManagerDelegate

@ReactModule(name = PasteableTextInputViewManager.REACT_CLASS)
class PasteableTextInputViewManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<PasteableTextInputView>(),
    PasteableTextInputManagerInterface<PasteableTextInputView> {

    private val delegate: ViewManagerDelegate<PasteableTextInputView>

    init {
        delegate = PasteableTextInputManagerDelegate(this)
    }

    override fun getDelegate(): ViewManagerDelegate<PasteableTextInputView>? {
        return delegate
    }

    override fun getName(): String {
        return REACT_CLASS
    }

    override fun createViewInstance(reactContext: ThemedReactContext): PasteableTextInputView {
        return PasteableTextInputView(reactContext)
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any>? {
        return MapBuilder.of(
            "topPasteImage",
            MapBuilder.of("registrationName", "onPasteImage")
        )
    }

    @ReactProp(name = "placeholder")
    override fun setPlaceholder(view: PasteableTextInputView, value: String?) {
        view.setPlaceholder(value)
    }

    @ReactProp(name = "multiline")
    override fun setMultiline(view: PasteableTextInputView, value: Boolean) {
        // Already handled in view
    }

    @ReactProp(name = "autoFocus")
    override fun setAutoFocus(view: PasteableTextInputView, value: Boolean) {
        if (value) {
            view.requestFocus()
        }
    }

    companion object {
        const val REACT_CLASS = "PasteableTextInput"
    }
}

