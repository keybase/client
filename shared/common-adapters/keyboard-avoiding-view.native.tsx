import * as Styles from '../styles'
import {KeyboardAvoidingView, Platform} from 'react-native'
import {useHeaderHeight} from '@react-navigation/elements'
import type {Props} from './keyboard-avoiding-view'

export default KeyboardAvoidingView

const useSafeHeaderHeight = () => {
  try {
    return useHeaderHeight()
  } catch {
    return 0
  }
}

export const KeyboardAvoidingView2 = (p: Props) => {
  const {children, isModal, extraOffset, rawHeight} = p
  const headerHeight = useSafeHeaderHeight()
  const modalHeight = isModal ? 40 : 0
  const keyboardVerticalOffset = headerHeight + modalHeight + (extraOffset ?? 0)

  return (
    <KeyboardAvoidingView
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // @ts-ignore patched in
      rawHeight={rawHeight}
    >
      {children}
    </KeyboardAvoidingView>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      keyboard: {
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
    } as const)
)
