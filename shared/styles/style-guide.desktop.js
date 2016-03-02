/* @flow */
// Styles from our designers

export const globalColors = {
  blue: '#00bff0',
  green: '#90d05c',
  red: '#e66272',
  grey1: '#444444',
  grey2: '#9e9e9e',
  grey3: '#cccccc',
  grey4: '#e1e1e1',
  grey5: '#f6f6f6',
  highRiskWarning: '#d0021b',
  lightBlue: '#86e2f9',
  lightOrange: '#fc8558',
  lowRiskWarning: '#f5a623',
  orange: '#ff602e',
  white: '#ffffff',
  black: '#000000'
}

export const globalColorsDZ2 = {
  // Keybase Brand Colors
  blue: '#33a0ff',
  blue2: '#66b8ff',
  blue3: '#a8d7ff',
  blue4: '#e6f3ff',

  orange: '#ff6f21',

  yellow: '#fff75a',

  darkBlue: '#195080',
  darkBlue2: '#2470b3',
  darkBlue3: '#001b33',

  green: '#3dcc8e',
  green2: '#36b37c',

  red: '#ff4d61',

  yellowGreen: '#b3db39',
  yellowGreen2: '#89a82c',

  lightGrey: '#f6f6f6',
  lightGrey2: '#ebebeb',
  lightGrey3: '#e0e0e0',

  white: '#ffffff',
  white90: 'rgba(255, 255, 255, 0.90)',
  white75: 'rgba(255, 255, 255, 0.75)',
  white40: 'rgba(255, 255, 255, 0.40)',

  black: '#000000',
  black75: 'rgba(0, 0, 0, 0.75)',
  black60: 'rgba(0, 0, 0, 0.60)',
  black40: 'rgba(0, 0, 0, 0.40)',
  black20: 'rgba(0, 0, 0, 0.20)',
  black10: 'rgba(0, 0, 0, 0.10)',

  brown60: 'rgba(71, 31, 17, 0.6)'
}

export const globalResizing = {
  login: {width: 700, height: 580},
  normal: {width: 900, height: 900}
}

const fontCommon = {
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility'
}

const font = {
  fontRegular: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: 400
  },
  fontSemibold: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: 600
  },
  fontBold: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: 700
  },
  italic: {
    fontStyle: 'italic'
  },
  fontTerminal: {
    ...fontCommon,
    fontFamily: 'Source Code Pro'
  },
  fontTerminalSemibold: {
    ...fontCommon,
    fontFamily: 'Source Code Pro',
    fontWeight: 600
  }
}

const flexBoxCommon = {
  display: 'flex'
}

const util = {
  flexBoxColumn: {
    ...flexBoxCommon,
    flexDirection: 'column'
  },
  flexBoxRow: {
    ...flexBoxCommon,
    flexDirection: 'row'
  },
  noSelect: {
    WebkitUserSelect: 'none'
  },
  windowDragging: { // allow frameless window dragging
    WebkitAppRegion: 'drag'
  },
  windowDraggingClickable: { // allow things in frameless regions to be clicked and not dragged
    WebkitAppRegion: 'no-drag'
  },
  rounded: {
    borderRadius: 3
  },
  windowBorder: {
    border: `solid ${globalColors.grey4}`,
    borderWidth: 1
  },
  clickable: {
    cursor: 'pointer'
  },
  topMost: {
    zIndex: 9999
  }
}

export const globalStyles = {
  ...font,
  ...util
}

export function transition (...properties: Array<string>) : Object {
  return {
    transition: properties.map(p => `${p} 0.3s ease-in`).join(', ')
  }
}

export function transitionColor () : Object {
  return {
    transition: 'background 0.2s linear'
  }
}
