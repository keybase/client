import type {HostComponent, ViewProps} from 'react-native'
import type {
  DirectEventHandler,
} from 'react-native/Libraries/Types/CodegenTypes'
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent'

export interface OnPasteImageEvent {
  imagePath: string
}

export interface NativePasteableTextInputProps extends ViewProps {
  onPasteImage?: DirectEventHandler<OnPasteImageEvent>
}

export default codegenNativeComponent<NativePasteableTextInputProps>('PasteableTextInput') as HostComponent<NativePasteableTextInputProps>

