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

const whiteNegative = {
  negative: globalColors.white,
  positive: globalColors.black,
}

const _blueLink = {
  negative: globalColors.white,
  positive: globalColors.blue,
}

const metaData: {[key: TextType]: MetaType} = {
  Body: {
    colorForBackground: whiteNegative,
    fontSize: 16,
    styleOverride: globalStyles.fontRegular,
  },
  BodyBig: {
    colorForBackground: whiteNegative,
    fontSize: 17,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyBigExtrabold: {
    colorForBackground: whiteNegative,
    fontSize: 17,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodyBigLink: {
    colorForBackground: _blueLink,
    fontSize: 17,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyExtrabold: {
    colorForBackground: whiteNegative,
    fontSize: 16,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodyItalic: {
    colorForBackground: whiteNegative,
    fontSize: 16,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  BodyPrimaryLink: {
    colorForBackground: {
      ..._blueLink,
      negative: globalColors.white,
    },
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySecondaryLink: {
    colorForBackground: {...whiteNegative, positive: globalColors.black_50},
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySemibold: {
    colorForBackground: whiteNegative,
    fontSize: 16,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySemiboldItalic: {
    colorForBackground: whiteNegative,
    fontSize: 16,
    styleOverride: {
      ...globalStyles.fontSemibold,
      fontStyle: 'italic',
    },
  },
  BodySemiboldLink: {
    colorForBackground: _blueLink,
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmall: {
    colorForBackground: {
      ...whiteNegative,
      positive: globalColors.black_50,
    },
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallBold: {
    colorForBackground: {
      ...whiteNegative,
      positive: globalColors.black_50,
    },
    fontSize: 15,
    styleOverride: globalStyles.fontBold,
  },
  BodySmallError: {
    colorForBackground: {...whiteNegative, positive: globalColors.red},
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallExtrabold: {
    colorForBackground: {
      ...whiteNegative,
      positive: globalColors.black_50,
    },
    fontSize: 15,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallExtraboldSecondaryLink: {
    colorForBackground: {...whiteNegative, positive: globalColors.black_50},
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallItalic: {
    colorForBackground: {
      ...whiteNegative,
      positive: globalColors.black_50,
    },
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  BodySmallPrimaryLink: {
    colorForBackground: _blueLink,
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSecondaryLink: {
    colorForBackground: {...whiteNegative, positive: globalColors.black_50},
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSemibold: {
    colorForBackground: {
      ...whiteNegative,
      positive: globalColors.black_50,
    },
    fontSize: 15,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldItalic: {
    colorForBackground: {
      ...whiteNegative,
      positive: globalColors.black_50,
    },
    fontSize: 15,
    styleOverride: {...globalStyles.fontSemibold, fontStyle: 'italic'},
  },
  BodySmallSemiboldPrimaryLink: {
    colorForBackground: _blueLink,
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldSecondaryLink: {
    colorForBackground: _blueLink,
    fontSize: 15,
    isLink: true,
    styleOverride: {...globalStyles.fontSemibold, textDecorationLine: undefined},
  },
  BodySmallSuccess: {
    colorForBackground: {...whiteNegative, positive: globalColors.green},
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallWallet: {
    colorForBackground: {...whiteNegative, positive: globalColors.purple2},
    fontSize: 15,
    styleOverride: globalStyles.fontRegular,
  },
  BodyTiny: {
    colorForBackground: {
      ...whiteNegative,
      positive: globalColors.black_50,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodyTinyBold: {
    colorForBackground: {
      ...whiteNegative,
      positive: globalColors.black_50,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontBold,
  },
  BodyTinySemibold: {
    colorForBackground: {
      ...whiteNegative,
      positive: globalColors.black_50,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontSemibold,
  },
  Header: {
    colorForBackground: whiteNegative,
    fontSize: 20,
    styleOverride: globalStyles.fontBold,
  },
  HeaderBig: {
    colorForBackground: whiteNegative,
    fontSize: 28,
    styleOverride: globalStyles.fontBold,
  },
  HeaderBigExtrabold: {
    colorForBackground: whiteNegative,
    fontSize: 28,
    styleOverride: globalStyles.fontExtrabold,
  },
  HeaderExtrabold: {
    colorForBackground: whiteNegative,
    fontSize: 20,
    styleOverride: globalStyles.fontExtrabold,
  },
  HeaderItalic: {
    colorForBackground: whiteNegative,
    fontSize: 20,
    styleOverride: {
      ...globalStyles.fontBold,
      fontStyle: 'italic',
    },
  },
  HeaderLink: {
    colorForBackground: _blueLink,
    fontSize: 20,
    isLink: true,
    styleOverride: globalStyles.fontBold,
  },
  Terminal: {
    colorForBackground: {
      negative: globalColors.darkBlue,
      positive: globalColors.blue3,
    },
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: 20,
    },
  },
  TerminalComment: {
    colorForBackground: {
      negative: globalColors.blue3_40,
      positive: globalColors.blue3_40,
    },
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: 20,
    },
  },
  TerminalEmpty: {
    colorForBackground: {
      negative: globalColors.blue3_40,
      positive: globalColors.blue3_40,
    },
    fontSize: 15,
    styleOverride: {
      ...globalStyles.fontTerminal,
      height: 20,
      lineHeight: 20,
    },
  },
  TerminalInline: {
    colorForBackground: {
      negative: globalColors.darkBlue,
      positive: globalColors.darkBlue,
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
