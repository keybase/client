import KB2 from '@/util/electron'
import InputMonitor from '@/util/platform-specific/input-monitor.desktop'
import {kbfsNotification} from '@/util/platform-specific/kbfs-notifications'
import {skipAppFocusActions} from '@/local-debug'
import {isLinux, isWindows} from '@/constants/platform'
import type {DesktopModules, NativeModules, NativeSyncModules} from './platform-types'

export const getDesktop = (): DesktopModules =>
  ({
    InputMonitor,
    KB2,
    isLinux,
    isWindows,
    kbfsNotification,
    skipAppFocusActions,
  }) as unknown as DesktopModules

export {maybePauseVideos, setupWindowEventListeners} from './desktop-dom-helpers.desktop'
// push notifications are native-only.
export const initPushListener = (): void => {}

const notOnDesktop = (name: string): never => {
  throw new Error(`init/${name} called on desktop`)
}
export const getNative = (): NativeModules => notOnDesktop('getNative')
export const getNativeSync = (): NativeSyncModules => notOnDesktop('getNativeSync')
