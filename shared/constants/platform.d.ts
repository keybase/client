import {DarkModePreference} from 'styles/dark-mode'

export const runMode: string

export const isMobile: boolean
export const isAndroid: boolean
export const isIOS: boolean
export const isLargeScreen: boolean
export const isTablet: boolean
export const isPhone: boolean

export const isElectron: boolean
export const isDarwin: boolean
export const isWindows: boolean
export const isLinux: boolean
export const isIPhoneX: boolean
export const isMac: boolean

export const isAndroidNewerThanN: boolean
export const defaultUseNativeFrame: boolean
export const isTestDevice: boolean
export const isRemoteDebuggerAttached: boolean

export declare const downloadFolder: string
export declare const fileUIName: string
export declare const version: string
export declare const pprofDir: string
export declare const serverConfigFileName: string
export declare const shortcutSymbol: string
export declare const realDeviceName: string
export const appColorSchemeChanged: (pref: DarkModePreference) => void
