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
    '26': 30,
    '18': 22,
    '16': 20,
    '14': 18,
    '12': 16,
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
    fontSize: 26,
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    styleOverride: globalStyles.fontBold,
  },
  Header: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 18,
    styleOverride: globalStyles.fontSemibold,
  },
  HeaderLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 18,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body big
  BodyBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyBigLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body
  Body: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  BodySemibold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 14,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySemiboldLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    isLink: true,
    fontSize: 14,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySemiboldItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 14,
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
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySecondaryLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodyError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  BodySuccess: {
    colorForBackgroundMode: {Normal: globalColors.green2},
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  // Body Small
  BodySmall: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white_40,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white_40,
    },
    fontSize: 12,
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
    fontSize: 12,
    isLink: true,
    styleOverride: {...globalStyles.fontRegular, textDecorationLine: undefined},
  },
  BodySmallSemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white_40,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white_40,
    },
    fontSize: 12,
    styleOverride: {...globalStyles.fontSemibold, fontStyle: 'italic'},
  },
  BodySmallSemiboldInlineLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white_40,
    },
    fontSize: 12,
    isLink: true,
    styleOverride: {...globalStyles.fontSemibold, textDecorationLine: undefined},
  },
  BodySmallPrimaryLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSecondaryLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 12,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 12,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSuccess: {
    colorForBackgroundMode: {Normal: globalColors.green2},
    fontSize: 12,
    styleOverride: globalStyles.fontRegular,
  },
  // Terminal
  Terminal: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3,
      Terminal: globalColors.darkBlue,
    },
    fontSize: 14,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: 20,
    },
  },
  TerminalComment: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3_40,
      Terminal: globalColors.blue3_40,
    },
    fontSize: 14,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: 20,
    },
  },
  TerminalEmpty: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3_40,
      Terminal: globalColors.blue3_40,
    },
    fontSize: 14,
    styleOverride: {
      ...globalStyles.fontTerminal,
      height: 20,
      lineHeight: 20,
    },
  },
  TerminalInline: {
    colorForBackgroundMode: {
      Normal: globalColors.darkBlue,
      Terminal: globalColors.darkBlue,
    },
    fontSize: 14,
    styleOverride: {
      ...globalStyles.fontTerminal,
      backgroundColor: globalColors.blue4,
      borderRadius: 2,
      lineHeight: 18,
      height: 20,
      padding: 2,
    },
  },
}

export {defaultColor, fontSizeToSizeStyle, lineClamp, metaData}
