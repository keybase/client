import {navigateAppend} from '@/constants/router'
import {useConfigState} from '@/stores/config'
import {isIOS} from '@/constants/platform.native'
import {pickDocumentsAsync} from './expo-document-picker.native'
import {launchImageLibraryAsync, type ImageInfo} from './expo-image-picker.native'
import type {OpenDialogOptions, SaveDialogOptions} from './electron.desktop'
import * as SMS from 'expo-sms'
import {Linking} from 'react-native'
import {addNotificationRequest, clearLocalLogs as clearLocalLogsNative} from 'react-native-kb'

type NotifyPopupOpts = {body?: string; sound?: boolean}

export function openURL(url?: string) {
  if (url) {
    Linking.openURL(url).catch((err: unknown) => console.warn('An error occurred', err))
  } else {
    console.log('Skipping null url click')
  }
}

export const openSMS = async (phonenos: Array<string>, body?: string): Promise<unknown> => {
  return SMS.isAvailableAsync().then(async isAvailable => {
    if (!isAvailable) {
      throw new Error('SMS not available')
    }
    return SMS.sendSMSAsync(phonenos, body || '')
  })
}

export const clearLocalLogs = async (): Promise<void> => {
  if (!isIOS) return
  return clearLocalLogsNative()
}

export const editAvatar = () => {
  const f = async () => {
    try {
      const result = await launchImageLibraryAsync('photo')
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
      useConfigState.getState().dispatch.filePickerError(new Error(String(error)))
    }
  }
  void f()
}

export const pickImages = async (_: string): Promise<Array<string>> => {
  const result = await launchImageLibraryAsync('photo')
  return result.canceled ? [] : result.assets.map(a => a.uri)
}

export const pickFiles = async (_options: OpenDialogOptions): Promise<Array<string>> => {
  const result = await pickDocumentsAsync(true)
  return result.canceled ? [] : result.assets.map(a => a.uri)
}

export const pickSave = (_options: SaveDialogOptions): never => {
  throw new Error('No supported platform')
}

export function NotifyPopup(title: string, _opts?: NotifyPopupOpts): void {
  console.log('NotifyPopup: ', title)
  addNotificationRequest({
    body: title,
    id: Math.floor(Math.random() * 2 ** 32).toString(),
  }).catch(() => {})
}
