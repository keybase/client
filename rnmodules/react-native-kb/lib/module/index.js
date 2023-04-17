import { Platform, NativeEventEmitter } from 'react-native';
const Kb = require('./NativeKb').default;
export const getDefaultCountryCode = () => {
  return Kb.getDefaultCountryCode();
};
export const logSend = (status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir) => {
  return Kb.logSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir);
};
export const iosGetHasShownPushPrompt = () => {
  if (Platform.OS === 'ios') {
    return Kb.iosGetHasShownPushPrompt();
  }
  return false;
};
export const androidOpenSettings = () => {
  if (Platform.OS === 'android') {
    Kb.androidOpenSettings();
  }
};
export const androidSetSecureFlagSetting = s => {
  if (Platform.OS === 'android') {
    return Kb.androidSetSecureFlagSetting(s);
  }
  return false;
};
export const androidGetSecureFlagSetting = () => {
  if (Platform.OS === 'android') {
    return Kb.androidGetSecureFlagSetting();
  }
  return false;
};
export const androidShareText = (text, mimeType) => {
  if (Platform.OS === 'android') {
    return Kb.androidShareText(text, mimeType);
  }
  return false;
};
export const androidShare = (text, mimeType) => {
  if (Platform.OS === 'android') {
    return Kb.androidShare(text, mimeType);
  }
  return false;
};
export const androidCheckPushPermissions = () => {
  if (Platform.OS === 'android') {
    return Kb.androidCheckPushPermissions();
  }
  return false;
};
export const androidRequestPushPermissions = () => {
  if (Platform.OS === 'android') {
    return Kb.androidRequestPushPermissions();
  }
  return false;
};
export const androidGetRegistrationToken = () => {
  if (Platform.OS === 'android') {
    return Kb.androidGetRegistrationToken();
  }
  return '';
};
export const androidUnlink = path => {
  if (Platform.OS === 'android') {
    return Kb.androidUnlink(path);
  }
};
export const androidAddCompleteDownload = o => {
  if (Platform.OS === 'android') {
    return Kb.androidAddCompleteDownload(o);
  }
};
export const androidAppColorSchemeChanged = mode => {
  if (Platform.OS === 'android') {
    Kb.androidAppColorSchemeChanged(mode);
  }
};
export const androidSetApplicationIconBadgeNumber = n => {
  if (Platform.OS === 'android') {
    Kb.androidSetApplicationIconBadgeNumber(n);
  }
};
export const androidGetInitialBundleFromNotification = () => {
  if (Platform.OS === 'android') {
    return Kb.androidGetInitialBundleFromNotification();
  }
  return null;
};
export const androidGetInitialShareFileUrl = () => {
  if (Platform.OS === 'android') {
    return Kb.androidGetInitialShareFileUrl();
  }
  return '';
};
export const androidGetInitialShareText = () => {
  if (Platform.OS === 'android') {
    return Kb.androidGetInitialShareText();
  }
  return '';
};
export const engineReset = () => {
  return Kb.engineReset();
};
export const engineStart = () => {
  return Kb.engineStart();
};
export const getNativeEmitter = () => {
  return new NativeEventEmitter(Kb);
};
export const androidIsDeviceSecure = Kb.getConstants().androidIsDeviceSecure;
export const androidIsTestDevice = Kb.getConstants().androidIsTestDevice;
export const appVersionCode = Kb.getConstants().appVersionCode;
export const appVersionName = Kb.getConstants().appVersionCode;
export const darkModeSupported = Kb.getConstants().darkModeSupported;
export const fsCacheDir = Kb.getConstants().fsCacheDir;
export const fsDownloadDir = Kb.getConstants().fsDownloadDir;
export const guiConfig = Kb.getConstants().guiConfig;
export const serverConfig = Kb.getConstants().serverConfig;
export const uses24HourClock = Kb.getConstants().uses24HourClock;
export const version = Kb.getConstants().version;
//# sourceMappingURL=index.js.map