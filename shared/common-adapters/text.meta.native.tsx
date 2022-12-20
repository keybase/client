import * as Styles from '../styles'
import type {MetaType, TextType, Background} from './text'

export function defaultColor(backgroundMode: Background | null) {
  return {
    get Announcements() {
      return Styles.globalColors.white
    },
    get Documentation() {
      return Styles.globalColors.white
    },
    get HighRisk() {
      return Styles.globalColors.white
    },
    get Information() {
      return Styles.globalColors.brown_75
    },
    get Normal() {
      return Styles.globalColors.white
    },
    get Success() {
      return Styles.globalColors.white
    },
    get Terminal() {
      return Styles.globalColors.white
    },
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
  }[String(fontSize)] as number

  return {
    fontSize,
    lineHeight,
  }
}

const _metaData = (): {[K in TextType]: MetaType} => {
  // you CANNOT spread these else the getters dissappear and your colors will be wrong
  const whiteNegative = {
    get negative() {
      return Styles.globalColors.white
    },
    get positive() {
      return Styles.globalColors.black
    },
  }
  const whiteNegative_50 = {
    get negative() {
      return Styles.globalColors.white
    },
    get positive() {
      return Styles.globalColors.black_50
    },
  }

  const _blueLink = {
    get negative() {
      return Styles.globalColors.white
    },
    get positive() {
      return Styles.globalColors.blueDark
    },
  }
  return {
    Body: {
      colorForBackground: whiteNegative,
      fontSize: 16,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodyBig: {
      colorForBackground: whiteNegative,
      fontSize: 17,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodyBigExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 17,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodyBigLink: {
      colorForBackground: _blueLink,
      fontSize: 17,
      isLink: true,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodyBold: {
      colorForBackground: whiteNegative,
      fontSize: 16,
      styleOverride: Styles.globalStyles.fontBold,
    },
    BodyExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 16,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodyItalic: {
      colorForBackground: whiteNegative,
      fontSize: 16,
      styleOverride: {
        ...Styles.globalStyles.fontRegular,
        fontStyle: 'italic',
      },
    },
    BodyPrimaryLink: {
      colorForBackground: _blueLink,
      fontSize: 16,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySecondaryLink: {
      colorForBackground: whiteNegative_50,
      fontSize: 16,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySemibold: {
      colorForBackground: whiteNegative,
      fontSize: 16,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodySemiboldItalic: {
      colorForBackground: whiteNegative,
      fontSize: 16,
      styleOverride: {
        ...Styles.globalStyles.fontSemibold,
        fontStyle: 'italic',
      },
    },
    BodySemiboldLink: {
      colorForBackground: _blueLink,
      fontSize: 16,
      isLink: true,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodySmall: {
      colorForBackground: whiteNegative_50,
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallBold: {
      colorForBackground: whiteNegative_50,
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontBold,
    },
    BodySmallError: {
      colorForBackground: {
        get negative() {
          return Styles.globalColors.white
        },
        get positive() {
          return Styles.globalColors.redDark
        },
      },
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallExtrabold: {
      colorForBackground: whiteNegative_50,
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodySmallExtraboldSecondaryLink: {
      colorForBackground: whiteNegative_50,
      fontSize: 15,
      isLink: true,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodySmallItalic: {
      colorForBackground: whiteNegative_50,
      fontSize: 15,
      styleOverride: {
        ...Styles.globalStyles.fontRegular,
        fontStyle: 'italic',
      },
    },
    BodySmallPrimaryLink: {
      colorForBackground: _blueLink,
      fontSize: 15,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallSecondaryLink: {
      colorForBackground: whiteNegative_50,
      fontSize: 15,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallSemibold: {
      colorForBackground: whiteNegative_50,
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodySmallSemiboldItalic: {
      colorForBackground: whiteNegative_50,
      fontSize: 15,
      styleOverride: {...Styles.globalStyles.fontSemibold, fontStyle: 'italic'},
    },
    BodySmallSemiboldPrimaryLink: {
      colorForBackground: _blueLink,
      fontSize: 15,
      isLink: true,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodySmallSemiboldSecondaryLink: {
      colorForBackground: _blueLink,
      fontSize: 15,
      isLink: true,
      styleOverride: {...Styles.globalStyles.fontSemibold, textDecorationLine: undefined},
    },
    BodySmallSuccess: {
      colorForBackground: {
        get negative() {
          return Styles.globalColors.white
        },
        get positive() {
          return Styles.globalColors.greenDark
        },
      },
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallWallet: {
      colorForBackground: {
        get negative() {
          return Styles.globalColors.white
        },
        get positive() {
          return Styles.globalColors.purpleDark
        },
      },
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodyTiny: {
      colorForBackground: whiteNegative_50,
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodyTinyBold: {
      colorForBackground: whiteNegative_50,
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontBold,
    },
    BodyTinyExtrabold: {
      colorForBackground: whiteNegative_50,
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    BodyTinyLink: {
      colorForBackground: whiteNegative_50,
      fontSize: 13,
      isLink: true,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodyTinySemibold: {
      colorForBackground: whiteNegative_50,
      fontSize: 13,
      styleOverride: Styles.globalStyles.fontSemibold,
    },
    BodyTinySemiboldItalic: {
      colorForBackground: whiteNegative_50,
      fontSize: 13,
      styleOverride: {
        ...Styles.globalStyles.fontSemibold,
        fontStyle: 'italic',
      },
    },
    Header: {
      colorForBackground: whiteNegative,
      fontSize: 20,
      styleOverride: Styles.globalStyles.fontBold,
    },
    HeaderBig: {
      colorForBackground: whiteNegative,
      fontSize: 28,
      styleOverride: Styles.globalStyles.fontBold,
    },
    HeaderBigExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 28,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    HeaderExtrabold: {
      colorForBackground: whiteNegative,
      fontSize: 20,
      styleOverride: Styles.globalStyles.fontExtrabold,
    },
    HeaderItalic: {
      colorForBackground: whiteNegative,
      fontSize: 20,
      styleOverride: {
        ...Styles.globalStyles.fontBold,
        fontStyle: 'italic',
      },
    },
    HeaderLink: {
      colorForBackground: _blueLink,
      fontSize: 20,
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
        get negative() {
          return Styles.globalColors.blueDarker
        },
        get positive() {
          return Styles.globalColors.blueLighter
        },
      },
      fontSize: 15,
      styleOverride: {
        ...Styles.globalStyles.fontTerminal,
        lineHeight: 20,
      },
    },
    TerminalComment: {
      colorForBackground: {
        get negative() {
          return Styles.globalColors.blueLighter_40
        },
        get positive() {
          return Styles.globalColors.blueLighter_40
        },
      },
      fontSize: 15,
      styleOverride: {
        ...Styles.globalStyles.fontTerminal,
        lineHeight: 20,
      },
    },
    TerminalEmpty: {
      colorForBackground: {
        get negative() {
          return Styles.globalColors.blueLighter_40
        },
        get positive() {
          return Styles.globalColors.blueLighter_40
        },
      },
      fontSize: 15,
      styleOverride: {
        ...Styles.globalStyles.fontTerminal,
        height: 20,
        lineHeight: 20,
      },
    },
    TerminalInline: {
      colorForBackground: {
        get negative() {
          return Styles.globalColors.blueDarker
        },
        get positive() {
          return Styles.globalColors.blueDarker
        },
      },
      fontSize: 15,
      styleOverride: {
        ...Styles.globalStyles.fontTerminal,
        backgroundColor: Styles.globalColors.blueLighter2,
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
  if (Styles.isDarkMode()) {
    _darkMetaData = _darkMetaData || _metaData()
    return _darkMetaData
  } else {
    _lightMetaData = _lightMetaData || _metaData()
    return _lightMetaData
  }
}
