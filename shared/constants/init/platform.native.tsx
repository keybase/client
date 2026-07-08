import * as ExpoLocation from 'expo-location'
import * as ExpoTaskManager from 'expo-task-manager'
import NetInfo, {NetInfoStateType} from '@react-native-community/netinfo'
import {Linking} from 'react-native'
import {setupAudioMode} from '@/util/audio.native'
import {requestLocationPermission} from '@/util/platform-specific'
import {
  fsCacheDir,
  fsDownloadDir,
  androidAppColorSchemeChanged,
  guiConfig,
  shareListenersRegistered,
} from 'react-native-kb'
import type {DesktopModules, NativeModules, NativeSyncModules} from './platform-types'

export const getNative = (): NativeModules =>
  ({
    ExpoLocation,
    ExpoTaskManager,
    Linking,
    // NetInfoStateType is a named export, not part of the default export; merge
    // it in so consumers can read NetInfo.NetInfoStateType (default-import under
    // ESM drops named exports that require() used to expose).
    NetInfo: {...NetInfo, NetInfoStateType},
    androidAppColorSchemeChanged,
    fsCacheDir,
    fsDownloadDir,
    guiConfig,
    requestLocationPermission,
    setupAudioMode,
    shareListenersRegistered,
  }) as unknown as NativeModules

export const getNativeSync = (): NativeSyncModules =>
  ({
    androidAppColorSchemeChanged,
    fsCacheDir,
    fsDownloadDir,
    guiConfig,
    shareListenersRegistered,
  }) as unknown as NativeSyncModules

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
