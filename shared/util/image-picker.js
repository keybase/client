// @flow
import {isAndroid} from '../constants/platform'
import {
  showImagePicker as _showImagePicker,
  launchCamera as _launchCamera,
  launchImageLibrary,
  type Options,
  type Response,
} from 'react-native-image-picker'

const showImagePicker = (options: ?Options, callback: (response: Response) => any) => {
  if (!isAndroid) {
    return _showImagePicker(options, callback)
  }

  return _showImagePicker(options, callback)
}

const launchCamera = (options: ?Options, callback: (response: Response) => any) => {
  if (!isAndroid) {
    return _launchCamera(options, callback)
  }

  return _launchCamera(options, callback)
}

export {showImagePicker, launchCamera, launchImageLibrary}
export type {Options, Response}
