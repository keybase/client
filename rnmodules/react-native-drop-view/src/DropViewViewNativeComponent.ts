import {codegenNativeComponent} from 'react-native'
import {DirectEventHandler} from 'react-native/Libraries/Types/CodegenTypes'
import type {ViewProps, ViewStyle} from 'react-native'
import type {ReactNode} from 'react'

export type DropItems = Array<{originalPath?: string; content?: string}>
export type Props = {
  children?: ReactNode
  onDropped: (items: DropItems) => void
  style?: ViewStyle
}

interface NativeProps extends ViewProps {
  onDropped?: DirectEventHandler<{
    manifest: string
  }>
}

export default codegenNativeComponent<NativeProps>('DropViewView')
