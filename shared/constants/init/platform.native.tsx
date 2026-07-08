/// <reference types="webpack-env" />
import type {
  DesktopModules,
  ExpoLocationModule,
  ExpoTaskManagerModule,
  NativeModules,
  NativeSyncModules,
  NetInfoModule,
} from './platform-types'

type RNKB = {
  fsCacheDir: string
  fsDownloadDir: string
  androidAppColorSchemeChanged: (mode: string) => void
  guiConfig: string
  shareListenersRegistered: () => void
}

// Use require() instead of import so Metro doesn't trigger importAll (which iterates
// all lazy getters, including native modules, before they're registered).
export const getNative = (): NativeModules => {
  const ExpoLocation = require('expo-location') as ExpoLocationModule
  const ExpoTaskManager = require('expo-task-manager') as ExpoTaskManagerModule
  const NetInfo = require('@react-native-community/netinfo') as NetInfoModule
  const {Linking} = require('react-native') as {Linking: {getInitialURL: () => Promise<string | null>}}
  const {setupAudioMode} = require('@/util/audio.native') as {
    setupAudioMode: (allowRecord: boolean) => Promise<void>
  }
  const {requestLocationPermission} = require('@/util/platform-specific') as {
    requestLocationPermission: (perm?: unknown) => Promise<void>
  }
  const {fsCacheDir, fsDownloadDir, androidAppColorSchemeChanged, guiConfig, shareListenersRegistered} =
    require('react-native-kb') as RNKB
  return {
    ExpoLocation,
    ExpoTaskManager,
    Linking,
    NetInfo,
    androidAppColorSchemeChanged,
    fsCacheDir,
    fsDownloadDir,
    guiConfig,
    requestLocationPermission,
    setupAudioMode,
    shareListenersRegistered,
  }
}

export const getNativeSync = (): NativeSyncModules => {
  const {fsCacheDir, fsDownloadDir, androidAppColorSchemeChanged, guiConfig, shareListenersRegistered} =
    require('react-native-kb') as RNKB
  return {androidAppColorSchemeChanged, fsCacheDir, fsDownloadDir, guiConfig, shareListenersRegistered}
}

export {initPushListener} from './push-listener.native'
// DOM helpers are desktop-only.
export const maybePauseVideos = (): void => {}
export const setupWindowEventListeners = (
  _onFocus: () => void,
  _onBlur: () => void,
  _onOnline: () => void,
  _onOffline: () => void
): void => {}

export const getDesktop = (): DesktopModules => {
  throw new Error('init/getDesktop called on native')
}
