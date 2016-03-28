/* @flow */
// Styles from our designers

export {default as globalColors} from './style-guide-colors'

const fontCommon = {
  letterSpacing: 0.3
}

const font = {
  fontRegular: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: '400'
  },
  fontSemibold: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: '600'
  },
  fontBold: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: '700'
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
    fontWeight: '600'
  }
}

const util = {
  flexBoxColumn: {
    flexDirection: 'column'
  },
  flexBoxRow: {
    flexDirection: 'row'
  },
  flexBoxCenter: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  rounded: {
    borderRadius: 3
  }
}

export const globalStyles = {
  ...font,
  ...util
}
