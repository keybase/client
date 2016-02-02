import {Platform} from 'react-native'
import {OS_ANDROID, OS_IOS} from './platform.shared'

export const OS = Platform.OS === 'ios' ? OS_IOS : OS_ANDROID
export const isMobile = true
