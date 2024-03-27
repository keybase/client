// Styles from our designers
import type * as React from 'react'
import type * as CSS from './css'
export {default as globalColors} from './colors'
import type {ViewStyle} from 'react-native'

export declare const transition: (...properties: Array<string>) => {transition: string}

type _fakeFontDefSeeCommentsOnThisStyle = {
  fontFamily: 'Keybase'
  fontWeight: '700'
  fontStyle: 'normal'
}

export declare const globalStyles: {
  fillAbsolute: {
    bottom: 0
    left: 0
    position: 'absolute'
    right: 0
    top: 0
  }
  flexBoxCenter: {
    alignItems: 'center'
    justifyContent: 'center'
  }
  flexBoxColumn: {flexDirection: 'column'}
  flexBoxColumnReverse: {flexDirection: 'column-reverse'}
  flexBoxRow: {flexDirection: 'row'}
  flexBoxRowReverse: {flexDirection: 'row-reverse'}
  flexGrow: {flexGrow: 1}
  flexOne: {flex: 1}
  flexWrap: {
    flexWrap: 'wrap'
  }
  fontBold: {
    fontFamily: 'Keybase'
    fontWeight: '700'
    fontStyle: 'normal'
  }
  fontExtrabold: _fakeFontDefSeeCommentsOnThisStyle
  fontRegular: _fakeFontDefSeeCommentsOnThisStyle
  fontSemibold: _fakeFontDefSeeCommentsOnThisStyle
  fontTerminal: _fakeFontDefSeeCommentsOnThisStyle
  fontTerminalSemibold: _fakeFontDefSeeCommentsOnThisStyle
  fullHeight: {height: '100%'}
  fullWidth: {width: '100%'}
  italic: _fakeFontDefSeeCommentsOnThisStyle
  largeWidthPercent: CSS.DimensionValue
  loadingTextStyle: CSS._StylesCrossPlatform
  mediumSubNavWidth: CSS.DimensionValue
  mediumWidth: CSS.DimensionValue
  opacity0: {opacity: 0}
  positionRelative: {position: 'relative'}
  rounded: {borderRadius: 3}
  shortSubNavWidth: number | string
}

export declare const desktopStyles: {
  boxShadow: {boxShadow: ''}
  clickable: {cursor: 'pointer'}
  editable: {cursor: 'text'}
  fadeOpacity: {transition: 'opacity .25s ease-in-out'}
  noSelect: {userSelect: 'none'}
  scrollable: {overflowY: 'auto'}
  windowDragging: {WebkitAppRegion: 'drag'}
  windowDraggingClickable: {WebkitAppRegion: 'no-drag'}
}

export declare const mobileStyles: {}
export declare const fileUIName: string
export declare const borderRadius: number
export declare const hairlineWidth: number

type NamedStyles = {[key: string]: CSS._StylesCrossPlatform}
// order important!
export declare function styleSheetCreate<O extends NamedStyles>(styles: () => O): O

// CollapsibleStyle is a generic version of ?StylesMobile and family,
// slightly extended to support "isFoo && myStyle".
type RemovedStyle = false | '' | 0 | null | undefined
type CollapsibleStyle = CSS.StylesCrossPlatform | RemovedStyle

// TODO better styles that aren't slow
export declare function collapseStyles(styles: ReadonlyArray<CollapsibleStyle>): CSS.StylesCrossPlatform
export declare function collapseStylesDesktop(styles: ReadonlyArray<CollapsibleStyle>): React.CSSProperties
export declare function castStyleDesktop(style: CollapsibleStyle): React.CSSProperties
export declare function castStyleNative(style: CollapsibleStyle): ViewStyle

// new style, used in the common-adapters, not the components, can memo for you
export declare function useCollapseStyles<
  IsMobile = false,
  Ret = IsMobile extends false ? CSS._StylesCrossPlatform : CSS.StylesCrossPlatform,
>(styles: CSS.StylesCrossPlatform, memo?: boolean): undefined | Ret
export declare function useCollapseStylesDesktop(
  styles: CSS.StylesCrossPlatform,
  memo?: boolean
): React.CSSProperties

export declare const windowStyle: {
  minWidth: number
  minHeight: number
  width: number
  height: number
}

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

export declare function padding(
  top: number,
  right?: number,
  bottom?: number,
  left?: number
): {
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
}

export declare const isAndroid: boolean
export declare const isIOS: boolean
export declare const isMobile: boolean
export declare const isPhone: boolean
export declare const isTablet: boolean
export declare const isDarkMode: () => boolean
export declare const dimensionWidth: number
export declare const dimensionHeight: number
export declare const headerExtraHeight: number

export {platformStyles, globalMargins, backgroundModeToColor, backgroundModeToTextColor} from './shared'
export type {
  StylesDesktop,
  StylesMobile,
  StylesCrossPlatform,
  Color,
  CustomStyles,
  _StylesCrossPlatform,
  _StylesDesktop,
  _StylesMobile,
} from './css'
export {default as classNames} from 'classnames'
export declare const CanFixOverdrawContext: React.Context<boolean>
export declare const DarkModeContext: React.Context<boolean>
export declare const undynamicColor: (col: string) => string
// add file:// if its a pure path
export declare const normalizePath: (p: string) => string
// remove file://
export declare const unnormalizePath: (p: string) => string
// fixup file:// with spaces etc
export declare const urlEscapeFilePath: (path: string) => string
