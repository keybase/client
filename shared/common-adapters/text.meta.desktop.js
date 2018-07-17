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

const lineClamp = (lines: number) => ({
  overflow: 'hidden',
  display: '-webkit-box',
  textOverflow: 'ellipsis',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lines,
})

function fontSizeToSizeStyle(fontSize: number): ?Object {
  const height = {
    '24': 28,
    '16': 20,
    '14': 18,
    '13': 17,
    '12': 16,
    '11': 15,
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
  // Header
  HeaderBig: {
    fontSize: 24,
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    styleOverride: globalStyles.fontBold,
  },
  HeaderBigExtrabold: {
    fontSize: 24,
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    styleOverride: globalStyles.fontExtrabold,
  },
  Header: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontSemibold,
  },
  HeaderExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 16,
    styleOverride: globalStyles.fontExtrabold,
  },
  HeaderLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 16,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body big
  BodyBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 14,
    styleOverride: globalStyles.fontSemibold,
  },
  BodyBigLink: {
    colorForBackgroundMode: _blueLink,
    fontSize: 14,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  // Body
  Body: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodyExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 13,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySemibold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 13,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySemiboldLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    isLink: true,
    fontSize: 13,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySemiboldItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
    fontSize: 13,
    styleOverride: {
      ...globalStyles.fontSemibold,
      fontStyle: 'italic',
    },
  },
  BodyPrimaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.blue,
      Terminal: globalColors.white,
    },
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    fontSize: 13,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodyError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  BodySuccess: {
    colorForBackgroundMode: {Normal: globalColors.green2},
    fontSize: 13,
    styleOverride: globalStyles.fontRegular,
  },
  // Body Small
  BodySmall: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallBold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontBold,
  },
  BodySmallExtrabold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: {
      ...globalStyles.fontRegular,
      fontStyle: 'italic',
    },
  },
  BodySmallInlineLink: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    isLink: true,
    styleOverride: {...globalStyles.fontRegular, textDecoration: undefined},
  },
  BodySmallSemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSemiboldItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    styleOverride: {...globalStyles.fontSemibold, fontStyle: 'italic'},
  },
  BodySmallSemiboldInlineLink: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    isLink: true,
    styleOverride: {...globalStyles.fontSemibold, textDecoration: undefined},
  },
  BodySmallPrimaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.blue,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSemiboldPrimaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.blue,
      Terminal: globalColors.white,
    },
    fontSize: 12,
    isLink: true,
    styleOverride: globalStyles.fontSemibold,
  },
  BodySmallSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    fontSize: 12,
    isLink: true,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallExtraboldSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    fontSize: 12,
    isLink: true,
    styleOverride: globalStyles.fontExtrabold,
  },
  BodySmallError: {
    colorForBackgroundMode: {Normal: globalColors.red},
    fontSize: 12,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallSuccess: {
    colorForBackgroundMode: {Normal: globalColors.green2},
    fontSize: 12,
    styleOverride: globalStyles.fontRegular,
  },
  BodySmallWallet: {
    colorForBackgroundMode: {Normal: globalColors.purple2},
    fontSize: 12,
    styleOverride: globalStyles.fontRegular,
  },
  // Body Tiny
  BodyTiny: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 11,
    styleOverride: globalStyles.fontRegular,
  },
  BodyTinySemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    fontSize: 11,
    styleOverride: globalStyles.fontSemibold,
  },
  // Terminal
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
      lineHeight: '16px',
      height: 17,
      padding: 2,
      wordWrap: 'break-word',
    },
  },
}

export {defaultColor, fontSizeToSizeStyle, lineClamp, metaData}
