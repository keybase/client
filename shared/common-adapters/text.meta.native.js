// @flow
import {globalStyles, globalColors} from '../styles'

import type {MetaType, TextType, Background} from './text'

function defaultColor(backgroundMode: ?Background) {
  return {
    Normal: globalColors.white,
    Announcements: globalColors.white,
    Success: globalColors.white,
    Information: globalColors.brown_60,
    HighRisk: globalColors.white,
    Documentation: globalColors.white,
    Terminal: globalColors.white,
  }[backgroundMode || 'Normal']
}

function lineClamp(lines: ?number, mode: ?string): Object {
  return {
    ...(lines ? {ellipsizeMode: mode, numberOfLines: lines} : null),
  }
}

function fontSizeToSizeStyle(fontSize: number): ?Object {
  const lineHeight = {
    '28': 33,
    '20': 25,
    '18': 23,
    '16': 21,
    '14': 19,
    '12': 17,
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
    fontSize: 28,
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    styleOverride: globalStyles.fontBold,
  },
  HeaderBigExtrabold: {
    fontSize: 28,
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    styleOverride: globalStyles.fontExtrabold,
  },
  Header: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 20,
    styleOverride: globalStyles.fontSemibold,
  },
  HeaderExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 20,
    styleOverride: globalStyles.fontExtrabold,
  },
  HeaderLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 20,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body big
  BodyBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 18,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyBigLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 18,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body
  Body: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontRegular,
  },
  BodyExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySemibold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySemiboldLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    isLink: true,
    fontSize: 16,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySemiboldItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
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
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodyError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 16,
    styleOverride: globalStyles.fontRegular,
  },
  BodySuccess: {
    colorForBackgroundMode: {Normal: globalColors.green2},
    fontSize: 16,
    styleOverride: globalStyles.fontRegular,
  },
  // Body Small
  BodySmall: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallBold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: globalStyles.fontBold,
  },
  BodySmallExtrabold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  BodySmallInlineLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    isLink: true,
    styleOverride: {...globalStyles.fontRegular, textDecorationLine: undefined},
  },
  BodySmallSemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: {...globalStyles.fontSemibold, fontStyle: 'italic'},
  },
  BodySmallSemiboldInlineLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    isLink: true,
    styleOverride: {...globalStyles.fontSemibold, textDecorationLine: undefined},
  },
  BodySmallPrimaryLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSemiboldPrimaryLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallExtraboldSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSuccess: {
    colorForBackgroundMode: {Normal: globalColors.green2},
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallWallet: {
    colorForBackgroundMode: {Normal: globalColors.purple2},
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  // Body Tiny
  BodyTiny: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontRegular,
  },
  BodyTinySemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontSemibold,
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
      lineHeight: 20,
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
      lineHeight: 20,
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
      height: 20,
      lineHeight: 20,
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
      lineHeight: 20,
      height: 20,
      padding: 2,
    },
  },
}

export {defaultColor, fontSizeToSizeStyle, lineClamp, metaData}
