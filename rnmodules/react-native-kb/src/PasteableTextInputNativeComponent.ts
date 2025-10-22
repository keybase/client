import type {HostComponent, ViewProps} from 'react-native'
import type {
  BubblingEventHandler,
  DirectEventHandler,
  Double,
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes'
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent'
import type {TextInputProps} from 'react-native'

export interface OnPasteImageEvent {
  imagePath: string
}

export interface NativePasteableTextInputProps extends TextInputProps {
  onPasteImage?: DirectEventHandler<OnPasteImageEvent>
}

export default codegenNativeComponent<NativePasteableTextInputProps>('PasteableTextInput', {
  interfaceOnly: false,
  paperComponentName: 'RCTMultilineTextInputView',
}) as HostComponent<NativePasteableTextInputProps>

