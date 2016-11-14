// @flow
import {OS} from '../constants/platform'
import {OS_IOS, OS_ANDROID} from '../constants/platform.shared'
import NavigatorNavigationBarStyles from 'react-native/Libraries/CustomComponents/Navigator/NavigatorNavigationBarStylesIOS'
import {StatusBar} from 'react-native'
import globalColors from './colors'

const globalMargins = {
  xtiny: 4,
  tiny: 8,
  small: 16,
  medium: 24,
  large: 40,
  xlarge: 64,
}

const fontCommon = {
}

const font = {
  [OS_IOS]: {
    fontRegular: {
      ...fontCommon,
      fontFamily: 'OpenSans',
      fontWeight: '400',
    },
    fontSemibold: {
      ...fontCommon,
      fontFamily: 'OpenSans',
      fontWeight: '600',
    },
    fontBold: {
      ...fontCommon,
      fontFamily: 'OpenSans',
      fontWeight: '700',
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
      fontFamily: 'OpenSans',
    },
    fontSemibold: {
      ...fontCommon,
      fontFamily: 'OpenSans-Semi',
      fontWeight: 'bold',
    },
    fontBold: {
      ...fontCommon,
      fontFamily: 'OpenSans',
      fontWeight: 'bold',
    },
    italic: {
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
  textDecoration: (type: string) => ({
    textDecorationLine: type,
  }),
  loadingTextStyle: {
    backgroundColor: globalColors.lightGrey,
    height: 16,
  },
}

const globalStyles = {
  ...font,
  ...util,
}

const navBarHeight = OS === OS_ANDROID ? 60 : NavigatorNavigationBarStyles.General.TotalNavHeight
const tabBarHeight = 48
// FIXME: StatusBar.currentHeight returns undefined on iOS in RN 0.34
const statusBarHeight = OS === OS_ANDROID ? StatusBar.currentHeight : 20

function backgroundURL (...path: Array<string>): Object {
  return {}
}

export {
  globalColors,
  backgroundURL,
  navBarHeight,
  tabBarHeight,
  statusBarHeight,
  globalStyles,
  globalMargins,
}
