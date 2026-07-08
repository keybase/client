// Shared types for the platform-split init helpers (platform.desktop / platform.native).
import type {KB2} from '@/util/electron'
import type {ConnectionType} from '@/stores/shell'

export type ExpoLocationObject = {coords: {accuracy: number | null; latitude: number; longitude: number}}
export type ExpoLocationModule = {
  startLocationUpdatesAsync: (taskName: string, options: object) => Promise<void>
  stopLocationUpdatesAsync: (taskName: string) => Promise<void>
}
export type NetInfoModule = {
  fetch: () => Promise<{type: ConnectionType}>
  addEventListener: (cb: (state: {type: ConnectionType}) => void) => () => void
  NetInfoStateType: {none: ConnectionType}
}
export type ExpoTaskManagerModule = {
  defineTask: (taskName: string, cb: (params: {data: unknown; error: unknown}) => Promise<void>) => void
}

export type DesktopModules = {
  InputMonitor: new () => {notifyActive: (userActive: boolean) => void}
  KB2: KB2
  isLinux: boolean
  isWindows: boolean
  kbfsNotification: (
    notification: unknown,
    np: (title: string, opts?: {body?: string; sound?: boolean}, onClick?: () => void) => void
  ) => void
  skipAppFocusActions: boolean
}

export type NativeModules = {
  ExpoLocation: ExpoLocationModule
  ExpoTaskManager: ExpoTaskManagerModule
  Linking: {getInitialURL: () => Promise<string | null>}
  NetInfo: NetInfoModule
  androidAppColorSchemeChanged: (mode: string) => void
  fsCacheDir: string
  fsDownloadDir: string
  guiConfig: string
  requestLocationPermission: (perm?: unknown) => Promise<void>
  setupAudioMode: (allowRecord: boolean) => Promise<void>
  shareListenersRegistered: () => void
}

export type NativeSyncModules = {
  androidAppColorSchemeChanged: (mode: string) => void
  fsCacheDir: string
  fsDownloadDir: string
  guiConfig: string
  shareListenersRegistered: () => void
}
