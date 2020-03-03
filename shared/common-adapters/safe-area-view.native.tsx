import * as React from 'react'
import {View} from 'react-native'
import {useSafeArea} from 'react-native-safe-area-context'
import {Props} from './safe-area-view'
import * as Styles from '../styles'

// Android doesn't have an implementation for SafeAreaView, so add a special case for handling the top of the screen
export const SafeAreaViewTop = ({style, children}: Props) => {
  const insets = useSafeArea()
  return (
    <View style={Styles.collapseStyles([{paddingTop: insets.top}, styles.topSafeArea, style])}>
      {children}
    </View>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  topSafeArea: {backgroundColor: Styles.globalColors.white, flexGrow: 0},
}))

export {SafeAreaView as default, useSafeArea} from 'react-native-safe-area-context'
