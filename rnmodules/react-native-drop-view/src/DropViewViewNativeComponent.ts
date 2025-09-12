import type {HostComponent, ViewProps} from 'react-native'
import {codegenNativeComponent, type DirectEventHandler} from 'react-native'

export type DropItems = Array<{originalPath?: string; content?: string}>

interface NativeProps extends ViewProps {
  onDropped?: DirectEventHandler<{
    manifest: string
  }>
}

type ComponentType = HostComponent<NativeProps>
export default codegenNativeComponent<NativeProps>('DropViewView') as ComponentType
