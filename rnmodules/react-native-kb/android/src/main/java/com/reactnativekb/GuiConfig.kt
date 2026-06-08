package com.reactnativekb

import org.json.JSONException
import org.json.JSONObject

import java.io.File

class GuiConfig private constructor(private val filesDir: File?) {
    fun asString(): String? {
        val filePath = File(filesDir, "/.config/keybase/gui_config.json")
        return ReadFileAsString.read(filePath.absolutePath)
    }

    fun getDarkMode(): DarkModePreference {
        return try {
            val jsonObject = JSONObject(asString() ?: return DarkModePreference.System)
            val jsonObjectUI: JSONObject = jsonObject.getJSONObject("ui")
            val darkModeString: String = jsonObjectUI.getString("darkMode")
            DarkModePrefHelper.fromString(darkModeString)
        } catch (e: JSONException) {
            DarkModePreference.System
        }
    }

    companion object {
        private var singletonInstance: GuiConfig? = null
        fun getInstance(filesDir: File?): GuiConfig? {
            if (singletonInstance == null) {
                singletonInstance = GuiConfig(filesDir)
            }
            return singletonInstance
        }
    }
}
