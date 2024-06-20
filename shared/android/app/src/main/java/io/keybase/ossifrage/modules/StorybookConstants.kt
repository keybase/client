package io.keybase.ossifrage.modules

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import io.keybase.ossifrage.BuildConfig

class StorybookConstants(reactContext: ReactApplicationContext?) : ReactContextBaseJavaModule(reactContext) {
    override fun getConstants(): Map<String, Any>? {
        val isStoryBook = BuildConfig.BUILD_TYPE === "storyBook"
        val constants: MutableMap<String, Any> = HashMap()
        constants["isStorybook"] = isStoryBook
        return constants
    }

    override fun getName(): String {
        return "Storybook"
    }
}
