// Styles from our designers
import * as CSS from './css'
export {default as globalColors} from './colors'

export declare var transition: (...properties: Array<string>) => Object;

type _fakeFontDefSeeCommentsOnThisStyle = {
  fontFamily: "Keybase",
  fontWeight: "700",
  fontStyle: "normal"
};

export declare var globalStyles: {
  fillAbsolute: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  flexBoxCenter: {
    alignItems: "center",
    justifyContent: "center"
  },
  flexBoxColumn: {
    flexDirection: "column"
  },
  flexBoxColumnReverse: {
    flexDirection: "column-reverse"
  },
  flexBoxRow: {
    flexDirection: "row"
  },
  flexBoxRowReverse: {
    flexDirection: "row-reverse"
  },
  flexGrow: {
    flexGrow: 1
  },
  fontBold: {
    fontFamily: "Keybase",
    fontWeight: "700",
    fontStyle: "normal"
  },
  fontExtrabold: _fakeFontDefSeeCommentsOnThisStyle,
  fontRegular: _fakeFontDefSeeCommentsOnThisStyle,
  fontSemibold: _fakeFontDefSeeCommentsOnThisStyle,
  fontTerminal: _fakeFontDefSeeCommentsOnThisStyle,
  fontTerminalSemibold: _fakeFontDefSeeCommentsOnThisStyle,
  fullHeight: {
    height: "100%"
  },
  italic: _fakeFontDefSeeCommentsOnThisStyle,
  loadingTextStyle: CSS._StylesCrossPlatform,
  rounded: {
    borderRadius: 3
  }
};

export declare var desktopStyles: {
  boxShadow?: CSS._StylesDesktop,
  clickable?: CSS._StylesDesktop,
  editable?: CSS._StylesDesktop,
  fadeOpacity?: CSS._StylesDesktop,
  noSelect?: CSS._StylesDesktop,
  scrollable?: CSS._StylesDesktop,
  windowDragging?: CSS._StylesDesktop,
  windowDraggingClickable?: CSS._StylesDesktop
};

export declare var mobileStyles: {};
export declare var fileUIName: string;
export declare var statusBarHeight: number;
export declare var borderRadius: number;
export declare var hairlineWidth: number;
export declare function backgroundURL(...path: Array<string>): string;

export declare function styleSheetCreate<T extends {
  [K in string]: CSS.StylesCrossPlatform;
}>(map: T): T;

type _Elem = Object | null | false | void;
// CollapsibleStyle is a generic version of ?StylesMobile and family,
// slightly extended to support "isFoo && myStyle".
export type CollapsibleStyle = _Elem | ReadonlyArray<_Elem>;
export declare function collapseStyles(styles: ReadonlyArray<CollapsibleStyle>): any;

export declare var windowStyle: {
  minWidth: number,
  minHeight: number,
  width: number,
  height: number
};

export declare function styled<T>(Component: T): (...styles: Array<any>) => T;

export declare function padding(top: number, right?: number, bottom?: number, left?: number): {
  paddingTop: number,
  paddingRight: number,
  paddingBottom: number,
  paddingLeft: number
};

export declare var styledCss: any;
export declare var styledKeyframes: any;
export declare var isAndroid: boolean;
export declare var isIOS: boolean;
export declare var isMobile: boolean;
export declare var isIPhoneX: boolean;
export declare var dimensionWidth: number;
export declare var dimensionHeight: number;

export {platformStyles, globalMargins, backgroundModeToColor, backgroundModeToTextColor} from './shared'
export { StylesDesktop, StylesMobile, StylesCrossPlatform, Color, StylesCrossPlatformWithSomeDisallowed } from './css';
export {default as classNames} from 'classnames'
