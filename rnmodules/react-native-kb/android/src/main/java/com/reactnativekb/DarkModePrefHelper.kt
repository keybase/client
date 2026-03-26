package com.reactnativekb

object DarkModePrefHelper {
    fun fromString(prefString: String): DarkModePreference {
        return when (prefString) {
            "alwaysDark" -> DarkModePreference.AlwaysDark
            "alwaysLight" -> DarkModePreference.AlwaysLight
            else -> DarkModePreference.System
        }
    }
}
