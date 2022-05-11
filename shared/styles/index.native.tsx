import * as React from 'react'
import * as Shared from './shared'
import * as iPhoneXHelper from 'react-native-iphone-x-helper'
import globalColors, {darkColors, themed} from './colors'
import styleSheetCreateProxy from './style-sheet-proxy'
import {StyleSheet, Dimensions} from 'react-native'
import {isDarkMode} from './dark-mode'
import {isIOS, isTablet} from '../constants/platform'

type _Elem = Object | null | false | void
// CollapsibleStyle is a generic version of ?StylesMobile and family,
// slightly extended to support "isFoo && myStyle".
export type CollapsibleStyle = _Elem | ReadonlyArray<_Elem>

const font = isIOS
  ? {
      fontBold: {fontFamily: 'Keybase', fontWeight: '700'},
      fontExtrabold: {fontFamily: 'Keybase', fontWeight: '800'},
      fontNyctographic: {fontFamily: 'Nyctographic', fontWeight: '400'},
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
      fontNyctographic: {fontFamily: 'Nyctographic', fontWeight: 'normal'},
      fontRegular: {fontFamily: 'keybase-medium', fontWeight: 'normal'},
      fontSemibold: {fontFamily: 'keybase-semibold', fontWeight: 'normal'},
      fontTerminal: {fontFamily: 'SourceCodePro-Medium', fontWeight: 'normal'},
      fontTerminalSemibold: {fontFamily: 'SourceCodePro-Semibold', fontWeight: 'normal'},
      italic: {fontStyle: 'italic'},
    }

const util = {
  ...Shared.util,
  largeWidthPercent: '70%',
  loadingTextStyle: {
    backgroundColor: globalColors.greyLight,
    height: 16,
  },
  mediumSubNavWidth: isTablet ? 270 : '100%',
  mediumWidth: isTablet ? 460 : '100%',
  shortSubNavWidth: isTablet ? 162 : '100%',
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

const cachedBackground = {
  dark: {backgroundColor: darkColors.fastBlank},
  light: {backgroundColor: globalColors.fastBlank},
}
if (isIOS) {
  Object.defineProperty(globalStyles, 'fastBackground', {
    configurable: false,
    enumerable: true,
    value: {backgroundColor: themed.fastBlank},
  })
} else {
  Object.defineProperty(globalStyles, 'fastBackground', {
    configurable: false,
    enumerable: true,
    get() {
      return cachedBackground[isDarkMode() ? 'dark' : 'light']
    },
  })
}

export const statusBarHeight = iPhoneXHelper.getStatusBarHeight(true)
export const hairlineWidth = StyleSheet.hairlineWidth
// @ts-ignore TODO fix native styles
export const styleSheetCreate = obj => styleSheetCreateProxy(obj, o => StyleSheet.create(o))
export {isDarkMode}
export const collapseStyles = (
  styles: ReadonlyArray<CollapsibleStyle>
): ReadonlyArray<Object | null | false> => {
  // if we have no / singular values we pass those on in the hopes they're consts
  const nonNull = styles.filter(s => {
    if (!s) {
      return false
    }
    // has a value?
    for (const _ in s) {
      return true
    }
    return false
  })
  if (!nonNull.length) {
    return undefined as any
  }
  if (nonNull.length === 1) {
    const s = nonNull[0]
    if (typeof s === 'object') {
      return s as any
    }
  }
  // rn allows falsy values so let memoized values through
  return styles as any
}
export const transition = () => ({})
export const backgroundURL = () => ({})
export const styledKeyframes = () => null

export {isMobile, isPhone, isTablet, fileUIName, isIPhoneX, isIOS, isAndroid} from '../constants/platform'
export {
  globalMargins,
  backgroundModeToColor,
  backgroundModeToTextColor,
  platformStyles,
  padding,
} from './shared'
export {default as styled} from '@emotion/native'
export {themed as globalColors} from './colors'
export {default as classNames} from 'classnames'
export const borderRadius = 6
export const dimensionWidth = Dimensions.get('window').width
export const dimensionHeight = Dimensions.get('window').height
export const headerExtraHeight = isTablet ? 16 : 0
export const StyleContext = React.createContext({canFixOverdraw: true})
export const undynamicColor = (col: any) => {
  // try and unwrap, some things (toggle?) don't seems to like mixed dynamic colors
  if (typeof col !== 'string' && col.dynamic) {
    return col.dynamic[isDarkMode() ? 'dark' : 'light']
  }
  return col
}
