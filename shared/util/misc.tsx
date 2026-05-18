import debounce from 'lodash/debounce'
import logger from '@/logger'
import {navigateAppend} from '@/constants/router'
import type {OpenDialogOptions, SaveDialogOptions} from './electron'
import type {ImageInfo} from './expo-image-picker'

// ─── Desktop imports (runtime-guarded) ────────────────────────────────────

type KB2Functions = {
  openURL?: (url: string, options?: {activate: boolean}) => Promise<void>
  showOpenDialog?: (options: OpenDialogOptions) => Promise<Array<string>>
  showSaveDialog?: (options: SaveDialogOptions) => Promise<string>
}

const _getDesktopFunctions = (): KB2Functions =>
  (require('./electron') as {default: {functions: KB2Functions}}).default.functions

// ─── openURL ────────────────────────────────────────────────────────────────

export const openURL = async (url?: string): Promise<void> => {
  if (!url) {
    console.log('Skipping null url click')
    return
  }
  if (isMobile) {
    const {Linking} = require('react-native') as {Linking: {openURL: (url: string) => Promise<void>}}
    Linking.openURL(url).catch((err: unknown) => console.warn('An error occurred', err))
  } else {
    const {openURL: openURLImpl} = _getDesktopFunctions()
    return openURLImpl?.(url)
  }
}

// ─── openSMS ────────────────────────────────────────────────────────────────

export const openSMS = async (phonenos: Array<string>, body?: string): Promise<unknown> => {
  if (!isMobile) {
    console.warn('Attempted to open SMS on desktop')
    return Promise.reject(new Error("Can't open SMS on desktop"))
  }
  const SMS = await import('expo-sms')
  return SMS.isAvailableAsync().then(async isAvailable => {
    if (!isAvailable) {
      throw new Error('SMS not available')
    }
    return SMS.sendSMSAsync(phonenos, body || '')
  })
}

// ─── clearLocalLogs ──────────────────────────────────────────────────────────

export const clearLocalLogs = async (): Promise<void> => {
  if (!isMobile || !isIOS) return
  const {clearLocalLogs: clearLocalLogsNative} = require('react-native-kb') as {clearLocalLogs: () => Promise<void>}
  return clearLocalLogsNative()
}

// ─── editAvatar ──────────────────────────────────────────────────────────────

export const editAvatar = (): void => {
  if (isMobile) {
    const f = async () => {
      try {
        const imagePickerMod = await import('./expo-image-picker')
        const result = await imagePickerMod.launchImageLibraryAsync('photo')
        const first = result.assets?.reduce<ImageInfo | undefined>((acc, a) => {
          if (!acc && (a.type === 'image' || a.type === 'video')) {
            return a as ImageInfo
          }
          return acc
        }, undefined)
        if (!result.canceled && first) {
          navigateAppend({name: 'profileEditAvatar', params: {image: first}})
        }
      } catch (error) {
        const {filePickerError} = require('@/util/storeless-actions') as {filePickerError: (e: Error) => void}
        filePickerError(new Error(String(error)))
      }
    }
    void f()
  } else {
    navigateAppend({name: 'profileEditAvatar', params: {image: undefined}})
  }
}

// ─── pickImages ──────────────────────────────────────────────────────────────

export const pickImages = async (title: string): Promise<Array<string>> => {
  if (isMobile) {
    const imagePickerMod = await import('./expo-image-picker')
    const result = await imagePickerMod.launchImageLibraryAsync('photo')
    return result.canceled ? [] : result.assets.map(a => a.uri)
  } else {
    const {showOpenDialog} = _getDesktopFunctions()
    if (!showOpenDialog) return []
    return showOpenDialog({
      allowFiles: true,
      allowMultiselect: true,
      filters: [{extensions: ['jpg', 'png', 'gif'], name: 'Images'}],
      title,
    })
  }
}

// ─── pickFiles ──────────────────────────────────────────────────────────────

export const pickFiles = async (options: OpenDialogOptions): Promise<Array<string>> => {
  if (isMobile) {
    const docPickerMod = require('./expo-document-picker.native') as {pickDocumentsAsync: (multiple: boolean) => Promise<{canceled: boolean; assets: Array<{uri: string}>}>}
    const result = await docPickerMod.pickDocumentsAsync(true)
    return result.canceled ? [] : result.assets.map(a => a.uri)
  } else {
    const {showOpenDialog} = _getDesktopFunctions()
    if (!showOpenDialog) return []
    return showOpenDialog(options)
  }
}

// ─── pickSave ────────────────────────────────────────────────────────────────

export const pickSave = async (options: SaveDialogOptions): Promise<string> => {
  if (isMobile) {
    return Promise.reject(new Error('No supported platform'))
  } else {
    const {showSaveDialog} = _getDesktopFunctions()
    if (!showSaveDialog) return [] as unknown as string
    return showSaveDialog(options)
  }
}

// ─── NotifyPopup ─────────────────────────────────────────────────────────────

type NotifyPopupOpts = {body?: string; sound?: boolean}

// Desktop rate-limiting state
const _rateLimit: {[K in string]: () => void} = {}
const _rateLimitPayloads: {
  [K in string]:
    | {title: string; opts?: NotifyPopupOpts; onClick?: () => void}
    | undefined
} = {}

export function NotifyPopup(
  title: string,
  opts?: NotifyPopupOpts,
  rateLimitSeconds: number = -1,
  rateLimitKey?: string,
  onClick?: () => void,
  onClose?: () => void
): void {
  if (isMobile) {
    console.log('NotifyPopup: ', title)
    const {addNotificationRequest} = require('react-native-kb') as {addNotificationRequest: (opts: {body: string; id: string}) => Promise<void>}
    addNotificationRequest({
      body: title,
      id: Math.floor(Math.random() * 2 ** 32).toString(),
    }).catch(() => {})
    return
  }

  // Desktop: use Web Notification API with optional rate-limiting
  const sound = opts?.sound
  if (rateLimitSeconds > 0) {
    const key = rateLimitKey || title

    if (_rateLimit[key]) {
      _rateLimitPayloads[key] = {onClick, opts, title}
      _rateLimit[key]()
      return
    }

    _rateLimit[key] = debounce(() => {
      if (_rateLimitPayloads[key]) {
        const payload = _rateLimitPayloads[key]
        _rateLimitPayloads[key] = undefined
        const notification = new Notification(payload.title, {...payload.opts, silent: !payload.opts?.sound})
        notification.onclick = payload.onClick ?? null
        notification.onclose = onClose ?? null
      }
    }, rateLimitSeconds * 1_000)
  }

  logger.info('NotifyPopup: creating notification')
  const notification = new Notification(title, {...opts, silent: !sound})
  notification.onclick = onClick ?? null
  notification.onclose = onClose ?? null
}
