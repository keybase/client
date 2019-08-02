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

export const lineClamp = (lines: number) => ({
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lines,
  display: '-webkit-box',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  wordBreak: 'break-word',
})

export function fontSizeToSizeStyle(fontSize: number): Object | null {
  const height = {
    '12': 16,
    '13': 17,
    '14': 18,
    '15': 19,
    '18': 22,
    '24': 28,
  }[String(fontSize)]

  const _lineHeight = height ? `${height}px` : null
  return {
    fontSize,
    lineHeight: _lineHeight,
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
      fontSize: 14,
      styleOverride: globalStyles.fontRegular,
    },
    BodyBig: {
      colorForBackground: whiteNegative,
      fontSize: 15,
      styleOverride: globalStyles.fontSemibold,
    },
    BodyBigExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 15,
      styleOverride: globalStyles.fontExtrabold,
    },
    BodyBigLink: {
      colorForBackground: _blueLink,
      fontSize: 15,
      isLink: true,
      styleOverride: globalStyles.fontSemibold,
    },
    BodyExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: globalStyles.fontExtrabold,
    },
    BodyItalic: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: {
        ...globalStyles.fontRegular,
        fontStyle: 'italic',
      },
    },
    BodyPrimaryLink: {
      colorForBackground: _blueLink,
      fontSize: 14,
      isLink: true,
      styleOverride: globalStyles.fontRegular,
    },
    BodySecondaryLink: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 14,
      isLink: true,
      styleOverride: globalStyles.fontRegular,
    },
    BodySemibold: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: globalStyles.fontSemibold,
    },
    BodySemiboldItalic: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: {
        ...globalStyles.fontSemibold,
        fontStyle: 'italic',
      },
    },
    BodySemiboldLink: {
      colorForBackground: _blueLink,
      fontSize: 14,
      isLink: true,
      styleOverride: globalStyles.fontSemibold,
    },
    BodySmall: {
      colorForBackground: {
        ...whiteNegative,
        positive: globalColors.black_50,
      },
      fontSize: 13,
      styleOverride: globalStyles.fontRegular,
    },
    BodySmallBold: {
      colorForBackground: {
        ...whiteNegative,
        positive: globalColors.black_50,
      },
      fontSize: 13,
      styleOverride: globalStyles.fontBold,
    },
    BodySmallError: {
      colorForBackground: {...whiteNegative, positive: globalColors.red},
      fontSize: 13,
      styleOverride: globalStyles.fontRegular,
    },
    BodySmallExtrabold: {
      colorForBackground: {
        ...whiteNegative,
        positive: globalColors.black_50,
      },
      fontSize: 13,
      styleOverride: globalStyles.fontExtrabold,
    },
    BodySmallExtraboldSecondaryLink: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 13,
      isLink: true,
      styleOverride: globalStyles.fontExtrabold,
    },
    BodySmallItalic: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 13,
      styleOverride: {
        ...globalStyles.fontRegular,
        fontStyle: 'italic',
      },
    },
    BodySmallPrimaryLink: {
      colorForBackground: {...whiteNegative, positive: globalColors.blue},
      fontSize: 13,
      isLink: true,
      styleOverride: globalStyles.fontRegular,
    },
    BodySmallSecondaryLink: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 13,
      isLink: true,
      styleOverride: globalStyles.fontRegular,
    },
    BodySmallSemibold: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 13,
      styleOverride: globalStyles.fontSemibold,
    },
    BodySmallSemiboldItalic: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 13,
      styleOverride: {...globalStyles.fontSemibold, fontStyle: 'italic'},
    },
    BodySmallSemiboldPrimaryLink: {
      colorForBackground: {...whiteNegative, positive: globalColors.blue},
      fontSize: 13,
      isLink: true,
      styleOverride: globalStyles.fontSemibold,
    },
    BodySmallSemiboldSecondaryLink: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 13,
      isLink: true,
      styleOverride: {...globalStyles.fontSemibold, textDecoration: undefined},
    },
    BodySmallSuccess: {
      colorForBackground: {...whiteNegative, positive: globalColors.green},
      fontSize: 13,
      styleOverride: globalStyles.fontRegular,
    },
    BodySmallWallet: {
      colorForBackground: {...whiteNegative, positive: globalColors.purple},
      fontSize: 13,
      styleOverride: globalStyles.fontRegular,
    },
    BodyTiny: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 12,
      styleOverride: globalStyles.fontRegular,
    },
    BodyTinyBold: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 12,
      styleOverride: globalStyles.fontBold,
    },
    BodyTinyExtrabold: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 12,
      styleOverride: globalStyles.fontExtrabold,
    },
    BodyTinyLink: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 12,
      isLink: true,
      styleOverride: globalStyles.fontRegular,
    },
    BodyTinySemibold: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 12,
      styleOverride: globalStyles.fontSemibold,
    },
    BodyTinySemiboldItalic: {
      colorForBackground: {...whiteNegative, positive: globalColors.black_50},
      fontSize: 12,
      styleOverride: {
        ...globalStyles.fontSemibold,
        fontStyle: 'italic',
      },
    },
    Header: {
      colorForBackground: whiteNegative,
      fontSize: 18,
      styleOverride: globalStyles.fontBold,
    },
    HeaderBig: {
      colorForBackground: whiteNegative,
      fontSize: 24,
      styleOverride: globalStyles.fontBold,
    },
    HeaderBigExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 24,
      styleOverride: globalStyles.fontExtrabold,
    },
    HeaderExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 18,
      styleOverride: globalStyles.fontExtrabold,
    },
    HeaderItalic: {
      colorForBackground: whiteNegative,
      fontSize: 18,
      styleOverride: {
        ...globalStyles.fontBold,
        fontStyle: 'italic',
      },
    },
    HeaderLink: {
      colorForBackground: _blueLink,
      fontSize: 18,
      isLink: true,
      styleOverride: globalStyles.fontBold,
    },
    Terminal: {
      colorForBackground: {
        negative: globalColors.blueLighter,
        positive: globalColors.blueLighter,
      },
      fontSize: 13,
      styleOverride: {
        ...globalStyles.fontTerminal,
        lineHeight: '20px',
      },
    },
    TerminalComment: {
      colorForBackground: {
        negative: globalColors.blueLighter_40,
        positive: globalColors.blueLighter_40,
      },
      fontSize: 13,
      styleOverride: {
        ...globalStyles.fontTerminal,
        lineHeight: '20px',
      },
    },
    TerminalEmpty: {
      colorForBackground: {
        negative: globalColors.blueLighter_40,
        positive: globalColors.blueLighter_40,
      },
      fontSize: 13,
      styleOverride: {
        ...globalStyles.fontTerminal,
        height: 20,
        lineHeight: '20px',
      },
    },
    TerminalInline: {
      colorForBackground: {...whiteNegative, positive: globalColors.blueDarker},
      fontSize: 13,
      styleOverride: {
        ...globalStyles.fontTerminal,
        backgroundColor: globalColors.blueLighter2,
        borderRadius: 2,
        display: 'inline-block',
        height: 17,
        lineHeight: '16px',
        padding: 2,
        wordWrap: 'break-word',
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
