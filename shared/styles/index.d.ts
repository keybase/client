// Styles from our designers
import * as CSS from './css'
export {default as globalColors} from './colors'

export declare const transition: (...properties: Array<string>) => any

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
  fontNyctographic: _fakeFontDefSeeCommentsOnThisStyle
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
  largeWidthPercent: string
  loadingTextStyle: CSS._StylesCrossPlatform
  mediumSubNavWidth: number | string
  mediumWidth: number | string
  opacity0: {opacity: 0}
  positionRelative: {position: 'relative'}
  rounded: {
    borderRadius: 3
  }
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
export declare const statusBarHeight: number
export declare const borderRadius: number
export declare const hairlineWidth: number
export declare function backgroundURL(...path: Array<string>): string

type NamedStyles = {[key: string]: CSS._StylesCrossPlatform}
// order important!
export declare function styleSheetCreate<O extends NamedStyles>(styles: () => O): O

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
export declare const isPhone: boolean
export declare const isTablet: boolean
export declare const isDarkMode: () => boolean
export declare const isIPhoneX: boolean
export declare const dimensionWidth: number
export declare const dimensionHeight: number
export declare const headerExtraHeight: number

export {platformStyles, globalMargins, backgroundModeToColor, backgroundModeToTextColor} from './shared'
export {
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
export {default as styled} from '@emotion/styled'
