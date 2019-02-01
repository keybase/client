// @flow
import {isAndroid} from '../constants/platform'
import logger from '../logger'
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
    const optionsWithSecure = {...options, androidUseImageCaptureSecure: true}

    fn(optionsWithSecure, response => {
      const error = response.error
      if (error.includes('Cannot launch camera')) {
        logger.warn(`Camera error with androidUseImageCaptureSecure; trying again without it: ${error}`)
        fn(options, callback)
      } else {
        callback(response)
      }
    })
  }
}

const showImagePicker = wrapWithImageCaptureSecure(_showImagePicker)

const launchCamera = wrapWithImageCaptureSecure(_launchCamera)

export {showImagePicker, launchCamera, launchImageLibrary}
export type {Options, Response}
