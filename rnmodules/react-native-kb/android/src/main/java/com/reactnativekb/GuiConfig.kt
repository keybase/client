package com.reactnativekb

import androidx.annotation.Nullable

import org.json.JSONException
import org.json.JSONObject

import java.io.File

class GuiConfig private constructor(filesDir: File?) {
    private val filesDir: File?

    init {
        this.filesDir = filesDir
    }

    fun asString(): String? {
        val filePath = File(filesDir, "/.config/keybase/gui_config.json")
        return ReadFileAsString.read(filePath.getAbsolutePath())
    }

    fun getDarkMode(): DarkModePreference {
        return try {
            val jsonObject = JSONObject(asString())
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
