import {View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import type {Props} from './safe-area-view'
import * as Styles from '../styles'

// Android doesn't have an implementation for SafeAreaView, so add a special case for handling the top of the screen
export const SafeAreaViewTop = (p: Props) => {
  const {children, style} = p
  const insets = useSafeAreaInsets()
  return <View style={[{paddingTop: insets.top}, styles.topSafeArea, style]}>{children}</View>
}

export const SafeAreaView = (p: Props) => {
  const {children, style} = p
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        {
          paddingBottom: insets.bottom,
          paddingTop: insets.top,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  topSafeArea: {backgroundColor: Styles.globalColors.white, flexGrow: 0},
}))

export {useSafeAreaInsets} from 'react-native-safe-area-context'
export default SafeAreaView
