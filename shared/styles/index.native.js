// @flow
import {StatusBar, StyleSheet} from 'react-native'
import {isAndroid, isIOS} from '../constants/platform'
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
  italic: {
    fontStyle: 'italic',
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
    fontWeight: 'normal',
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
  fillAbsolute: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
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
  flexGrow: {
    flexGrow: 1,
  },
  fullHeight: {
    height: '100%',
  },
}

const globalStyles = {
  ...font,
  ...util,
}

// FIXME: StatusBar.currentHeight returns undefined on iOS in RN 0.34
const statusBarHeight = isAndroid ? StatusBar.currentHeight : 20

function backgroundURL(...path: Array<string>): Object {
  return {}
}

const hairlineWidth = StyleSheet.hairlineWidth

export {backgroundURL, globalColors, globalMargins, globalStyles, hairlineWidth, statusBarHeight}
