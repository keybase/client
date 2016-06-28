/* @flow */
// Styles from our designers

import {OS} from '../constants/platform'
import {OS_IOS, OS_ANDROID} from '../constants/platform.shared'
import NavigatorNavigationBarStyles from 'react-native/Libraries/CustomComponents/Navigator/NavigatorNavigationBarStylesIOS'

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
  textDecoration: (type: string) => ({ // eslint-disable-line arrow-parens
    textDecorationLine: type,
  }),
}

export const globalStyles = {
  ...font,
  ...util,
}

export const globalMargins = {
  xtiny: 4,
  tiny: 8,
  small: 16,
  medium: 32,
  large: 48,
  xlarge: 64,
}

export const navBarHeight = OS === OS_ANDROID ? 60 : NavigatorNavigationBarStyles.General.TotalNavHeight
export const tabBarHeight = 48
