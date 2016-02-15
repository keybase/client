/* @flow */
// Styles from our designers

export const globalColors = {
  blue: '#00bff0',
  green: '#90d05c',
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
  blue: '#00bff0',
  lightBlue1: '#86e2f9',
  lightBlue2: '#c7f4ff',
  orange1: '#ff602e',
  orange2: '#fc8558',
  yellow: '#fff75a',
  darkBlue: '#385f8c',

  // Additional Colors
  green1: '#90d05c',
  green2: '#5bad34',
  red1: '#e66272',
  red2: '#dc001b',

  // Backgrounds
  backgroundGrey: '#f6f6f6',
  backgroundWhite: '#ffffff',

  // Foreground text
  black75: 'rgba(0, 0, 0, 0.75)',
  black40: 'rgba(0, 0, 0, 0.4)',
  black10: 'rgba(0, 0, 0, 0.1)',
  white100: '#ffffff',
  white75: 'rgba(255, 255, 255, 0.75)',
  white40: 'rgba(255, 255, 255, 0.4)'
}

export const globalResizing = {
  login: {width: 700, height: 580}
}

const fontCommon = {
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility'
}

const font = {
  fontRegular: {
    ...fontCommon,
    fontFamily: 'Noto Sans'
  },
  fontBold: {
    ...fontCommon,
    fontFamily: 'Noto Sans Bold'
  },
  fontItalic: {
    ...fontCommon,
    fontFamily: 'Noto Sans Italic'
  },
  fontTerminal: {
    ...fontCommon,
    fontFamily: 'Source Code Pro'
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
