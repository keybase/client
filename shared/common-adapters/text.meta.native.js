// @flow
import {globalStyles, globalColors} from '../styles'

import type {MetaType, TextType, Background} from './text'

function defaultColor(backgroundMode: ?Background) {
  if (!backgroundMode) {
    backgroundMode = 'Normal'
  }

  return {
    Normal: globalColors.white,
    Announcements: globalColors.white,
    Success: globalColors.white,
    Information: globalColors.brown_60,
    HighRisk: globalColors.white,
    Documentation: globalColors.white,
    Terminal: globalColors.white,
  }[backgroundMode]
}

function lineClamp(lines: ?number): Object {
  return {
    ...(lines ? {numberOfLines: lines} : null),
  }
}

function fontSizeToSizeStyle(fontSize: number): ?Object {
  const lineHeight = {
    '27': 32,
    '19': 24,
    '17': 22,
    '15': 20,
    '13': 18,
  }[String(fontSize)]

  return {
    fontSize,
    lineHeight,
  }
}

const _blackNormalWhiteTerminal = {
  Normal: globalColors.black_75,
  Terminal: globalColors.white,
}

const _blueLink = {
  Normal: globalColors.blue,
}

const metaData: {[key: TextType]: MetaType} = {
  // Header
  HeaderBig: {
    fontSize: 27,
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    styleOverride: globalStyles.fontBold,
  },
  Header: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 19,
    styleOverride: globalStyles.fontSemibold,
  },
  HeaderLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 19,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body big
  BodyBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 17,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyBigLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 17,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body
  Body: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodySemibold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 15,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySemiboldLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    isLink: true,
    fontSize: 15,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySemiboldItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontSemibold,
      fontStyle: 'italic',
    },
  },
  BodyPrimaryLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySecondaryLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodyError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodySuccess: {
    colorForBackgroundMode: {Normal: globalColors.green2},
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  // Body Small
  BodySmall: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white_40,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white_40,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  BodySmallInlineLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white_40,
    },
    fontSize: 13,
    isLink: true,
    styleOverride: {...globalStyles.fontRegular, textDecorationLine: undefined},
  },
  BodySmallSemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white_40,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white_40,
    },
    fontSize: 13,
    styleOverride: {...globalStyles.fontSemibold, fontStyle: 'italic'},
  },
  BodySmallSemiboldInlineLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white_40,
    },
    fontSize: 13,
    isLink: true,
    styleOverride: {...globalStyles.fontSemibold, textDecorationLine: undefined},
  },
  BodySmallPrimaryLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSecondaryLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSuccess: {
    colorForBackgroundMode: {Normal: globalColors.green2},
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  // Terminal
  Terminal: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3,
      Terminal: globalColors.darkBlue,
    },
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: 21,
    },
  },
  TerminalComment: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3_40,
      Terminal: globalColors.blue3_40,
    },
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: 21,
    },
  },
  TerminalEmpty: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3_40,
      Terminal: globalColors.blue3_40,
    },
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontTerminal,
      height: 21,
      lineHeight: 21,
    },
  },
  TerminalInline: {
    colorForBackgroundMode: {
      Normal: globalColors.darkBlue,
      Terminal: globalColors.darkBlue,
    },
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontTerminal,
      backgroundColor: globalColors.blue4,
      borderRadius: 2,
      lineHeight: 19,
      height: 21,
      padding: 2,
    },
  },
}

export {defaultColor, fontSizeToSizeStyle, lineClamp, metaData}
