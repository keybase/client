// Styles from our designers

/* ---------------------------------------- */
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

/* ---------------------------------------- */
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

const buttonCommon = {
  ...font.fontRegular,
  borderRadius: 61,
  color: globalColors.white,
  fontSize: 18,
  height: 32,
  lineHeight: '24px',
  textTransform: 'none'
}

const button = {
  buttonPrimary: {
    ...buttonCommon,
    backgroundColor: globalColors.green
  },
  buttonSeconary: {
    ...buttonCommon,
    backgroundColor: globalColors.blue,
    marginRight: 7
  },
  buttonLabel: {
    paddingLeft: 24,
    paddingRight: 24
  }
}

const inputCommon = {
  ...font.fontRegular,
  border: `solid ${globalColors.grey3} 1px`,
  paddingLeft: 9,
  paddingRight: 9
}

const inputMultiCommon = {
  ...inputCommon,
  backgroundColor: globalColors.grey4
}

const input = {
  input: {
    height: 70
  },
  inputNormal: {
    ...inputCommon,
    height: 30
  },
  inputWithError: {
    ...inputCommon,
    height: 30,
    borderColor: globalColors.highRiskWarning
  },
  inputMultiNormal: {
    ...inputMultiCommon
  },
  inputMultiWithError: {
    ...inputMultiCommon,
    borderColor: globalColors.highRiskWarning
  },
  inputUnderline: {
    display: 'none'
  },
  inputError: {
    ...font.fontRegular,
    fontSize: 13,
    lineHeight: '17px',
    paddingTop: 5
  },
  inputHint: {
    ...font.fontRegular,
    left: 0
  },
  inputFloatingLabel: {
    ...font.fontRegular,
    left: 9,
    top: 19
  }
}

const textCommon = {
  ...font.fontRegular,
  ...util.noSelect,
  color: globalColors.grey1,
  cursor: 'default'
}

const text = {
  textHeader: {
    ...textCommon,
    ...font.fontBold,
    fontSize: 18,
    lineHeight: '22px',
    letterSpacing: '0.5px'
  },
  textBody: {
    ...textCommon,
    fontSize: 15,
    lineHeight: '20px',
    letterSpacing: '0.2px'
  },
  textLinkMixin: {
    color: globalColors.blue,
    cursor: 'pointer'
  },
  textSmallMixin: {
    fontSize: 13,
    lineHeight: '17px'
  },
  textReversedMixin: {
    color: globalColors.white
  }
}

export const globalStyles = {
  ...button,
  ...input,
  ...text,
  ...util
}
