// copied over from rnmodules and edited
import {NativeEventEmitter} from 'react-native'
export declare const getDefaultCountryCode: () => Promise<string>
export declare const logSend: (
  status: string,
  feedback: string,
  sendLogs: boolean,
  sendMaxBytes: boolean,
  traceDir: string,
  cpuProfileDir: string
) => Promise<string>
export declare const iosGetHasShownPushPrompt: () => Promise<boolean>
export declare const androidOpenSettings: () => void
export declare const androidSetSecureFlagSetting: (s: boolean) => Promise<boolean>
export declare const androidGetSecureFlagSetting: () => Promise<boolean>
export declare const androidShareText: (text: string, mimeType: string) => Promise<boolean>
export declare const androidShare: (text: string, mimeType: string) => Promise<boolean>
export declare const androidCheckPushPermissions: () => Promise<boolean>
export declare const androidRequestPushPermissions: () => Promise<boolean>
export declare const androidGetRegistrationToken: () => Promise<string>
export declare const androidUnlink: (path: string) => Promise<void>
export declare const androidAddCompleteDownload: (o: {
  description: string
  mime: string
  path: string
  showNotification: boolean
  title: string
}) => Promise<void>
export declare const androidAppColorSchemeChanged: (
  mode: 'system' | 'alwaysDark' | 'alwaysLight' | ''
) => void
export declare const androidSetApplicationIconBadgeNumber: (n: number) => void
export declare const androidGetInitialBundleFromNotification: () => Promise<any>
export declare const androidGetInitialShareFileUrls: () => Promise<Array<string>>
export declare const androidGetInitialShareText: () => Promise<string>
export declare const engineReset: () => void
export declare const engineStart: () => void
export declare const getNativeEmitter: () => NativeEventEmitter
export declare const androidIsDeviceSecure: boolean
export declare const androidIsTestDevice: boolean
export declare const appVersionCode: string
export declare const appVersionName: string
export declare const darkModeSupported: boolean
export declare const fsCacheDir: string
export declare const fsDownloadDir: string
export declare const guiConfig: string
export declare const serverConfig: string
export declare const uses24HourClock: boolean
export declare const version: string
//# sourceMappingURL=index.d.ts.map
