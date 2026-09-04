import {TurboModuleRegistry, type TurboModule} from 'react-native'
import type {EventEmitter, UnsafeObject} from 'react-native/Libraries/Types/CodegenTypes'

export interface Spec extends TurboModule {
  readonly onMetaEvent: EventEmitter<string>
  readonly onHardwareKeyPressed: EventEmitter<string>
  readonly onPasteImage: EventEmitter<Array<string>>
  readonly onPushNotification: EventEmitter<UnsafeObject>
  readonly onPushToken: EventEmitter<string>
  readonly onShareData: EventEmitter<{text?: string; localPaths?: Array<string>}>
  getTypedConstants(): {
    androidIsDeviceSecure: boolean
    androidIsTestDevice: boolean
    appVersionCode: string
    appVersionName: string
    darkModeSupported: boolean
    fsCacheDir: string
    fsDownloadDir: string
    guiConfig: string
    serverConfig: string
    uses24HourClock: boolean
    version: string
  }
  logSend(
    status: string,
    feedback: string,
    sendLogs: boolean,
    sendMaxBytes: boolean,
    traceDir: string,
    cpuProfileDir: string
  ): Promise<string>
  iosGetHasShownPushPrompt(): Promise<boolean>
  // iOS only: the Android impl rejects, so call the processMedia wrapper in
  // index.tsx rather than this directly — it hands the path back untouched off
  // iOS. startMs/endMs are the trim range, both 0 meaning the whole clip
  // (codegen only allows plain types here, so no nullable).
  processMedia(
    path: string,
    isVideo: boolean,
    compress: boolean,
    startMs: number,
    endMs: number,
    removeAudio: boolean
  ): Promise<string>
  // iOS only: presents the system share sheet for a local file. `text` is the
  // file's contents when it is worth offering as text, '' otherwise (codegen
  // has no optional string). Resolves true when an activity ran.
  iosShareFile(path: string, text: string): Promise<boolean>
  androidShareText(text: string, mimeType: string): Promise<boolean>
  androidShare(text: string, mimeType: string): Promise<boolean>
  androidAddCompleteDownload(o: {
    description: string
    mime: string
    path: string
    showNotification: boolean
    title: string
  }): Promise<void>
  androidAppColorSchemeChanged(mode: string /*'system' | 'alwaysDark' | 'alwaysLight' | ''*/): void
  checkPushPermissions(): Promise<boolean>
  requestPushPermissions(): Promise<boolean>
  getRegistrationToken(): Promise<string>
  setApplicationIconBadgeNumber(n: number): void
  getInitialNotification(): Promise<object | null>
  removeAllPendingNotificationRequests(): void
  addNotificationRequest(config: {body: string; id: string}): Promise<void>
  engineReset(): void
  notifyJSReady(): void
  shareListenersRegistered(): void
  setEnablePasteImage(enabled: boolean): void
  clearLocalLogs(): Promise<void>
}

export default TurboModuleRegistry.getEnforcing<Spec>('Kb')
