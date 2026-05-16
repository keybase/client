import * as Shared from '@/styles/shared'
import {colors as lightColors} from '@/styles/colors'
import styleSheetCreateProxy, {type MapToStyles} from '@/styles/style-sheet-proxy'
import {StyleSheet, Dimensions} from 'react-native'
import {useDarkModeState} from '@/stores/darkmode'
import {isIOS, isTablet} from '@/constants/platform'
import type * as CSS from '@/styles/css'

const font = isIOS
  ? {
      fontBold: {fontFamily: 'Keybase' as const, fontWeight: '700' as const},
      fontExtrabold: {fontFamily: 'Keybase' as const, fontWeight: '800' as const},
      fontRegular: {fontFamily: 'Keybase' as const, fontWeight: '500' as const},
      fontSemibold: {fontFamily: 'Keybase' as const, fontWeight: '600' as const},
      fontTerminal: {fontFamily: 'Source Code Pro Medium' as const},
      fontTerminalSemibold: {fontFamily: 'Source Code Pro Semibold' as const, fontWeight: '600' as const},
      italic: {fontStyle: 'italic' as const},
    }
  : {
      // The fontFamily name must match the font file's name exactly on Android.
      fontBold: {fontFamily: 'keybase' as const, fontWeight: '700' as const},
      fontExtrabold: {fontFamily: 'keybase-extrabold' as const, fontWeight: '800' as const},
      fontRegular: {fontFamily: 'keybase-medium' as const, fontWeight: '500' as const},
      fontSemibold: {fontFamily: 'keybase-semibold' as const, fontWeight: '600' as const},
      fontTerminal: {fontFamily: 'SourceCodePro-Medium' as const},
      fontTerminalSemibold: {fontFamily: 'SourceCodePro-Semibold' as const, fontWeight: '600' as const},
      italic: {fontStyle: 'italic' as const},
    }

const util = {
  ...Shared.util,
  largeWidthPercent: '70%' as const,
  loadingTextStyle: {
    backgroundColor: lightColors.greyLight,
    height: 16,
  },
  mediumSubNavWidth: (isTablet ? 270 : '100%') as CSS.DimensionValue,
  mediumWidth: (isTablet ? 460 : '100%') as CSS.DimensionValue,
  shortSubNavWidth: (isTablet ? 162 : '100%') as CSS.DimensionValue,
}

export const desktopStyles = {
  boxShadow: {},
  clickable: {},
  editable: {},
  fadeOpacity: {},
  noSelect: {},
  scrollable: {},
  windowDragging: {},
  windowDraggingClickable: {},
}

export const mobileStyles = {}

export const globalStyles = {
  ...font,
  ...util,
}

export const hairlineWidth = StyleSheet.hairlineWidth
type NamedStyles = {[key: string]: CSS._StylesCrossPlatform}
export function styleSheetCreate<const O extends NamedStyles>(f: () => O): O
export function styleSheetCreate(f: () => NamedStyles): NamedStyles {
  return styleSheetCreateProxy(f, o => StyleSheet.create(o as any) as MapToStyles) as unknown as NamedStyles
}

export const collapseStyles = (styles: ReadonlyArray<unknown>): CSS.StylesCrossPlatform => {
  const nonNull = styles.filter(s => {
    if (!s) {
      return false
    }
    for (const _ in s as object) {
      return true
    }
    return false
  })
  if (!nonNull.length) {
    return undefined
  }
  if (nonNull.length === 1) {
    const s = nonNull[0]
    if (s && typeof s === 'object') {
      return s as CSS.StylesCrossPlatform
    }
  }
  return styles as CSS.StylesCrossPlatform
}
export const collapseStylesDesktop = collapseStyles

export const transition = (..._properties: Array<string>) => ({})

export {isMobile, isPhone, isTablet, fileUIName, isIOS, isAndroid} from '@/constants/platform'
export * from '@/styles/shared'
export * from '@/styles/styles-base'
export {themed as globalColors} from '@/styles/colors'
export {default as classNames} from '@/styles/class-names'
export type StylesCrossPlatform = CSS.StylesCrossPlatform
export type {Color, _StylesCrossPlatform, _StylesDesktop, _StylesMobile, CustomStyles} from '@/styles/css'
export type CollapsibleStyle = CSS.StylesCrossPlatform | false | '' | 0 | null | undefined
export type Position =
  | 'top left'
  | 'top right'
  | 'bottom right'
  | 'bottom left'
  | 'right center'
  | 'left center'
  | 'top center'
  | 'bottom center'
  | 'center center'
export const borderRadius = 6
export const dimensionWidth = Dimensions.get('window').width
export const dimensionHeight = Dimensions.get('window').height
export const headerExtraHeight = isTablet ? 16 : 0

export const undynamicColor = (_col: string): string => {
  const isDarkMode = useDarkModeState.getState().isDarkMode()
  const col = _col as string | {dynamic?: {dark: string; light: string}}
  // try and unwrap, some things (toggle?) don't seems to like mixed dynamic colors
  if (typeof col !== 'string' && col.dynamic) {
    return col.dynamic[isDarkMode ? 'dark' : 'light']
  }
  return col as string
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
