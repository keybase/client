import type {ViewProps, ViewStyle} from 'react-native'
export type DropItems = Array<{
  originalPath?: string
  content?: string
}>
export type Props = {
  children?: React.ReactNode
  onDropped: (items: DropItems) => void
  style?: ViewStyle
}
interface NativeProps extends ViewProps {
  children?: React.ReactNode
  onDropped: (items: DropItems) => void
  style?: ViewStyle
}
declare const _default: import('react-native/Libraries/Utilities/codegenNativeComponent').NativeComponentType<NativeProps>
export default _default
