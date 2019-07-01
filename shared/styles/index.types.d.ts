// Styles from our designers
import * as CSS from './css'
export {default as globalColors} from './colors'

export declare const transition: (...properties: Array<string>) => Object

type fontShape = {
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
  fontBold: fontShape
  fontExtrabold: fontShape
  fontRegular: fontShape
  fontSemibold: fontShape
  fontTerminal: fontShape
  fontTerminalSemibold: fontShape
  fullHeight: {
    height: '100%'
  }
  fullWidth: {
    width: '100%'
  }
  italic: fontShape
  loadingTextStyle: CSS._StylesCrossPlatform
  rounded: {
    borderRadius: 3
  }
}

export declare const desktopStyles: {
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
export declare const hairlineWidth: number
export declare function backgroundURL(...path: Array<string>): string

export declare function styleSheetCreate(
  map: {[K in string]: CSS.StylesCrossPlatform}
): {[K in string]: CSS.StylesCrossPlatform}

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

export declare function glamorous(Component: any): (...styles: Array<any>) => any
export declare const isMobile: boolean
export declare const isIPhoneX: boolean

export {platformStyles, globalMargins, backgroundModeToColor, backgroundModeToTextColor} from './shared'
export {
  StylesDesktop,
  StylesMobile,
  StylesCrossPlatform,
  Color,
  StylesCrossPlatformWithSomeDisallowed,
} from './css'
