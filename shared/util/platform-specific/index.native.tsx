import * as T from '@/constants/types'
import * as ExpoLocation from 'expo-location'
import * as MediaLibrary from 'expo-media-library'
import {addNotificationRequest} from 'react-native-kb'
import logger from '@/logger'
import {ActionSheetIOS} from 'react-native'
import {isIOS, isAndroid} from '@/constants/platform.native'
import {androidShare, androidShareText, androidUnlink} from 'react-native-kb'

export const requestPermissionsToWrite = async () => {
  if (isAndroid) {
    const p = await MediaLibrary.requestPermissionsAsync(false)
    return p.granted ? Promise.resolve() : Promise.reject(new Error('Unable to acquire storage permissions'))
  }
  return Promise.resolve()
}

export const requestLocationPermission = async (mode: T.RPCChat.UIWatchPositionPerm) => {
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
    }
  } else if (isAndroid) {
    const androidBGPerms = await ExpoLocation.requestForegroundPermissionsAsync()
    if (androidBGPerms.status !== ExpoLocation.PermissionStatus.GRANTED) {
      throw new Error('Unable to acquire location permissions')
    }
  }
}

export async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  const fileURL = 'file://' + filePath
  const saveType: 'video' | 'photo' = mimeType.startsWith('video') ? 'video' : 'photo'
  const logPrefix = '[saveAttachmentToCameraRoll] '
  try {
    try {
      // see it we can keep going anyways, android perms are needed sometimes and sometimes not w/ 33
      await requestPermissionsToWrite()
    } catch {}
    logger.info(logPrefix + `Attempting to save as ${saveType}`)
    await MediaLibrary.saveToLibraryAsync(fileURL)
    logger.info(logPrefix + 'Success')
  } catch (e) {
    // This can fail if the user backgrounds too quickly, so throw up a local notification
    // just in case to get their attention.
    addNotificationRequest({
      body: `Failed to save ${saveType} to camera roll`,
      id: Math.floor(Math.random() * 2 ** 32).toString(),
    }).catch(() => {})
    logger.debug(logPrefix + 'failed to save: ' + e)
    throw e
  } finally {
    try {
      await androidUnlink(filePath)
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
  if (isIOS) {
    return new Promise((resolve, reject) => {
      ActionSheetIOS.showShareActionSheetWithOptions(
        {
          message: options.message,
          url: options.filePath,
        },
        reject,
        resolve
      )
    })
  } else {
    if (!options.filePath && options.message) {
      try {
        await androidShareText(options.message, options.mimeType)
        return {completed: true, method: ''}
      } catch (e) {
        throw new Error('Failed to share: ' + String(e))
      }
    }

    try {
      await androidShare(options.filePath ?? '', options.mimeType)
      return {completed: true, method: ''}
    } catch (e) {
      throw new Error('Failed to share: ' + String(e))
    }
  }
}
