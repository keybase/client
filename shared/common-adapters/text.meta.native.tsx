import {globalStyles, globalColors, isDarkMode} from '../styles'

import {MetaType, TextType, Background} from './text'

export function defaultColor(backgroundMode: Background | null) {
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

// need to be `undefined` instead of `null` since `null` doesn't ellipsize at
// all.
export function lineClamp(lines: number | undefined, mode: string | undefined): Object {
  return {
    ...(lines ? {ellipsizeMode: mode, numberOfLines: lines} : null),
  }
}

export function fontSizeToSizeStyle(fontSize: number): {fontSize: number; lineHeight: number} | null {
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

const _metaData = (): {[K in TextType]: MetaType} => {
  const whiteNegative = {
    negative: globalColors.white,
    positive: globalColors.black,
  }

  const _blueLink = {
    negative: globalColors.white,
    positive: globalColors.blue,
  }
  return {
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
      colorForBackground: {...whiteNegative, positive: globalColors.purple},
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
    BodyTinyExtrabold: {
      colorForBackground: {
        ...whiteNegative,
        positive: globalColors.black_50,
      },
      fontSize: 13,
      styleOverride: globalStyles.fontExtrabold,
    },
    BodyTinyLink: {
      colorForBackground: {
        ...whiteNegative,
        positive: globalColors.black_50,
      },
      fontSize: 13,
      isLink: true,
      styleOverride: globalStyles.fontRegular,
    },
    BodyTinySemibold: {
      colorForBackground: {
        ...whiteNegative,
        positive: globalColors.black_50,
      },
      fontSize: 13,
      styleOverride: globalStyles.fontSemibold,
    },
    BodyTinySemiboldItalic: {
      colorForBackground: {
        ...whiteNegative,
        positive: globalColors.black_50,
      },
      fontSize: 13,
      styleOverride: {
        ...globalStyles.fontSemibold,
        fontStyle: 'italic',
      },
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
        negative: globalColors.blueDarker,
        positive: globalColors.blueLighter,
      },
      fontSize: 15,
      styleOverride: {
        ...globalStyles.fontTerminal,
        lineHeight: 20,
      },
    },
    TerminalComment: {
      colorForBackground: {
        negative: globalColors.blueLighter_40,
        positive: globalColors.blueLighter_40,
      },
      fontSize: 15,
      styleOverride: {
        ...globalStyles.fontTerminal,
        lineHeight: 20,
      },
    },
    TerminalEmpty: {
      colorForBackground: {
        negative: globalColors.blueLighter_40,
        positive: globalColors.blueLighter_40,
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
        negative: globalColors.blueDarker,
        positive: globalColors.blueDarker,
      },
      fontSize: 15,
      styleOverride: {
        ...globalStyles.fontTerminal,
        backgroundColor: globalColors.blueLighter2,
        borderRadius: 2,
        height: 20,
        lineHeight: 20,
        padding: 2,
      },
    },
  }
}

let _darkMetaData: {[K in TextType]: MetaType} | undefined
let _lightMetaData: {[K in TextType]: MetaType} | undefined

export const metaData = (): {[K in TextType]: MetaType} => {
  if (isDarkMode()) {
    _darkMetaData = _darkMetaData || _metaData()
    return _darkMetaData
  } else {
    _lightMetaData = _lightMetaData || _metaData()
    return _lightMetaData
  }
}
