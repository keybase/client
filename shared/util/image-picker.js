// @flow
import {isAndroid} from '../constants/platform'
import {
  showImagePicker as _showImagePicker,
  launchCamera as _launchCamera,
  launchImageLibrary,
  type Options,
  type Response,
} from 'react-native-image-picker'

type ImagePickerFn = (options: ?Options, callback: (response: Response) => any) => void

const wrapWithImageCaptureSecure = (fn: ImagePickerFn): ImagePickerFn => {
  if (!isAndroid) {
    return fn
  }

  return (options: ?Options, callback: (response: Response) => any) => {
    return fn(options, callback)
  }
}

const showImagePicker = wrapWithImageCaptureSecure(_showImagePicker)

const launchCamera = wrapWithImageCaptureSecure(_launchCamera)

export {showImagePicker, launchCamera, launchImageLibrary}
export type {Options, Response}
