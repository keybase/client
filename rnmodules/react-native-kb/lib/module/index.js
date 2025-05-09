import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
const LINKING_ERROR = `The package 'react-native-kb' doesn't seem to be linked. Make sure: \n\n` + Platform.select({
  ios: "- You have run 'pod install'\n",
  default: ''
}) + '- You rebuilt the app after installing the package\n' + '- You are not using Expo Go\n';

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null;
const KbModule = isTurboModuleEnabled ? require('./NativeKb').default : NativeModules.Kb;
const Kb = KbModule ? KbModule : new Proxy({}, {
  get() {
    throw new Error(LINKING_ERROR);
  }
});
export const getDefaultCountryCode = () => {
  return Kb.getDefaultCountryCode();
};
export const logSend = (status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir) => {
  return Kb.logSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir);
};
export const install = () => {
  Kb.install();
};
export const iosGetHasShownPushPrompt = () => {
  if (Platform.OS === 'ios') {
    return Kb.iosGetHasShownPushPrompt();
  }
  return Promise.resolve(false);
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
  return Promise.resolve(false);
};
export const androidGetSecureFlagSetting = () => {
  if (Platform.OS === 'android') {
    return Kb.androidGetSecureFlagSetting();
  }
  return Promise.resolve(false);
};
export const androidShareText = (text, mimeType) => {
  if (Platform.OS === 'android') {
    return Kb.androidShareText(text, mimeType);
  }
  return Promise.resolve(false);
};
export const androidShare = (text, mimeType) => {
  if (Platform.OS === 'android') {
    return Kb.androidShare(text, mimeType);
  }
  return Promise.resolve(false);
};
export const androidCheckPushPermissions = () => {
  if (Platform.OS === 'android') {
    return Kb.androidCheckPushPermissions();
  }
  return Promise.resolve(false);
};
export const androidRequestPushPermissions = () => {
  if (Platform.OS === 'android') {
    return Kb.androidRequestPushPermissions();
  }
  return Promise.resolve(false);
};
export const androidGetRegistrationToken = () => {
  if (Platform.OS === 'android') {
    return Kb.androidGetRegistrationToken();
  }
  return Promise.resolve('');
};
export const androidUnlink = path => {
  if (Platform.OS === 'android') {
    return Kb.androidUnlink(path);
  }
  return Promise.reject();
};
export const androidAddCompleteDownload = o => {
  if (Platform.OS === 'android') {
    return Kb.androidAddCompleteDownload(o);
  }
  return Promise.reject();
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
export const engineReset = () => {
  return Kb.engineReset();
};
export const engineStart = () => {
  return Kb.engineStart();
};
export const shareListenersRegistered = () => {
  return Kb.shareListenersRegistered();
};
export const getNativeEmitter = () => {
  return new NativeEventEmitter(Kb);
};
const KBC = Kb.getTypedConstants();
export const androidIsDeviceSecure = KBC.androidIsDeviceSecure;
export const androidIsTestDevice = KBC.androidIsTestDevice;
export const appVersionCode = KBC.appVersionCode;
export const appVersionName = KBC.appVersionName;
export const darkModeSupported = KBC.darkModeSupported;
export const fsCacheDir = KBC.fsCacheDir;
export const fsDownloadDir = KBC.fsDownloadDir;
export const guiConfig = KBC.guiConfig;
export const serverConfig = KBC.serverConfig;
export const uses24HourClock = KBC.uses24HourClock;
export const version = KBC.version;
//# sourceMappingURL=index.js.map