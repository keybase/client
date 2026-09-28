import * as ExpoLocation from 'expo-location'
import * as ExpoTaskManager from 'expo-task-manager'
import * as ExpoNetwork from 'expo-network'
import {Linking} from 'react-native'
import {setupAudioMode} from '@/util/audio.native'
import {requestLocationPermission} from '@/util/platform-specific'
import {
  addLocationFixListener,
  fsCacheDir,
  fsDownloadDir,
  guiConfig,
  shareListenersRegistered,
  startLocationWatch,
  stopLocationWatch,
} from 'react-native-kb'
import type {DesktopModules, NativeModules, NativeSyncModules, NetworkModule} from './platform-types'
import type {ConnectionType} from '@/stores/shell'
import logger from '@/logger'

// expo-network reports uppercase enum values; Go expects the lowercase names
const toConnectionType = (type: ExpoNetwork.NetworkStateType | undefined): ConnectionType =>
  (type ?? ExpoNetwork.NetworkStateType.UNKNOWN).toLowerCase() as ConnectionType

const Network: NetworkModule = {
  addConnectionTypeListener: cb => {
    let gotEvent = false
    const sub = ExpoNetwork.addNetworkStateListener(({type}) => {
      gotEvent = true
      cb(toConnectionType(type))
    })
    // The native listener doesn't always fire on subscribe (Android when offline), so seed it
    ExpoNetwork.getNetworkStateAsync()
      .then(({type}) => {
        if (!gotEvent) cb(toConnectionType(type))
      })
      .catch((e: unknown) => logger.warn(`Network state fetch failed: ${String(e)}`))
    return () => sub.remove()
  },
  getConnectionType: async () => toConnectionType((await ExpoNetwork.getNetworkStateAsync()).type),
}

export const getNative = (): NativeModules =>
  ({
    ExpoLocation,
    ExpoTaskManager,
    Linking,
    Network,
    addLocationFixListener,
    fsCacheDir,
    fsDownloadDir,
    guiConfig,
    requestLocationPermission,
    setupAudioMode,
    shareListenersRegistered,
    startLocationWatch,
    stopLocationWatch,
  }) as unknown as NativeModules

export const getNativeSync = (): NativeSyncModules =>
  ({
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
