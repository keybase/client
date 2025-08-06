import * as React from 'react'
import * as Shared from './shared'
import {colors as lightColors} from './colors'
import styleSheetCreateProxy, {type MapToStyles} from './style-sheet-proxy'
import {StyleSheet, Dimensions} from 'react-native'
import {isDarkMode} from './dark-mode'
import {isIOS, isTablet} from '@/constants/platform'
import {useColorScheme} from 'react-native'

type _Elem = object | null | false
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
      fontBold: {fontFamily: 'keybase', fontWeight: '700'},
      fontExtrabold: {fontFamily: 'keybase-extrabold', fontWeight: '800'},
      fontRegular: {fontFamily: 'keybase-medium', fontWeight: '500'},
      fontSemibold: {fontFamily: 'keybase-semibold', fontWeight: '600'},
      fontTerminal: {fontFamily: 'SourceCodePro-Medium'},
      fontTerminalSemibold: {fontFamily: 'SourceCodePro-Semibold', fontWeight: '600'},
      italic: {fontStyle: 'italic'},
    }

const util = {
  ...Shared.util,
  largeWidthPercent: '70%',
  loadingTextStyle: {
    backgroundColor: lightColors.greyLight,
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

export const hairlineWidth = StyleSheet.hairlineWidth
export const styleSheetCreate = (f: () => MapToStyles): unknown =>
  styleSheetCreateProxy(f, o => StyleSheet.create(o as any) as MapToStyles)
// used to find specific styles to help debug perf
export {isDarkMode}

export const collapseStyles = (
  styles: ReadonlyArray<CollapsibleStyle>
): undefined | CollapsibleStyle | ReadonlyArray<object | null | false> => {
  // if we have no / singular values we pass those on in the hopes they're consts
  const nonNull = styles.filter(s => {
    if (!s) {
      return false
    }
    // has a value?
    // eslint-disable-next-line
    for (const _ in s) {
      return true
    }
    return false
  })
  if (!nonNull.length) {
    return undefined
  }
  if (nonNull.length === 1) {
    const s = nonNull[0]
    if (typeof s === 'object') {
      return s
    }
  }
  // rn allows falsy values so let memoized values through
  return styles
}
export const collapseStylesDesktop = collapseStyles
export const transition = () => ({})

export {isMobile, isPhone, isTablet, fileUIName, isIOS, isAndroid} from '@/constants/platform'
export * from './shared'
export {themed as globalColors} from './colors'
export {default as classNames} from 'classnames'
export {DarkModeContext} from './dark-mode'
export const borderRadius = 6
export const dimensionWidth = Dimensions.get('window').width
export const dimensionHeight = Dimensions.get('window').height
export const headerExtraHeight = isTablet ? 16 : 0
export const CanFixOverdrawContext = React.createContext(false)
export const undynamicColor = (_col: string) => {
  const col = _col as string | {dynamic?: {dark: string; light: string}}
  // try and unwrap, some things (toggle?) don't seems to like mixed dynamic colors
  if (typeof col !== 'string' && col.dynamic) {
    return col.dynamic[isDarkMode() ? 'dark' : 'light']
  }
  return col
}
export const normalizePath = (p: string) => {
  if (p.startsWith('/')) {
    return `file://${p}`
  }
  return p
}

export const unnormalizePath = (p: string) => {
  if (p.startsWith('file://')) {
    return p.slice('file://'.length)
  }
  return p
}

export const urlEscapeFilePath = (path: string) => {
  if (path.startsWith('file://')) {
    const parts = path.split('/')
    parts[parts.length - 1] = encodeURIComponent(parts[parts.length - 1]!)
    return parts.join('/')
  }
  return path
}

export const castStyleDesktop = (style: CollapsibleStyle) => style
export const castStyleNative = (style: CollapsibleStyle) => style

export const useIsDarkMode = () => {
  const s = useColorScheme()
  switch (s) {
    case 'light':
      return false
    case 'dark':
      return true
    default:
      return false // TODO check this
  }
}
