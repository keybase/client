// @flow
import {globalStyles, globalColors} from '../styles'

import type {MetaType, TextType, Background} from './text'

function defaultColor(backgroundMode: ?Background) {
  return {
    Announcements: globalColors.white,
    Documentation: globalColors.white,
    HighRisk: globalColors.white,
    Information: globalColors.brown_75,
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
    '13': 17,
    '15': 19,
    '16': 20,
    '17': 21,
    '20': 24,
    '28': 32,
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
  Body: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontRegular,
  },
  BodyBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 17,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyBigExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 17,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodyBigLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 17,
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
    colorForBackgroundMode: {Normal: globalColors.black_50},
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySemibold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
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
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallBold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    styleOverride: globalStyles.fontBold,
  },
  BodySmallError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallExtrabold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallExtraboldSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_50},
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  BodySmallPrimaryLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_50},
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    styleOverride: {...globalStyles.fontSemibold, fontStyle: 'italic'},
  },
  BodySmallSemiboldPrimaryLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldSecondaryLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 15,
    isLink: true,
    styleOverride: {...globalStyles.fontSemibold, textDecorationLine: undefined},
  },
  BodySmallSuccess: {
    colorForBackgroundMode: {Normal: globalColors.green},
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallWallet: {
    colorForBackgroundMode: {Normal: globalColors.purple2},
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodyTiny: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodyTinyBold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontBold,
  },
  BodyTinySemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontSemibold,
  },
  Header: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 20,
    styleOverride: globalStyles.fontBold,
  },
  HeaderBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 28,
    styleOverride: globalStyles.fontBold,
  },
  HeaderBigExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 28,
    styleOverride: globalStyles.fontExtrabold,
  },
  HeaderExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 20,
    styleOverride: globalStyles.fontExtrabold,
  },
  HeaderItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 20,
    styleOverride: {
      ...globalStyles.fontBold,
      fontStyle: 'italic',
    },
  },
  HeaderLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 20,
    isLink: true,
    styleOverride: globalStyles.fontBold,
  },
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
