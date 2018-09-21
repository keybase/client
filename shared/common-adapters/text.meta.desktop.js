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

const _blackNormalWhiteTerminal = {
  Normal: globalColors.black_75,
  Terminal: globalColors.white,
}

const _blueLink = {
  Normal: globalColors.blue,
}

const metaData = {
  // Header
  HeaderBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  HeaderBigExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  Header: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  HeaderItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  HeaderExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  HeaderLink: {
    colorForBackgroundMode: _blueLink,
    isLink: true,
  },
  // Body big
  BodyBig: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  BodyBigLink: {
    colorForBackgroundMode: _blueLink,
    isLink: true,
  },
  BodyBigExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  // Body
  Body: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  BodyItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  BodyExtrabold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  BodySemibold: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  BodySemiboldLink: {
    colorForBackgroundMode: {
      ..._blueLink,
      Terminal: globalColors.white,
    },
    isLink: true,
  },
  BodySemiboldItalic: {
    colorForBackgroundMode: _blackNormalWhiteTerminal,
  },
  BodyPrimaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.blue,
      Terminal: globalColors.white,
    },
    isLink: true,
  },
  BodySecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    isLink: true,
  },
  // Body Small
  BodySmall: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
  },
  BodySmallExtrabold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
  },
  BodySmallItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
  },
  BodySmallSemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
  },
  BodySmallSemiboldItalic: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
  },
  BodySmallSemiboldSecondaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
    isLink: true,
  },
  BodySmallPrimaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.blue,
      Terminal: globalColors.white,
    },
    isLink: true,
  },
  BodySmallSemiboldPrimaryLink: {
    colorForBackgroundMode: {
      Normal: globalColors.blue,
      Terminal: globalColors.white,
    },
    isLink: true,
  },
  BodySmallSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    isLink: true,
  },
  BodySmallExtraboldSecondaryLink: {
    colorForBackgroundMode: {Normal: globalColors.black_60},
    isLink: true,
  },
  BodySmallError: {
    colorForBackgroundMode: {Normal: globalColors.red},
  },
  BodySmallSuccess: {
    colorForBackgroundMode: {Normal: globalColors.green2},
  },
  BodySmallWallet: {
    colorForBackgroundMode: {Normal: globalColors.purple2},
  },
  // Body Tiny
  BodyTiny: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
  },
  BodyTinySemibold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
  },
  BodyTinyBold: {
    colorForBackgroundMode: {
      Normal: globalColors.black_40,
      Terminal: globalColors.white,
    },
  },
  // Terminal
  Terminal: {
    colorForBackgroundMode: {
      Normal: globalColors.blue3,
      Terminal: globalColors.blue3,
    },
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

export {defaultColor, lineClamp, metaData}
