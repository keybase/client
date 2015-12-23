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
  white: '#ffffff'
}

const font = {
  fontRegular: {
    fontFamily: 'Noto Sans'
  },
  fontBold: {
    fontFamily: 'Noto Sans Bold'
  },
  fontItalic: {
    fontFamily: 'Noto Sans Italic'
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
  }
}

export const globalStyles = {
  ...font,
  ...util
}
