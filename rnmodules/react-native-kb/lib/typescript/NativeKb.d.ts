import type { TurboModule } from 'react-native';
export interface Spec extends TurboModule {
    readonly getConstants: () => {};
    getDefaultCountryCode(): string;
    logSend(status: string, feedback: string, sendLogs: boolean, sendMaxBytes: boolean, traceDir: string, cpuProfileDir: string): string;
    iosGetHasShownPushPrompt(): boolean;
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
    androidGetInitialBundleFromNotification(): any;
    androidGetInitialShareFileUrl(): string;
    androidGetInitialShareText(): string;
    engineReset(): void;
    engineStart(): void;
}
declare const _default: Spec;
export default _default;
//# sourceMappingURL=NativeKb.d.ts.map