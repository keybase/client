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
