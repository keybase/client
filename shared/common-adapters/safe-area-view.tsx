import {View} from 'react-native'
import {SafeAreaView, useSafeAreaInsets as useSafeAreaInsetsNative} from 'react-native-safe-area-context'
import type {Props} from './safe-area-view.shared'
import * as Styles from '@/styles'

const SafeAreaViewTopNative = (p: Props) => {
  const {children, style} = p
  const insets = useSafeAreaInsetsNative()
  return (
    <View style={[{paddingTop: insets.top}, nativeStyles.topSafeArea, style]} pointerEvents="box-none">
      {children}
    </View>
  )
}

const SafeAreaViewTopDesktop = (props: Props): React.ReactNode => props.children ?? null

const nativeStyles = Styles.styleSheetCreate(() => ({
  topSafeArea: {backgroundColor: Styles.globalColors.white, flexGrow: 0},
}))

export const SafeAreaViewTop = isMobile ? SafeAreaViewTopNative : SafeAreaViewTopDesktop

const desktopInsets = {bottom: 0, left: 0, right: 0, top: 0}
export const useSafeAreaInsets = isMobile
  ? useSafeAreaInsetsNative
  : () => desktopInsets

const DesktopSafeAreaView = (props: Props): React.ReactNode => props.children ?? null

export default isMobile ? SafeAreaView : DesktopSafeAreaView
