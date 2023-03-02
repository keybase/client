import * as React from 'react'
import * as Shared from './shared'
import * as iPhoneXHelper from 'react-native-iphone-x-helper'
import {colors as lightColors, darkColors, themed} from './colors'
import styleSheetCreateProxy from './style-sheet-proxy'
import {StyleSheet, Dimensions} from 'react-native'
import {isDarkMode} from './dark-mode'
import {isIOS, isTablet} from '../constants/platform'
import type {StylesCrossPlatform} from './css'

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

const cachedBackground = {
  dark: {backgroundColor: darkColors.fastBlank},
  light: {backgroundColor: lightColors.fastBlank},
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

export const statusBarHeight = isIOS ? iPhoneXHelper.getStatusBarHeight(true) : 0
export const hairlineWidth = StyleSheet.hairlineWidth
export const styleSheetCreate = (obj: any) => styleSheetCreateProxy(obj, o => StyleSheet.create(o as any))
// used to find specific styles to help debug perf
// export const styleSheetCreate = (obj: any) => {
//   return styleSheetCreateProxy(obj, o => {
//     Object.keys(o).forEach(name => {
//       const style = o[name]
//       Object.keys(style).forEach(sname => {
//         if (sname === 'borderRadius') {
//           console.log('aaa found style', style, sname)
//         }
//       })
//     })

//     return StyleSheet.create(o as any)
//   })
// }
export {isDarkMode}

// we don't need this at all on mobile
export const useCollapseStyles = (
  styles: StylesCrossPlatform,
  _memo: boolean = false
): undefined | StylesCrossPlatform => {
  return styles
  // const old = React.useRef<undefined | StylesCrossPlatform>(undefined)

  // if (!isArray(styles)) {
  //   const ret = styles || undefined
  //   if (memo) {
  //     if (shallowEqual(old.current, ret)) return old.current
  //     old.current = ret
  //   }
  //   return ret
  // }
  // // if we have no / singular values we pass those on in the hopes they're consts
  // const nonNull = styles.reduce<Array<_StylesCrossPlatform>>((arr, s) => {
  //   // has a value?
  //   if (s && !isEmpty(s)) {
  //     arr.push(s)
  //   }
  //   return arr
  // }, [])
  // if (!nonNull.length) {
  //   old.current = undefined
  //   return undefined
  // }
  // if (nonNull.length === 1) {
  //   const ret = nonNull[0]
  //   if (memo) {
  //     if (shallowEqual(old.current, ret)) return old.current
  //     old.current = ret
  //   }
  //   return ret
  // }

  // // take advantage of memo by collapsing
  // if (memo) {
  //   const collapsed = Object.assign({}, ...nonNull) as _StylesCrossPlatform
  //   const ret = Object.keys(collapsed).length ? collapsed : undefined
  //   if (shallowEqual(old.current, ret)) return old.current
  //   old.current = ret
  //   return ret
  // }
  // // rn allows falsy values so let memoized values through
  // return styles
}
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

export {isMobile, isPhone, isTablet, fileUIName, isIPhoneX, isIOS, isAndroid} from '../constants/platform'
export {
  globalMargins,
  backgroundModeToColor,
  backgroundModeToTextColor,
  platformStyles,
  padding,
} from './shared'
export {themed as globalColors} from './colors'
export {default as classNames} from 'classnames'
export {DarkModeContext} from './dark-mode'
export const borderRadius = 6
export const dimensionWidth = Dimensions.get('window').width
export const dimensionHeight = Dimensions.get('window').height
export const headerExtraHeight = isTablet ? 16 : 0
export const CanFixOverdrawContext = React.createContext(false)
export const undynamicColor = (col: any) => {
  // try and unwrap, some things (toggle?) don't seems to like mixed dynamic colors
  if (typeof col !== 'string' && col.dynamic) {
    return col.dynamic[isDarkMode() ? 'dark' : 'light']
  }
  return col
}
