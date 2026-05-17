import type * as React from 'react'
import type {Props} from './keyboard-avoiding-view.shared'
import * as Styles from '@/styles'

const DesktopKeyboardAvoidingView = (p: Props): React.ReactNode => p.children || null

// Custom hook — only called when NativeKeyboardAvoidingView renders (mobile only)
function useSafeHeaderHeight(): number {
  const {useHeaderHeight} = require('@react-navigation/elements') as {useHeaderHeight: () => number}
  // useHeaderHeight throws when rendered outside a navigator; default to 0
  // eslint-disable-next-line react-hooks/rules-of-hooks
  try { return useHeaderHeight() } catch { return 0 }
}

const NativeKeyboardAvoidingView = (p: Props): React.ReactNode => {
  type KAVType = React.ComponentType<{
    behavior?: string
    keyboardVerticalOffset?: number
    pointerEvents?: string
    style?: Styles.StylesCrossPlatform
    children?: React.ReactNode
  }>
  const {KeyboardAvoidingView} = require('react-native-keyboard-controller') as {KeyboardAvoidingView: KAVType}

  const headerHeight = useSafeHeaderHeight()
  const {extraOffset, behavior, children} = p
  const keyboardVerticalOffset = headerHeight + (extraOffset ?? 0)
  return (
    <KeyboardAvoidingView
      behavior={behavior ?? (Styles.isIOS ? 'padding' : 'height')}
      keyboardVerticalOffset={keyboardVerticalOffset}
      pointerEvents="box-none"
      style={styles.keyboard}
    >
      {children}
    </KeyboardAvoidingView>
  )
}

export const KeyboardAvoidingView2 = Styles.isMobile ? NativeKeyboardAvoidingView : DesktopKeyboardAvoidingView
export default KeyboardAvoidingView2

const styles = Styles.styleSheetCreate(() => ({
  keyboard: {flexGrow: 1, flexShrink: 1},
}))
