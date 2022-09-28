import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
    `The package 'react-native-kb' doesn't seem to be linked. Make sure: \n\n` +
    Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
    '- You rebuilt the app after installing the package\n' +
    '- You are not using Expo managed workflow\n';

const Kb = NativeModules.Kb ? NativeModules.Kb : new Proxy(
    {},
    {
        get() {
            throw new Error(LINKING_ERROR);
        },
    }
)

export const getDefaultCountryCode = (): Promise<string> => {
    return Kb.getDefaultCountryCode()
}

export const logSend = (
    status: string,
    feedback: string,
    sendLogs: boolean,
    sendMaxBytes: boolean,
    traceDir: string,
    cpuProfileDir: string
): Promise<string> => {
    return Kb.logSend(
        status,
        feedback,
        sendLogs,
        sendMaxBytes,
        traceDir,
        cpuProfileDir,
    )
}
