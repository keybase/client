import * as T from '@/constants/types'
import logger from '@/logger'

export const requestPermissionsToWrite = async () => {
  if (!isMobile) {
    return Promise.resolve(true)
  }
  if (isAndroid) {
    const MediaLibrary = require('expo-media-library') as {
      requestPermissionsAsync: (writeOnly: boolean) => Promise<{granted: boolean}>
    }
    const p = await MediaLibrary.requestPermissionsAsync(false)
    return p.granted ? Promise.resolve() : Promise.reject(new Error('Unable to acquire storage permissions'))
  }
  return Promise.resolve()
}

export const requestLocationPermission = async (mode?: T.RPCChat.UIWatchPositionPerm) => {
  if (!isMobile) {
    return Promise.resolve()
  }
  const ExpoLocation = require('expo-location') as {
    requestForegroundPermissionsAsync: () => Promise<{status: string; ios?: {scope: string}}>
    requestBackgroundPermissionsAsync: () => Promise<{status: string}>
    PermissionStatus: {GRANTED: string}
  }
  if (isIOS) {
    logger.info('[location] Requesting location perms', mode)
    switch (mode) {
      case T.RPCChat.UIWatchPositionPerm.base:
        {
          const iosFGPerms = await ExpoLocation.requestForegroundPermissionsAsync()
          if (iosFGPerms.ios?.scope === 'none') {
            throw new Error('Please allow Keybase to access your location in the phone settings.')
          }
        }
        break
      case T.RPCChat.UIWatchPositionPerm.always: {
        const iosBGPerms = await ExpoLocation.requestBackgroundPermissionsAsync()
        if (iosBGPerms.status !== ExpoLocation.PermissionStatus.GRANTED) {
          throw new Error(
            'Please allow Keybase to access your location even if the app is not running for live location.'
          )
        }
        break
      }
      default:
        break
    }
  } else if (isAndroid) {
    const ExpoLocationA = require('expo-location') as {
      requestForegroundPermissionsAsync: () => Promise<{status: string}>
      PermissionStatus: {GRANTED: string}
    }
    const androidBGPerms = await ExpoLocationA.requestForegroundPermissionsAsync()
    if (androidBGPerms.status !== ExpoLocationA.PermissionStatus.GRANTED) {
      throw new Error('Unable to acquire location permissions')
    }
  }
}

export async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  if (!isMobile) {
    return Promise.reject(new Error('Save Attachment to camera roll - unsupported on this platform'))
  }
  const fileURL = 'file://' + filePath
  const saveType: 'video' | 'photo' = mimeType.startsWith('video') ? 'video' : 'photo'
  const logPrefix = '[saveAttachmentToCameraRoll] '
  const MediaLibrary = require('expo-media-library') as {
    saveToLibraryAsync: (fileURL: string) => Promise<void>
  }
  const FileSystem = require('expo-file-system') as {
    deleteAsync: (path: string, opts: {idempotent: boolean}) => Promise<void>
  }
  const {addNotificationRequest} = require('react-native-kb') as {
    addNotificationRequest: (opts: {body: string; id: string}) => Promise<void>
  }
  try {
    try {
      await requestPermissionsToWrite()
    } catch {}
    logger.info(logPrefix + `Attempting to save as ${saveType}`)
    await MediaLibrary.saveToLibraryAsync(fileURL)
    logger.info(logPrefix + 'Success')
  } catch (e) {
    addNotificationRequest({
      body: `Failed to save ${saveType} to camera roll`,
      id: Math.floor(Math.random() * 2 ** 32).toString(),
    }).catch(() => {})
    logger.debug(logPrefix + 'failed to save: ' + String(e))
    throw e
  } finally {
    try {
      await FileSystem.deleteAsync(filePath, {idempotent: true})
    } catch {
      logger.warn('failed to unlink')
    }
  }
}

export const showShareActionSheet = async (options: {
  filePath?: string
  message?: string
  mimeType: string
}) => {
  if (!isMobile) {
    return Promise.reject(new Error('Show Share Action - unsupported on this platform'))
  }
  if (isIOS) {
    const {ActionSheetIOS} = require('react-native') as {
      ActionSheetIOS: {
        showShareActionSheetWithOptions: (
          opts: {message?: string; url?: string},
          failureCallback: (error: Error) => void,
          successCallback: (success: boolean, method: string) => void
        ) => void
      }
    }
    return new Promise<void>((resolve, reject) => {
      ActionSheetIOS.showShareActionSheetWithOptions(
        {
          message: options.message,
          url: options.filePath,
        },
        reject,
        () => resolve()
      )
    })
  } else {
    const {androidShare, androidShareText} = require('react-native-kb') as {
      androidShare: (filePath: string, mimeType: string) => Promise<void>
      androidShareText: (text: string, mimeType: string) => Promise<void>
    }
    if (!options.filePath && options.message) {
      try {
        await androidShareText(options.message, options.mimeType)
        return {completed: true, method: ''}
      } catch (e) {
        throw new Error('Failed to share: ' + String(e), {cause: e})
      }
    }

    try {
      await androidShare(options.filePath ?? '', options.mimeType)
      return {completed: true, method: ''}
    } catch (e) {
      throw new Error('Failed to share: ' + String(e), {cause: e})
    }
  }
}

export const watchPositionForMap = async () => Promise.resolve(() => {})
