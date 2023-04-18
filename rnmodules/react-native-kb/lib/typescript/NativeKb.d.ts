import type { TurboModule } from 'react-native';
export interface Spec extends TurboModule {
    addListener: (eventType: string) => void;
    removeListeners: (count: number) => void;
    getConstants(): {
        androidIsDeviceSecure: boolean;
        androidIsTestDevice: boolean;
        appVersionCode: string;
        appVersionName: string;
        darkModeSupported: boolean;
        fsCacheDir: string;
        fsDownloadDir: string;
        guiConfig: string;
        serverConfig: string;
        uses24HourClock: boolean;
        version: string;
    };
    getDefaultCountryCode(): string;
    logSend(status: string, feedback: string, sendLogs: boolean, sendMaxBytes: boolean, traceDir: string, cpuProfileDir: string): string;
    iosGetHasShownPushPrompt(): Promise<boolean>;
    androidOpenSettings(): void;
    androidSetSecureFlagSetting(s: boolean): boolean;
    androidGetSecureFlagSetting(): boolean;
    androidShareText(text: string, mimeType: string): boolean;
    androidShare(text: string, mimeType: string): boolean;
    androidCheckPushPermissions(): boolean;
    androidRequestPushPermissions(): boolean;
    androidGetRegistrationToken(): string;
    androidUnlink(path: string): void;
    androidAddCompleteDownload(o: {
        description: string;
        mime: string;
        path: string;
        showNotification: boolean;
        title: string;
    }): void;
    androidAppColorSchemeChanged(mode: string): void;
    androidSetApplicationIconBadgeNumber(n: number): void;
    androidGetInitialBundleFromNotification(): string;
    androidGetInitialShareFileUrl(): string;
    androidGetInitialShareText(): string;
    engineReset(): void;
    engineStart(): void;
}
declare const _default: Spec;
export default _default;
//# sourceMappingURL=NativeKb.d.ts.map