import DropViewView from './DropViewViewNativeComponent'
import {Platform, View} from 'react-native'

const isSupported = Platform.OS === 'ios'
export default isSupported ? DropViewView : View
