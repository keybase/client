/* global module, require */
// Desktop stub for react-native-safe-area-context.
// Desktop has no safe-area insets; all values are zero.
// SafeAreaInsetsContext must be a real React context so @react-navigation/elements
// can call React.use(SafeAreaInsetsContext) without throwing.
const React = require('react')

const zeroInsets = {bottom: 0, left: 0, right: 0, top: 0}
const zeroFrame = {height: 0, width: 0, x: 0, y: 0}

/* eslint-disable react/display-name */
module.exports = {
  SafeAreaFrameContext: React.createContext(zeroFrame),
  SafeAreaInsetsContext: React.createContext(null),
  SafeAreaProvider: ({children}) => children,
  SafeAreaView: ({children}) => children,
  initialWindowMetrics: null,
  useSafeAreaFrame: () => zeroFrame,
  useSafeAreaInsets: () => zeroInsets,
}
/* eslint-enable react/display-name */
