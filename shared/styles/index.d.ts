// Styles from our designers
import * as CSS from './css'
export {default as globalColors} from './colors'

export declare const transition: (...properties: Array<string>) => Object

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
  flexBoxColumn: {
    flexDirection: 'column'
  }
  flexBoxColumnReverse: {
    flexDirection: 'column-reverse'
  }
  flexBoxRow: {
    flexDirection: 'row'
  }
  flexBoxRowReverse: {
    flexDirection: 'row-reverse'
  }
  flexGrow: {
    flexGrow: 1
  }
  flexOne: {
    flex: 1
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
  fullHeight: {
    height: '100%'
  }
  fullWidth: {
    width: '100%'
  }
  italic: _fakeFontDefSeeCommentsOnThisStyle
  loadingTextStyle: CSS._StylesCrossPlatform
  rounded: {
    borderRadius: 3
  }
}

export declare const desktopStyles: {
  boxShadow?: CSS._StylesDesktop
  clickable?: CSS._StylesDesktop
  editable?: CSS._StylesDesktop
  fadeOpacity?: CSS._StylesDesktop
  noSelect?: CSS._StylesDesktop
  scrollable?: CSS._StylesDesktop
  windowDragging?: CSS._StylesDesktop
  windowDraggingClickable?: CSS._StylesDesktop
}

export declare const mobileStyles: {}
export declare const fileUIName: string
export declare const statusBarHeight: number
export declare const borderRadius: number
export declare const hairlineWidth: number
export declare function backgroundURL(...path: Array<string>): string

export declare function styleSheetCreate<T extends {[K in string]: CSS.StylesCrossPlatform}>(
  map: T | (() => T)
): T

type _Elem = Object | null | false | void
// CollapsibleStyle is a generic version of ?StylesMobile and family,
// slightly extended to support "isFoo && myStyle".
export type CollapsibleStyle = _Elem | ReadonlyArray<_Elem>
export declare function collapseStyles(styles: ReadonlyArray<CollapsibleStyle>): any

export declare const windowStyle: {
  minWidth: number
  minHeight: number
  width: number
  height: number
}

// TODO: this typing is incomplete
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

export declare const styledCss: any
export declare const styledKeyframes: any
export declare const isAndroid: boolean
export declare const isIOS: boolean
export declare const isMobile: boolean
export declare const isDarkMode: () => boolean
export declare const isIPhoneX: boolean
export declare const dimensionWidth: number
export declare const dimensionHeight: number

export {platformStyles, globalMargins, backgroundModeToColor, backgroundModeToTextColor} from './shared'
export {
  StylesDesktop,
  StylesMobile,
  StylesCrossPlatform,
  Color,
  StylesCrossPlatformWithSomeDisallowed,
} from './css'
export {default as classNames} from 'classnames'
export {default as styled} from '@emotion/styled'
