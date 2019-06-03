import * as React from 'react'
import {SafeAreaView, View, StatusBar} from 'react-native'
import {Props} from './safe-area-view'
import * as Styles from '../styles'

// Android doesn't have an implementation for SafeAreaView, so add a special case for handling the top of the screen
export const SafeAreaViewTop = ({style, children}: Props) =>
  Styles.isAndroid ? (
    <View style={Styles.collapseStyles([styles.androidTopSafeArea, style])}>{children}</View>
  ) : (
    <SafeAreaView style={Styles.collapseStyles([styles.topSafeArea, style])}>{children}</SafeAreaView>
  )

const styles = Styles.styleSheetCreate({
  androidTopSafeArea: {
    backgroundColor: Styles.globalColors.white,
    flexShrink: 0,
    minHeight: StatusBar.currentHeight,
    paddingTop: StatusBar.currentHeight,
  },
  topSafeArea: {backgroundColor: Styles.globalColors.white, flexGrow: 0},
})

export default SafeAreaView
