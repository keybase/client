import * as React from 'react'
import * as Styles from '@/styles'
import {HeaderHeightContext} from '@react-navigation/elements'
import {KeyboardAvoidingView} from 'react-native-keyboard-controller'

type Props = {
  children: React.ReactNode
  isModal?: boolean
  extraOffset?: number
  extraPadding?: number
  compensateNotBeingOnBottom?: boolean
  behavior?: 'height' | 'padding' | 'translate-with-padding'
  testID?: string
}

const DesktopKeyboardAvoidingView = (p: Props): React.ReactNode => p.children || null

const NativeKeyboardAvoidingView = (p: Props): React.ReactNode => {
  // useHeaderHeight throws when rendered outside a navigator; read the context directly instead
  const headerHeight = React.useContext(HeaderHeightContext) ?? 0
  const {extraOffset, behavior, children, testID} = p
  const keyboardVerticalOffset = headerHeight + (extraOffset ?? 0)
  return (
    <KeyboardAvoidingView
      behavior={behavior ?? (isIOS ? 'padding' : 'height')}
      keyboardVerticalOffset={keyboardVerticalOffset}
      pointerEvents="box-none"
      style={styles.keyboard}
      testID={testID}
    >
      {children}
    </KeyboardAvoidingView>
  )
}

export const KeyboardAvoidingView2 = isMobile ? NativeKeyboardAvoidingView : DesktopKeyboardAvoidingView
export default KeyboardAvoidingView2

const styles = Styles.styleSheetCreate(() => ({
  keyboard: {flexGrow: 1, flexShrink: 1},
}))
