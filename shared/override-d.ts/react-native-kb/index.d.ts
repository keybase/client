export declare const getDefaultCountryCode: () => Promise<string>;
export declare const logSend: (status: string, feedback: string, sendLogs: boolean, sendMaxBytes: boolean, traceDir: string, cpuProfileDir: string) => Promise<string>;
export declare const iosGetHasShownPushPrompt: () => Promise<boolean>;
