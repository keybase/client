package com.reactnativekb;

public class DarkModePrefHelper {
  public static DarkModePreference fromString(String prefString) {
    switch (prefString) {
      case "alwaysDark":
        return DarkModePreference.AlwaysDark;
      case "alwaysLight":
        return DarkModePreference.AlwaysLight;
      default:
        return DarkModePreference.System;
    }
  }
}
