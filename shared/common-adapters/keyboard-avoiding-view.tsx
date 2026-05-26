import type * as React from 'react'
import * as Styles from '@/styles'
import {useHeaderHeight} from '@react-navigation/elements'
import {KeyboardAvoidingView} from 'react-native-keyboard-controller'

type Props = {
  children: React.ReactNode
  isModal?: boolean
  extraOffset?: number
  extraPadding?: number
  compensateNotBeingOnBottom?: boolean
  behavior?: 'height' | 'padding' | 'translate-with-padding'
}

const DesktopKeyboardAvoidingView = (p: Props): React.ReactNode => p.children || null

// Custom hook — only called when NativeKeyboardAvoidingView renders (mobile only)
function useSafeHeaderHeight(): number {
  // useHeaderHeight throws when rendered outside a navigator; default to 0
  // eslint-disable-next-line react-hooks/rules-of-hooks
  try { return useHeaderHeight() } catch { return 0 }
}

const NativeKeyboardAvoidingView = (p: Props): React.ReactNode => {

  const headerHeight = useSafeHeaderHeight()
  const {extraOffset, behavior, children} = p
  const keyboardVerticalOffset = headerHeight + (extraOffset ?? 0)
  return (
    <KeyboardAvoidingView
      behavior={behavior ?? (isIOS ? 'padding' : 'height')}
      keyboardVerticalOffset={keyboardVerticalOffset}
      pointerEvents="box-none"
      style={styles.keyboard}
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
