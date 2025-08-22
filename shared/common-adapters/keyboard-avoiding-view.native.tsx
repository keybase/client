import {KeyboardAvoidingView} from 'react-native-keyboard-controller'
import type {Props} from './keyboard-avoiding-view'
import * as Styles from '@/styles'
import {useHeaderHeight} from '@react-navigation/elements'

const useSafeHeaderHeight = () => {
  try {
    // eslint-disable-next-line
    return useHeaderHeight()
  } catch {
    return 0
  }
}

export const KeyboardAvoidingView2 = (p: Props) => {
  const {extraOffset} = p
  const headerHeight = useSafeHeaderHeight()
  const keyboardVerticalOffset = headerHeight + (extraOffset ?? 0)
  return (
    <KeyboardAvoidingView
      behavior={Styles.isIOS ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
      pointerEvents="box-none"
      {...p}
      style={styles.keyboard}
    />
  )
}
export default KeyboardAvoidingView2

const styles = Styles.styleSheetCreate(() => ({
  keyboard: {flexGrow: 1, flexShrink: 1},
}))
