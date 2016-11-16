// @flow
import {isAndroid, isIOS} from '../constants/platform'
import NavigatorNavigationBarStyles from 'react-native/Libraries/CustomComponents/Navigator/NavigatorNavigationBarStylesIOS'
import globalColors from './colors'

const globalMargins = {
  xtiny: 4,
  tiny: 8,
  small: 16,
  medium: 24,
  large: 40,
  xlarge: 64,
}

const fontIOS = {
  fontRegular: {
    fontFamily: 'OpenSans',
    fontWeight: '400',
  },
  fontSemibold: {
    fontFamily: 'OpenSans',
    fontWeight: '600',
  },
  fontBold: {
    fontFamily: 'OpenSans',
    fontWeight: '700',
  },
  fontTerminal: {
    fontFamily: 'Source Code Pro',
  },
  fontTerminalSemibold: {
    fontFamily: 'Source Code Pro',
    fontWeight: '600',
  },
}

const fontAndroid = {
  fontRegular: {
    fontFamily: 'OpenSans',
  },
  fontSemibold: {
    fontFamily: 'OpenSans-Semi',
    fontWeight: 'bold',
  },
  fontBold: {
    fontFamily: 'OpenSans',
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
  },
  fontTerminal: {
    fontFamily: 'SourceCodePro',
  },
  fontTerminalSemibold: {
    fontFamily: 'SourceCodePro-Semi',
    fontWeight: 'bold',
  },
}

const font = isIOS ? fontIOS : fontAndroid

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

const navBarHeight = isAndroid ? 60 : NavigatorNavigationBarStyles.General.TotalNavHeight
const tabBarHeight = 48
function backgroundURL (...path: Array<string>): Object {
  return {}
}

export {
  globalColors,
  backgroundURL,
  navBarHeight,
  tabBarHeight,
  globalStyles,
  globalMargins,
}
