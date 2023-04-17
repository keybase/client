import type {TurboModule} from 'react-native'
import {TurboModuleRegistry} from 'react-native'

export interface Spec extends TurboModule {
  readonly getConstants: () => {}
  getDefaultCountryCode(): string
  logSend(
    status: string,
    feedback: string,
    sendLogs: boolean,
    sendMaxBytes: boolean,
    traceDir: string,
    cpuProfileDir: string
  ): string
  iosGetHasShownPushPrompt(): boolean
  androidOpenSettings(): void
  androidSetSecureFlagSetting(s: boolean): boolean
  androidGetSecureFlagSetting(): boolean
  androidShareText(text: string, mimeType: string): boolean
  androidShare(text: string, mimeType: string): boolean
  androidCheckPushPermissions(): boolean
  androidRequestPushPermissions(): boolean
  androidGetRegistrationToken(): string
  androidUnlink(path: string): void
  androidAddCompleteDownload(o: {
    description: string
    mime: string
    path: string
    showNotification: boolean
    title: string
  }): void
  androidAppColorSchemeChanged(mode: string /*'system' | 'alwaysDark' | 'alwaysLight' | ''*/): void
  androidSetApplicationIconBadgeNumber(n: number): void
  androidGetInitialBundleFromNotification(): string
  androidGetInitialShareFileUrl(): string
  androidGetInitialShareText(): string
  engineReset(): void
  engineStart(): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('Kb')
