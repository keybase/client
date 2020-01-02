package io.keybase.ossifrage.util;

import androidx.annotation.Nullable;

import org.json.JSONException;
import org.json.JSONObject;

import io.keybase.ossifrage.DarkModePrefHelper;
import io.keybase.ossifrage.DarkModePreference;
import io.keybase.ossifrage.modules.NativeLogger;

import java.io.File;

public class GuiConfig {
  private static GuiConfig singletonInstance = null;

  private File filesDir;

  private GuiConfig(File filesDir) {
    this.filesDir = filesDir;
  }

  public static GuiConfig getInstance(File filesDir) {
    if (singletonInstance == null) {
      singletonInstance = new GuiConfig(filesDir);
    }
    return singletonInstance;
  }


  public String asString() {
    File filePath = new File(this.filesDir, "/.config/keybase/gui_config.json");
    return ReadFileAsString.read(filePath.getAbsolutePath());
  }

  public DarkModePreference getDarkMode() {
    try {
      JSONObject jsonObject = new JSONObject(this.asString());
      JSONObject jsonObjectUI = jsonObject.getJSONObject("ui");

      String darkModeString = jsonObjectUI.getString("darkMode");
      return DarkModePrefHelper.fromString(darkModeString);
    } catch (JSONException e) {
      NativeLogger.error("Error in getting Dark Mode", e);
      return DarkModePreference.System;
    }
  }
}