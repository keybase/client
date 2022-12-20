import * as Styles from '../styles'
import type {MetaType, TextType, Background} from './text'

export function defaultColor(backgroundMode: Background | null) {
  return {
    Announcements: Styles.globalColors.white,
    Documentation: Styles.globalColors.white,
    HighRisk: Styles.globalColors.white,
    Information: Styles.globalColors.brown_75,
    Normal: Styles.globalColors.white,
    Success: Styles.globalColors.white,
    Terminal: Styles.globalColors.white,
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
    negative: Styles.globalColors.white,
    positive: Styles.globalColors.black,
  }

  const _blueLink = {
    negative: Styles.globalColors.white,
    positive: Styles.globalColors.blueDark,
  }
  return {
    Body: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodyBig: {
      colorForBackground: whiteNegative,
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodyBigExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodyBigLink: {
      colorForBackground: _blueLink,
      fontSize: 15,
      isLink: true,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodyBold: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: Styles.globalStyles.fontBold,
    },
    BodyExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodyItalic: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: {
        ...Styles.globalStyles.fontRegular,
        fontStyle: 'italic',
      },
    },
    BodyPrimaryLink: {
      colorForBackground: _blueLink,
      fontSize: 14,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySecondaryLink: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 14,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySemibold: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodySemiboldItalic: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: {
        ...Styles.globalStyles.fontSemibold,
        fontStyle: 'italic',
      },
    },
    BodySemiboldLink: {
      colorForBackground: _blueLink,
      fontSize: 14,
      isLink: true,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodySmall: {
      colorForBackground: {
        ...whiteNegative,
        positive: Styles.globalColors.black_50,
      },
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallBold: {
      colorForBackground: {
        ...whiteNegative,
        positive: Styles.globalColors.black_50,
      },
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontBold,
    },
    BodySmallError: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.redDark},
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallExtrabold: {
      colorForBackground: {
        ...whiteNegative,
        positive: Styles.globalColors.black_50,
      },
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodySmallExtraboldSecondaryLink: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 13,
      isLink: true,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodySmallItalic: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 13,
      styleOverride: {
        ...Styles.globalStyles.fontRegular,
        fontStyle: 'italic',
      },
    },
    BodySmallPrimaryLink: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.blueDark},
      fontSize: 13,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallSecondaryLink: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 13,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallSemibold: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodySmallSemiboldItalic: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 13,
      styleOverride: {...Styles.globalStyles.fontSemibold, fontStyle: 'italic'},
    },
    BodySmallSemiboldPrimaryLink: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.blueDark},
      fontSize: 13,
      isLink: true,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodySmallSemiboldSecondaryLink: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 13,
      isLink: true,
      styleOverride: {...Styles.globalStyles.fontSemibold, textDecoration: undefined},
    },
    BodySmallSuccess: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.greenDark},
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallWallet: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.purpleDark},
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodyTiny: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 12,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodyTinyBold: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 12,
      styleOverride: Styles.globalStyles.fontBold,
    },
    BodyTinyExtrabold: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 12,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodyTinyLink: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 12,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodyTinySemibold: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 12,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodyTinySemiboldItalic: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.black_50},
      fontSize: 12,
      styleOverride: {
        ...Styles.globalStyles.fontSemibold,
        fontStyle: 'italic',
      },
    },
    Header: {
      colorForBackground: whiteNegative,
      fontSize: 18,
      styleOverride: Styles.globalStyles.fontBold,
    },
    HeaderBig: {
      colorForBackground: whiteNegative,
      fontSize: 24,
      styleOverride: Styles.globalStyles.fontBold,
    },
    HeaderBigExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 24,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    HeaderExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 18,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    HeaderItalic: {
      colorForBackground: whiteNegative,
      fontSize: 18,
      styleOverride: {
        ...Styles.globalStyles.fontBold,
        fontStyle: 'italic',
      },
    },
    HeaderLink: {
      colorForBackground: _blueLink,
      fontSize: 18,
      isLink: true,
      styleOverride: Styles.globalStyles.fontBold,
    },
    Nyctographic: {
      colorForBackground: whiteNegative,
      fontSize: 14,
      styleOverride: Styles.globalStyles.fontNyctographic,
    },
    Terminal: {
      colorForBackground: {
        negative: Styles.globalColors.blueLighter,
        positive: Styles.globalColors.blueLighter,
      },
      fontSize: 13,
      styleOverride: {
        ...Styles.globalStyles.fontTerminal,
        lineHeight: '20px',
      },
    },
    TerminalComment: {
      colorForBackground: {
        negative: Styles.globalColors.blueLighter_40,
        positive: Styles.globalColors.blueLighter_40,
      },
      fontSize: 13,
      styleOverride: {
        ...Styles.globalStyles.fontTerminal,
        lineHeight: '20px',
      },
    },
    TerminalEmpty: {
      colorForBackground: {
        negative: Styles.globalColors.blueLighter_40,
        positive: Styles.globalColors.blueLighter_40,
      },
      fontSize: 13,
      styleOverride: {
        ...Styles.globalStyles.fontTerminal,
        height: 20,
        lineHeight: '20px',
      },
    },
    TerminalInline: {
      colorForBackground: {...whiteNegative, positive: Styles.globalColors.blueDarker},
      fontSize: 13,
      styleOverride: {
        ...Styles.globalStyles.fontTerminal,
        backgroundColor: Styles.globalColors.blueLighter2,
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
  if (Styles.isDarkMode()) {
    _darkMetaData = _darkMetaData || _metaData()
    return _darkMetaData
  } else {
    _lightMetaData = _lightMetaData || _metaData()
    return _lightMetaData
  }
}
