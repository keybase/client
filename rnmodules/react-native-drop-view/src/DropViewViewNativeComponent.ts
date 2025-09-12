import type {ViewProps} from 'react-native'
import {codegenNativeComponent, type DirectEventHandler} from 'react-native'

export type DropItems = Array<{originalPath?: string; content?: string}>

interface NativeProps extends ViewProps {
  onDropped?: DirectEventHandler<{
    manifest: string
  }>
}

export default codegenNativeComponent<NativeProps>('DropViewView')
