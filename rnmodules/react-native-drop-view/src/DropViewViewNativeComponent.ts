import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent'
import {DirectEventHandler} from 'react-native/Libraries/Types/CodegenTypes'
import type {ViewProps} from 'react-native'

interface NativeProps extends ViewProps {
  onDropped?: DirectEventHandler<{
    items: {originalPath?: string; content?: string}[]
  }>
}

export default codegenNativeComponent<NativeProps>('DropViewView')
