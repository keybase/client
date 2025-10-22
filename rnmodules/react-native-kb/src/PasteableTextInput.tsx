import React, {forwardRef} from 'react'
import type {TextInputProps, TextInput as RNTextInput} from 'react-native'
import NativePasteableTextInput from './PasteableTextInputNativeComponent'
import type {OnPasteImageEvent} from './PasteableTextInputNativeComponent'

export interface PasteableTextInputProps extends TextInputProps {
  onPasteImage?: (imagePath: string) => void
}

const PasteableTextInput = forwardRef<RNTextInput, PasteableTextInputProps>((props, ref) => {
  const {onPasteImage, ...restProps} = props

  const handlePasteImage = React.useCallback(
    (event: {nativeEvent: OnPasteImageEvent}) => {
      if (onPasteImage) {
        onPasteImage(event.nativeEvent.imagePath)
      }
    },
    [onPasteImage]
  )

  return (
    <NativePasteableTextInput
      {...restProps}
      ref={ref}
      onPasteImage={onPasteImage ? handlePasteImage : undefined}
    />
  )
})

PasteableTextInput.displayName = 'PasteableTextInput'

export default PasteableTextInput

