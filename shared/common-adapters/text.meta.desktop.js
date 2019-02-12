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

const lineClamp = (lines: number) => ({
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lines,
  display: '-webkit-box',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

function fontSizeToSizeStyle(fontSize: number): ?Object {
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
    fontSize: 14,
    styleOverride: globalStyles.fontRegular,
  },
  BodyBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 15,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyBigExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 15,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodyBigLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 15,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 14,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodyItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 14,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  BodyPrimaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.blue,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_50},
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySemibold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
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
  BodySemiboldLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmall: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallBold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontBold,
  },
  BodySmallError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallExtrabold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallExtraboldSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_50},
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  BodySmallPrimaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.blue,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_50},
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    styleOverride: {...globalStyles.fontSemibold, fontStyle: 'italic'},
  },
  BodySmallSemiboldPrimaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.blue,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldSecondaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    isLink: true,
    styleOverride: {...globalStyles.fontSemibold, textDecoration: undefined},
  },
  BodySmallSuccess: {
    colorForBackgroundMode: {Normal: globalColors.green},
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallWallet: {
    colorForBackgroundMode: {Normal: globalColors.purple2},
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodyTiny: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontRegular,
  },
  BodyTinyBold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontBold,
  },
  BodyTinySemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_50,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontSemibold,
  },
  Header: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 18,
    styleOverride: globalStyles.fontBold,
  },
  HeaderBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 24,
    styleOverride: globalStyles.fontBold,
  },
  HeaderBigExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 24,
    styleOverride: globalStyles.fontExtrabold,
  },
  HeaderExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 18,
    styleOverride: globalStyles.fontExtrabold,
  },
  HeaderItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 18,
    styleOverride: {
      ...globalStyles.fontBold,
      fontStyle: 'italic',
    },
  },
  HeaderLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 18,
    isLink: true,
    styleOverride: globalStyles.fontBold,
  },
  Terminal: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3,
      Terminal: globalColors.blue3,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: '20px',
    },
  },
  TerminalComment: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3_40,
      Terminal: globalColors.blue3_40,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontTerminal,
      lineHeight: '20px',
    },
  },
  TerminalEmpty: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3_40,
      Terminal: globalColors.blue3_40,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontTerminal,
      height: 20,
      lineHeight: '20px',
    },
  },
  TerminalInline: {
    colorForBackgroundMode: {
      Normal: globalColors.darkBlue,
    },
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontTerminal,
      backgroundColor: globalColors.blue4,
      borderRadius: 2,
      display: 'inline-block',
      height: 17,
      lineHeight: '16px',
      padding: 2,
      wordWrap: 'break-word',
    },
  },
}

export {defaultColor, fontSizeToSizeStyle, lineClamp, metaData}
