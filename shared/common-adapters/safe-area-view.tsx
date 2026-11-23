import {View} from 'react-native'
import {
  SafeAreaView,
  useSafeAreaInsets as useSafeAreaInsetsNative,
  type EdgeInsets,
} from 'react-native-safe-area-context'
import * as Styles from '@/styles'
import * as React from 'react'
import type {StylesCrossPlatform} from '@/styles'

type Props = {
  children?: React.ReactNode
  style?: StylesCrossPlatform
  edges?: ReadonlyArray<'top' | 'right' | 'bottom' | 'left'>
}

const SafeAreaViewTopNative = (p: Props) => {
  const nativeStyles = useNativeStyles()
  const {children, style} = p
  const insets = useSafeAreaInsetsNative()
  return (
    <View style={[{paddingTop: insets.top}, nativeStyles.topSafeArea, style]} pointerEvents="box-none">
      {children}
    </View>
  )
}

// desktop has no insets; both exports pass children straight through
const PassThrough = (props: Props): React.ReactNode => props.children ?? null

const useNativeStyles = Styles.createStyleHook(theme => ({
  topSafeArea: {backgroundColor: theme.white, flexGrow: 0},
}))

export const SafeAreaViewTop = isMobile ? SafeAreaViewTopNative : PassThrough

const desktopInsets = {bottom: 0, left: 0, right: 0, top: 0}
export const useSafeAreaInsets = isMobile
  ? useSafeAreaInsetsNative
  : () => desktopInsets

export default isMobile ? SafeAreaView : PassThrough

// The window's live insets, from the app's root SafeAreaProvider. A provider nested inside a
// react-native-screens scene (every modal route) measures that scene instead, and
// initialWindowMetrics is the window at launch (on an iPhone Duo, a posture since changed).
const WindowInsetsContext = React.createContext<EdgeInsets | undefined>(undefined)
export const WindowInsetsProvider = ({children}: {children: React.ReactNode}) => {
  const insets = useSafeAreaInsetsNative()
  return <WindowInsetsContext value={insets}>{children}</WindowInsetsContext>
}
export const useWindowInsets = () => React.useContext(WindowInsetsContext)
