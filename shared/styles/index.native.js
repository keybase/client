// @flow
import {StatusBar, StyleSheet} from 'react-native'
import {isAndroid, isIOS} from '../constants/platform'
import globalColors from './colors'
import * as Shared from './shared'

const font = isIOS
  ? {
      fontBold: {fontFamily: 'OpenSans', fontWeight: '700'},
      fontRegular: {fontFamily: 'OpenSans', fontWeight: '400'},
      fontSemibold: {fontFamily: 'OpenSans', fontWeight: '600'},
      fontTerminal: {fontFamily: 'Source Code Pro'},
      fontTerminalSemibold: {fontFamily: 'Source Code Pro', fontWeight: '600'},
      italic: {fontStyle: 'italic'},
    }
  : {
      fontBold: {fontFamily: 'OpenSans', fontWeight: 'bold'},
      fontRegular: {fontFamily: 'OpenSans', fontWeight: 'normal'},
      fontSemibold: {fontFamily: 'OpenSans-Semi', fontWeight: 'bold'},
      fontTerminal: {fontFamily: 'SourceCodePro'},
      fontTerminalSemibold: {fontFamily: 'SourceCodePro-Semi', fontWeight: 'bold'},
      italic: {fontStyle: 'italic'},
    }

const util = {
  ...Shared.util({}),
  loadingTextStyle: {
    backgroundColor: globalColors.lightGrey,
    height: 16,
  },
}

export const desktopStyles = {
  scrollable: {
    // TODO remove this style entirely, use ScrollView
  },
}

export const mobileStyles = {}

export const globalStyles = {
  ...font,
  ...util,
}

// FIXME: StatusBar.currentHeight returns undefined on iOS in RN 0.34
export const statusBarHeight = isAndroid ? StatusBar.currentHeight : 20
export const hairlineWidth = StyleSheet.hairlineWidth
export const styleSheetCreate = (obj: Object) => StyleSheet.create(obj)
export const collapseStyles = (styles: Array<Object> | Object) => styles
export const transition = (...properties: Array<string>) => ({})
export const backgroundURL = (...path: Array<string>) => ({})

export {isMobile, fileUIName, isIPhoneX} from '../constants/platform'
export {globalMargins, backgroundModeToColor, platformStyles} from './shared'
export {default as glamorous} from 'glamorous-native'
export {default as globalColors} from './colors'
