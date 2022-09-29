import { NativeModules, Platform } from 'react-native';
const LINKING_ERROR = `The package 'react-native-kb' doesn't seem to be linked. Make sure: \n\n` + Platform.select({
  ios: "- You have run 'pod install'\n",
  default: ''
}) + '- You rebuilt the app after installing the package\n' + '- You are not using Expo managed workflow\n';
const Kb = NativeModules.Kb ? NativeModules.Kb : new Proxy({}, {
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
export const iosGetHasShownPushPrompt = () => {
  if (Platform.OS === 'ios') {
    return Kb.iosGetHasShownPushPrompt();
  }

  return Promise.resolve(false);
};
export const iosLog = tagsAndLogs => {
  if (Platform.OS === 'ios') {
    Kb.iosLog(tagsAndLogs);
  }
};
export const logDump = prefix => {
  return Kb.logDump(prefix);
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
//# sourceMappingURL=index.js.map