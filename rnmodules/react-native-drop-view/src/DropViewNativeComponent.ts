import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent'
import type {ViewProps} from 'react-native'
import type {HostComponent} from 'react-native'

interface NativeProps extends ViewProps {}

export default codegenNativeComponent<NativeProps>('DropView') as HostComponent<NativeProps>
