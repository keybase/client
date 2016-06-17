/* @flow */
// Styles from our designers

export {default as globalColors} from './style-guide-colors'

export const globalResizing = {
  login: {width: 700, height: 580},
  normal: {width: 900, height: 900},
}

const fontCommon = {
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
  letterSpacing: '0.3px',
}

const font = {
  fontRegular: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: 400,
  },
  fontSemibold: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: 600,
  },
  fontBold: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: 700,
  },
  italic: {
    fontStyle: 'italic',
  },
  fontTerminal: {
    ...fontCommon,
    fontFamily: 'Source Code Pro',
  },
  fontTerminalSemibold: {
    ...fontCommon,
    fontFamily: 'Source Code Pro',
    fontWeight: 600,
  },
}

const flexBoxCommon = {
  display: 'flex',
}

const util = {
  flexBoxColumn: {
    ...flexBoxCommon,
    flexDirection: 'column',
  },
  flexBoxRow: {
    ...flexBoxCommon,
    flexDirection: 'row',
  },
  flexBoxCenter: {
    ...flexBoxCommon,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollable: {
    overflowY: 'auto',
  },
  selectable: {
    WebkitUserSelect: 'initial',
  },
  noSelect: {
    WebkitUserSelect: 'none',
  },
  windowDragging: { // allow frameless window dragging
    WebkitAppRegion: 'drag',
  },
  windowDraggingClickable: { // allow things in frameless regions to be clicked and not dragged
    WebkitAppRegion: 'no-drag',
  },
  rounded: {
    borderRadius: 3,
  },
  clickable: {
    cursor: 'pointer',
  },
  topMost: {
    zIndex: 9999,
  },
}

export const globalStyles = {
  ...font,
  ...util,
}

export const globalMargins = {
  xtiny: 4,
  tiny: 8,
  small: 16,
  medium: 32,
  large: 48,
  xlarge: 64,
}

export function transition (...properties: Array<string>) : Object {
  return {
    transition: properties.map(p => `${p} 0.2s ease-out`).join(', '),
  }
}

export function transitionColor () : Object {
  return {
    transition: 'background 0.2s linear',
  }
}
