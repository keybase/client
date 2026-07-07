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
