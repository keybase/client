export declare const copyToClipboard: (text: string) => void

export declare const dumpLogs: (reason?: string) => Promise<void>

export declare const filePickerError: (error: Error) => void

export declare const onEngineConnected: () => void

export declare const openAppSettings: () => void

export declare const openAppStore: () => void

export declare const persistRoute: (
  clear: boolean,
  immediate: boolean,
  isStartupLoaded: () => boolean
) => void

export declare const setOpenAtLoginInPlatform: (openAtLogin: boolean) => Promise<void>

export declare const showMain: () => void

export declare const showShareActionSheet: (
  filePath: string,
  message: string,
  mimeType: string
) => void
