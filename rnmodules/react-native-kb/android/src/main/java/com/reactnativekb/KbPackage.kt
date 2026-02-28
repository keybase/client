package com.reactnativekb

import androidx.annotation.Nullable

import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.TurboReactPackage

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

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
            val isTurboModule = true
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
