import * as Styles from '@/styles'
import type {MetaType, TextType, TextStyle} from './text.shared'

function fontSizeToSizeStyleDesktop(fontSize: 12 | 13 | 14 | 15 | 16 | 17 | 18 | 20 | 24 | 28) {
  const hm = {
    [12]: 16,
    [13]: 17,
    [14]: 18,
    [15]: 19,
    [16]: 20,
    [17]: 21,
    [18]: 22,
    [20]: 24,
    [24]: 28,
    [28]: 32,
  } as const
  const height = hm[fontSize]
  const lineHeight = `${height}px` as const
  return {fontSize, lineHeight}
}

function fontSizeToSizeStyleNative(fontSize: number): {fontSize: number; lineHeight: number} {
  const lineHeight = {
    '13': 17,
    '15': 19,
    '16': 20,
    '17': 21,
    '20': 24,
    '28': 32,
  }[String(fontSize)] as number
  return {fontSize, lineHeight}
}

const _metaDataDesktop = (theme: Styles.Theme): {[K in TextType]: MetaType} => {
  const whiteNegative = {
    negative: theme.white,
    positive: theme.black,
  }
  const _blueLink = {
    negative: theme.white,
    positive: theme.blueDark,
  }
  return {
    Body: {colorForBackground: whiteNegative, fontSize: 14, styleOverride: Styles.globalStyles.fontRegular},
    BodyBig: {colorForBackground: whiteNegative, fontSize: 15, styleOverride: Styles.globalStyles.fontSemibold},
    BodyBigExtrabold: {colorForBackground: whiteNegative, fontSize: 15, styleOverride: Styles.globalStyles.fontExtrabold},
    BodyBigLink: {colorForBackground: _blueLink, fontSize: 15, isLink: true, styleOverride: Styles.globalStyles.fontSemibold},
    BodyBold: {colorForBackground: whiteNegative, fontSize: 14, styleOverride: Styles.globalStyles.fontBold},
    BodyExtrabold: {colorForBackground: whiteNegative, fontSize: 14, styleOverride: Styles.globalStyles.fontExtrabold},
    BodyItalic: {colorForBackground: whiteNegative, fontSize: 14, styleOverride: {...Styles.globalStyles.fontRegular, fontStyle: 'italic'}},
    BodyPrimaryLink: {colorForBackground: _blueLink, fontSize: 14, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodySecondaryLink: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 14, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodySemibold: {colorForBackground: whiteNegative, fontSize: 14, styleOverride: Styles.globalStyles.fontSemibold},
    BodySemiboldItalic: {colorForBackground: whiteNegative, fontSize: 14, styleOverride: {...Styles.globalStyles.fontSemibold, fontStyle: 'italic'}},
    BodySemiboldLink: {colorForBackground: _blueLink, fontSize: 14, isLink: true, styleOverride: Styles.globalStyles.fontSemibold},
    BodySmall: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 13, styleOverride: Styles.globalStyles.fontRegular},
    BodySmallBold: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 13, styleOverride: Styles.globalStyles.fontBold},
    BodySmallError: {colorForBackground: {...whiteNegative, positive: theme.redDark}, fontSize: 13, styleOverride: Styles.globalStyles.fontRegular},
    BodySmallExtrabold: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 13, styleOverride: Styles.globalStyles.fontExtrabold},
    BodySmallExtraboldSecondaryLink: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 13, isLink: true, styleOverride: Styles.globalStyles.fontExtrabold},
    BodySmallItalic: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 13, styleOverride: {...Styles.globalStyles.fontRegular, fontStyle: 'italic'}},
    BodySmallPrimaryLink: {colorForBackground: {...whiteNegative, positive: theme.blueDark}, fontSize: 13, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodySmallSecondaryLink: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 13, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodySmallSemibold: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 13, styleOverride: Styles.globalStyles.fontSemibold},
    BodySmallSemiboldItalic: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 13, styleOverride: {...Styles.globalStyles.fontSemibold, fontStyle: 'italic'}},
    BodySmallSemiboldPrimaryLink: {colorForBackground: {...whiteNegative, positive: theme.blueDark}, fontSize: 13, isLink: true, styleOverride: Styles.globalStyles.fontSemibold},
    BodySmallSemiboldSecondaryLink: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 13, isLink: true, styleOverride: {...Styles.globalStyles.fontSemibold, textDecoration: undefined}},
    BodySmallSuccess: {colorForBackground: {...whiteNegative, positive: theme.greenDark}, fontSize: 13, styleOverride: Styles.globalStyles.fontRegular},
    BodySmallWallet: {colorForBackground: {...whiteNegative, positive: theme.purpleDark}, fontSize: 13, styleOverride: Styles.globalStyles.fontRegular},
    BodyTiny: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 12, styleOverride: Styles.globalStyles.fontRegular},
    BodyTinyBold: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 12, styleOverride: Styles.globalStyles.fontBold},
    BodyTinyExtrabold: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 12, styleOverride: Styles.globalStyles.fontExtrabold},
    BodyTinyLink: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 12, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodyTinySemibold: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 12, styleOverride: Styles.globalStyles.fontSemibold},
    BodyTinySemiboldItalic: {colorForBackground: {...whiteNegative, positive: theme.black_50}, fontSize: 12, styleOverride: {...Styles.globalStyles.fontSemibold, fontStyle: 'italic'}},
    Header: {colorForBackground: whiteNegative, fontSize: 18, styleOverride: Styles.globalStyles.fontBold},
    HeaderBig: {colorForBackground: whiteNegative, fontSize: 24, styleOverride: Styles.globalStyles.fontBold},
    HeaderBigExtrabold: {colorForBackground: whiteNegative, fontSize: 24, styleOverride: Styles.globalStyles.fontExtrabold},
    HeaderExtrabold: {colorForBackground: whiteNegative, fontSize: 18, styleOverride: Styles.globalStyles.fontExtrabold},
    HeaderItalic: {colorForBackground: whiteNegative, fontSize: 18, styleOverride: {...Styles.globalStyles.fontBold, fontStyle: 'italic'}},
    HeaderLink: {colorForBackground: _blueLink, fontSize: 18, isLink: true, styleOverride: Styles.globalStyles.fontBold},
    Terminal: {
      colorForBackground: {negative: theme.blueLighter, positive: theme.blueLighter},
      fontSize: 13,
      styleOverride: Styles.platformStyles({isElectron: {...Styles.globalStyles.fontTerminal, lineHeight: '20px'}}),
    },
    TerminalComment: {
      colorForBackground: {negative: theme.blueLighter_40, positive: theme.blueLighter_40},
      fontSize: 13,
      styleOverride: Styles.platformStyles({isElectron: {...Styles.globalStyles.fontTerminal, lineHeight: '20px'}}),
    },
    TerminalEmpty: {
      colorForBackground: {negative: theme.blueLighter_40, positive: theme.blueLighter_40},
      fontSize: 13,
      styleOverride: Styles.platformStyles({isElectron: {...Styles.globalStyles.fontTerminal, height: 20, lineHeight: '20px'}}),
    },
    TerminalInline: {
      colorForBackground: {...whiteNegative, positive: theme.blueDarker},
      fontSize: 13,
      styleOverride: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.fontTerminal,
          backgroundColor: theme.blueLighter2,
          borderRadius: 2,
          display: 'inline-block',
          height: 17,
          lineHeight: '16px',
          padding: 2,
          wordWrap: 'break-word',
        },
      }),
    },
  }
}

const _metaDataNative = (theme: Styles.Theme): {[K in TextType]: MetaType} => {
  // you CANNOT spread these else the getters disappear and your colors will be wrong
  const whiteNegative = {
    get negative() { return theme.white },
    get positive() { return theme.black },
  }
  const whiteNegative_50 = {
    get negative() { return theme.white },
    get positive() { return theme.black_50 },
  }
  const _blueLink = {
    get negative() { return theme.white },
    get positive() { return theme.blueDark },
  }
  return {
    Body: {colorForBackground: whiteNegative, fontSize: 16, styleOverride: Styles.globalStyles.fontRegular},
    BodyBig: {colorForBackground: whiteNegative, fontSize: 17, styleOverride: Styles.globalStyles.fontSemibold},
    BodyBigExtrabold: {colorForBackground: whiteNegative, fontSize: 17, styleOverride: Styles.globalStyles.fontExtrabold},
    BodyBigLink: {colorForBackground: _blueLink, fontSize: 17, isLink: true, styleOverride: Styles.globalStyles.fontSemibold},
    BodyBold: {colorForBackground: whiteNegative, fontSize: 16, styleOverride: Styles.globalStyles.fontBold},
    BodyExtrabold: {colorForBackground: whiteNegative, fontSize: 16, styleOverride: Styles.globalStyles.fontExtrabold},
    BodyItalic: {colorForBackground: whiteNegative, fontSize: 16, styleOverride: {...Styles.globalStyles.fontRegular, fontStyle: 'italic'}},
    BodyPrimaryLink: {colorForBackground: _blueLink, fontSize: 16, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodySecondaryLink: {colorForBackground: whiteNegative_50, fontSize: 16, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodySemibold: {colorForBackground: whiteNegative, fontSize: 16, styleOverride: Styles.globalStyles.fontSemibold},
    BodySemiboldItalic: {colorForBackground: whiteNegative, fontSize: 16, styleOverride: {...Styles.globalStyles.fontSemibold, fontStyle: 'italic'}},
    BodySemiboldLink: {colorForBackground: _blueLink, fontSize: 16, isLink: true, styleOverride: Styles.globalStyles.fontSemibold},
    BodySmall: {colorForBackground: whiteNegative_50, fontSize: 15, styleOverride: Styles.globalStyles.fontRegular},
    BodySmallBold: {colorForBackground: whiteNegative_50, fontSize: 15, styleOverride: Styles.globalStyles.fontBold},
    BodySmallError: {
      colorForBackground: {
        get negative() { return theme.white },
        get positive() { return theme.redDark },
      },
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallExtrabold: {colorForBackground: whiteNegative_50, fontSize: 15, styleOverride: Styles.globalStyles.fontExtrabold},
    BodySmallExtraboldSecondaryLink: {colorForBackground: whiteNegative_50, fontSize: 15, isLink: true, styleOverride: Styles.globalStyles.fontExtrabold},
    BodySmallItalic: {colorForBackground: whiteNegative_50, fontSize: 15, styleOverride: {...Styles.globalStyles.fontRegular, fontStyle: 'italic'}},
    BodySmallPrimaryLink: {colorForBackground: _blueLink, fontSize: 15, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodySmallSecondaryLink: {colorForBackground: whiteNegative_50, fontSize: 15, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodySmallSemibold: {colorForBackground: whiteNegative_50, fontSize: 15, styleOverride: Styles.globalStyles.fontSemibold},
    BodySmallSemiboldItalic: {colorForBackground: whiteNegative_50, fontSize: 15, styleOverride: {...Styles.globalStyles.fontSemibold, fontStyle: 'italic'}},
    BodySmallSemiboldPrimaryLink: {colorForBackground: _blueLink, fontSize: 15, isLink: true, styleOverride: Styles.globalStyles.fontSemibold},
    BodySmallSemiboldSecondaryLink: {colorForBackground: _blueLink, fontSize: 15, isLink: true, styleOverride: {...Styles.globalStyles.fontSemibold, textDecorationLine: undefined}},
    BodySmallSuccess: {
      colorForBackground: {
        get negative() { return theme.white },
        get positive() { return theme.greenDark },
      },
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodySmallWallet: {
      colorForBackground: {
        get negative() { return theme.white },
        get positive() { return theme.purpleDark },
      },
      fontSize: 15,
      styleOverride: Styles.globalStyles.fontRegular,
    },
    BodyTiny: {colorForBackground: whiteNegative_50, fontSize: 13, styleOverride: Styles.globalStyles.fontRegular},
    BodyTinyBold: {colorForBackground: whiteNegative_50, fontSize: 13, styleOverride: Styles.globalStyles.fontBold},
    BodyTinyExtrabold: {colorForBackground: whiteNegative_50, fontSize: 13, styleOverride: Styles.globalStyles.fontExtrabold},
    BodyTinyLink: {colorForBackground: whiteNegative_50, fontSize: 13, isLink: true, styleOverride: Styles.globalStyles.fontRegular},
    BodyTinySemibold: {colorForBackground: whiteNegative_50, fontSize: 13, styleOverride: Styles.globalStyles.fontSemibold},
    BodyTinySemiboldItalic: {colorForBackground: whiteNegative_50, fontSize: 13, styleOverride: {...Styles.globalStyles.fontSemibold, fontStyle: 'italic'}},
    Header: {colorForBackground: whiteNegative, fontSize: 20, styleOverride: Styles.globalStyles.fontBold},
    HeaderBig: {colorForBackground: whiteNegative, fontSize: 28, styleOverride: Styles.globalStyles.fontBold},
    HeaderBigExtrabold: {colorForBackground: whiteNegative, fontSize: 28, styleOverride: Styles.globalStyles.fontExtrabold},
    HeaderExtrabold: {colorForBackground: whiteNegative, fontSize: 20, styleOverride: Styles.globalStyles.fontExtrabold},
    HeaderItalic: {colorForBackground: whiteNegative, fontSize: 20, styleOverride: {...Styles.globalStyles.fontBold, fontStyle: 'italic'}},
    HeaderLink: {colorForBackground: _blueLink, fontSize: 20, isLink: true, styleOverride: Styles.globalStyles.fontBold},
    Terminal: {
      colorForBackground: {
        get negative() { return theme.blueDarker },
        get positive() { return theme.blueLighter },
      },
      fontSize: 15,
      styleOverride: {...Styles.globalStyles.fontTerminal, lineHeight: 20},
    },
    TerminalComment: {
      colorForBackground: {
        get negative() { return theme.blueLighter_40 },
        get positive() { return theme.blueLighter_40 },
      },
      fontSize: 15,
      styleOverride: {...Styles.globalStyles.fontTerminal, lineHeight: 20},
    },
    TerminalEmpty: {
      colorForBackground: {
        get negative() { return theme.blueLighter_40 },
        get positive() { return theme.blueLighter_40 },
      },
      fontSize: 15,
      styleOverride: {...Styles.globalStyles.fontTerminal, height: 20, lineHeight: 20},
    },
    TerminalInline: {
      colorForBackground: {
        get negative() { return theme.blueDarker },
        get positive() { return theme.blueDarker },
      },
      fontSize: 15,
      styleOverride: {
        ...Styles.globalStyles.fontTerminal,
        backgroundColor: theme.blueLighter2,
        borderRadius: 2,
        height: 20,
        lineHeight: 20,
        padding: 2,
      },
    },
  }
}

const metaData = Styles.createThemedValue(isMobile ? _metaDataNative : _metaDataDesktop)

export function getTextStyle(type: TextType, theme: Styles.Theme): TextStyle {
  const meta = metaData(theme)[type]
  if (!isMobile) {
    const sizeStyle = fontSizeToSizeStyleDesktop(meta.fontSize as Parameters<typeof fontSizeToSizeStyleDesktop>[0])
    const colorStyle = {color: meta.colorForBackground['positive']}
    const cursorStyle = meta.isLink ? {cursor: 'pointer'} : null
    return Styles.platformStyles({
      common: {...meta.styleOverride},
      isElectron: {...sizeStyle, ...colorStyle, ...cursorStyle},
    })
  }
  const sizeStyle = fontSizeToSizeStyleNative(meta.fontSize)
  const colorStyle = {color: meta.colorForBackground['positive']}
  return {...sizeStyle, ...colorStyle, ...meta.styleOverride}
}
