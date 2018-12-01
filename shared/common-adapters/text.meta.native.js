// @flow
import {globalStyles, globalColors} from '../styles'

import type {MetaType, TextType, Background} from './text'

function defaultColor(backgroundMode: ?Background) {
  return {
    Announcements: globalColors.white,
    Documentation: globalColors.white,
    HighRisk: globalColors.white,
    Information: globalColors.brown_60,
    Normal: globalColors.white,
    Success: globalColors.white,
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
    '12': 17,
    '14': 19,
    '16': 21,
    '18': 23,
    '20': 25,
    '28': 33,
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
  Body: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontRegular,
  },
  BodyBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 18,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyBigExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 18,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodyBigLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 18,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodyItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  // Body big
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
  BodySemibold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body
  BodySemiboldItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: {
      ...globalStyles.fontSemibold,
      fontStyle: 'italic',
    },
  },
  BodySemiboldLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmall: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallExtrabold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallExtraboldSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontExtrabold,
  },
  Header: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 20,
    styleOverride: globalStyles.fontSemibold,
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
  // Body Small
  HeaderBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 28,
    styleOverride: globalStyles.fontBold,
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
  HeaderBigExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 28,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  HeaderExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 20,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallSemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: globalStyles.fontSemibold,
  },
  HeaderItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 20,
    styleOverride: {
      ...globalStyles.fontSemibold,
      fontStyle: 'italic',
    },
  },
  BodySmallSemiboldItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    styleOverride: {...globalStyles.fontSemibold, fontStyle: 'italic'},
  },
  HeaderLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 20,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
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
  BodySmallSemiboldSecondaryLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    isLink: true,
    styleOverride: {...globalStyles.fontSemibold, textDecorationLine: undefined},
  },
  BodySmallSuccess: {
    colorForBackgroundMode: {Normal: globalColors.green},
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
  BodyTinyBold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontBold,
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
      height: 20,
      lineHeight: 20,
      padding: 2,
    },
  },
}

export {defaultColor, fontSizeToSizeStyle, lineClamp, metaData}
