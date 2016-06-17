/* @flow */
// Styles from our designers

import {OS} from '../constants/platform'
import {OS_IOS, OS_ANDROID} from '../constants/platform.shared'

export {default as globalColors} from './style-guide-colors'

const fontCommon = {
  letterSpacing: 0.3,
}

const font = {
  [OS_IOS]: {
    fontRegular: {
      ...fontCommon,
      fontFamily: 'Lato',
      fontWeight: '400',
    },
    fontSemibold: {
      ...fontCommon,
      fontFamily: 'Lato',
      fontWeight: '600',
    },
    fontBold: {
      ...fontCommon,
      fontFamily: 'Lato',
      fontWeight: '700',
    },
    italic: {
      fontStyle: 'italic',
    },
    fontTerminal: {
      ...fontCommon,
      fontFamily: 'Source Code Pro',
    },
    fontTerminalSemibold: {
      ...fontCommon,
      fontFamily: 'Source Code Pro',
      fontWeight: '600',
    },
  },
  [OS_ANDROID]: {
    fontRegular: {
      ...fontCommon,
      fontFamily: 'Lato',
    },
    fontSemibold: {
      ...fontCommon,
      fontFamily: 'Lato-Semi',
      fontWeight: 'bold',
    },
    fontBold: {
      ...fontCommon,
      fontFamily: 'Lato',
      fontWeight: 'bold',
    },
    italic: {
      fontFamily: 'Lato-Semibold',
      fontStyle: 'italic',
    },
    fontTerminal: {
      ...fontCommon,
      fontFamily: 'SourceCodePro',
    },
    fontTerminalSemibold: {
      ...fontCommon,
      fontFamily: 'SourceCodePro-Semi',
      fontWeight: 'bold',
    },
  },
// $FlowIssue doesn't understand computed props
}[OS]

const util = {
  flexBoxColumn: {
    flexDirection: 'column',
  },
  flexBoxRow: {
    flexDirection: 'row',
  },
  flexBoxCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rounded: {
    borderRadius: 3,
  },
}

export const globalStyles = {
  ...font,
  ...util,
}
