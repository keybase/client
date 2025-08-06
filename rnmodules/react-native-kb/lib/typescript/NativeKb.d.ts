import { type TurboModule } from 'react-native';
export interface Spec extends TurboModule {
    install: () => boolean;
    addListener: (eventType: string) => void;
    removeListeners: (count: number) => void;
    getTypedConstants(): {
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
    getDefaultCountryCode(): Promise<string>;
    logSend(status: string, feedback: string, sendLogs: boolean, sendMaxBytes: boolean, traceDir: string, cpuProfileDir: string): Promise<string>;
    iosGetHasShownPushPrompt(): Promise<boolean>;
    androidOpenSettings(): void;
    androidSetSecureFlagSetting(s: boolean): Promise<boolean>;
    androidGetSecureFlagSetting(): Promise<boolean>;
    androidShareText(text: string, mimeType: string): Promise<boolean>;
    androidShare(text: string, mimeType: string): Promise<boolean>;
    androidCheckPushPermissions(): Promise<boolean>;
    androidRequestPushPermissions(): Promise<boolean>;
    androidGetRegistrationToken(): Promise<string>;
    androidUnlink(path: string): Promise<void>;
    androidAddCompleteDownload(o: {
        description: string;
        mime: string;
        path: string;
        showNotification: boolean;
        title: string;
    }): Promise<void>;
    androidAppColorSchemeChanged(mode: string): void;
    androidSetApplicationIconBadgeNumber(n: number): void;
    engineReset(): void;
    engineStart(): void;
    shareListenersRegistered(): void;
}
declare const _default: Spec;
export default _default;
//# sourceMappingURL=NativeKb.d.ts.map