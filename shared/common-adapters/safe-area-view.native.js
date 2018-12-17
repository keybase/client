// @flow
import * as React from 'react'
import {SafeAreaView, View, StatusBar} from 'react-native'
import type {Props, SafeAreaViewTopBottomProps} from 'react-native'
import * as Styles from '../styles'

// Android doesn't have an implementation for SafeAreaView, so add a special case for handling the top of the screen
export const SafeAreaViewTop = ({style, children}: Props) =>
  Styles.isAndroid ? (
    <View style={Styles.collapseStyles([styles.androidTopSafeArea, style])}>{children}</View>
  ) : (
    <SafeAreaView style={Styles.collapseStyles([styles.topSafeArea, style])}>{children}</SafeAreaView>
  )

export const SafeAreaViewTopBottom = ({bottomColor, children, topColor}: SafeAreaViewTopBottomProps) => (
  <SafeAreaView style={Styles.collapseStyles([styles.flexOne, topColor && {backgroundColor: topColor}])}>
    {Styles.isAndroid && (
      <View
        style={Styles.collapseStyles([styles.androidTopSafeArea, topColor && {backgroundColor: topColor}])}
      />
    )}
    {children}
    {/* workaround for two background colors from here: https://stackoverflow.com/questions/47725607/react-native-safeareaview-background-color-how-to-assign-two-different-backgro */}
    {!!bottomColor && (
      <View style={Styles.collapseStyles([styles.bottomSafeArea, {backgroundColor: bottomColor}])} />
    )}
  </SafeAreaView>
)

const styles = Styles.styleSheetCreate({
  androidTopSafeArea: {
    backgroundColor: Styles.globalColors.white,
    flexShrink: 0,
    minHeight: StatusBar.currentHeight,
    paddingTop: StatusBar.currentHeight,
  },
  bottomSafeArea: {
    backgroundColor: Styles.globalColors.white,
    bottom: 0,
    height: 100,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: -1000,
  },
  flexOne: {
    flex: 1,
  },
  topSafeArea: {backgroundColor: Styles.globalColors.white, flexGrow: 0},
})

export default SafeAreaView
