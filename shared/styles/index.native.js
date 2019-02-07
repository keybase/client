// @flow
import {StatusBar, StyleSheet} from 'react-native'
import {isAndroid, isIOS} from '../constants/platform'
import globalColors from './colors'
import type {CollapsibleStyle} from './index.types'
import * as Shared from './shared'

const font = isIOS
  ? {
      fontBold: {fontFamily: 'Keybase', fontWeight: '700'},
      fontExtrabold: {fontFamily: 'Keybase', fontWeight: '800'},
      fontRegular: {fontFamily: 'Keybase', fontWeight: '500'},
      fontSemibold: {fontFamily: 'Keybase', fontWeight: '600'},
      fontTerminal: {fontFamily: 'Source Code Pro Medium'},
      fontTerminalSemibold: {fontFamily: 'Source Code Pro Semibold', fontWeight: '600'},
      italic: {fontStyle: 'italic'},
    }
  : {
      // The fontFamily name must match the font file's name exactly on Android.
      fontBold: {fontFamily: 'keybase-bold', fontWeight: 'normal'},
      fontExtrabold: {fontFamily: 'keybase-extrabold', fontWeight: 'normal'},
      fontRegular: {fontFamily: 'keybase-medium', fontWeight: 'normal'},
      fontSemibold: {fontFamily: 'keybase-semibold', fontWeight: 'normal'},
      fontTerminal: {fontFamily: 'SourceCodePro-Medium', fontWeight: 'normal'},
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
export const collapseStyles = (
  styles: $ReadOnlyArray<CollapsibleStyle>
): $ReadOnlyArray<Object | null | false | void> => {
  return styles
}
export const transition = (...properties: Array<string>) => ({})
export const backgroundURL = (...path: Array<string>) => ({})
export const styledKeyframes = () => null

export {isMobile, fileUIName, isIPhoneX, isIOS, isAndroid} from '../constants/platform'
export {globalMargins, backgroundModeToColor, platformStyles} from './shared'
export {default as glamorous} from '@emotion/native'
export {default as styled, css as styledCss} from '@emotion/native'
export {default as globalColors} from './colors'
export {default as classNames} from 'classnames'
export const borderRadius = 6
