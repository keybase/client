import {StyleSheet, Dimensions} from 'react-native'
import * as iPhoneXHelper from 'react-native-iphone-x-helper'
import {isIOS} from '../constants/platform'
import globalColors from './colors'
import styleSheetCreateProxy from './style-sheet-proxy'
import * as Shared from './shared'

type _Elem = Object | null | false | void
// CollapsibleStyle is a generic version of ?StylesMobile and family,
// slightly extended to support "isFoo && myStyle".
export type CollapsibleStyle = _Elem | ReadonlyArray<_Elem>

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
      fontTerminalSemibold: {fontFamily: 'SourceCodePro-Semibold', fontWeight: 'normal'},
      italic: {fontStyle: 'italic'},
    }

const util = {
  ...Shared.util({}),
  loadingTextStyle: {
    backgroundColor: globalColors.greyLight,
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

export const statusBarHeight = iPhoneXHelper.getStatusBarHeight(true)
export const hairlineWidth = StyleSheet.hairlineWidth
// @ts-ignore TODO fix native styles
export const styleSheetCreate = obj => styleSheetCreateProxy(obj, o => StyleSheet.create(o))
export {isDarkMode} from './dark-mode'
export const collapseStyles = (
  styles: ReadonlyArray<CollapsibleStyle>
): ReadonlyArray<Object | null | false | void> => {
  return styles
}
export const transition = () => ({})
export const backgroundURL = () => ({})
export const styledKeyframes = () => null

export {isMobile, fileUIName, isIPhoneX, isIOS, isAndroid} from '../constants/platform'
export {
  globalMargins,
  backgroundModeToColor,
  backgroundModeToTextColor,
  platformStyles,
  padding,
} from './shared'
export {default as glamorous} from '@emotion/native'
export {default as styled, css as styledCss} from '@emotion/native'
export {themed as globalColors} from './colors'
export {default as classNames} from 'classnames'
export const borderRadius = 6
export const dimensionWidth = Dimensions.get('window').width
export const dimensionHeight = Dimensions.get('window').height
