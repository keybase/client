import {NativeModules, Platform} from 'react-native'

const PREFIX = 'ShareDebug: '

export const shareDebugLog = (message: string) => {
  if (Platform.OS === 'android' && NativeModules.NativeLogger) {
    NativeModules.NativeLogger.log(PREFIX + message)
  }
}
