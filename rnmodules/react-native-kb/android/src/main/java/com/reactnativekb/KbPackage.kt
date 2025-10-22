package com.reactnativekb

import androidx.annotation.Nullable

import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.TurboReactPackage
import com.facebook.react.uimanager.ViewManager

import java.util.HashMap
import java.util.Map

class KbPackage : TurboReactPackage() {
    @Nullable
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == KbModule.NAME) {
            KbModule(reactContext)
        } else {
            null
        }
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(
            PasteableTextInputViewManager(reactContext)
        )
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
            val isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            moduleInfos[KbModule.NAME] = ReactModuleInfo(
                    KbModule.NAME,
                    KbModule.NAME,
                    false, // canOverrideExistingModule
                    false, // needsEagerInit
                    true,  // hasConstants
                    false, // isCxxModule
                    isTurboModule // isTurboModule
            )
            moduleInfos
        }
    }
}
