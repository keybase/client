// @flow
// React-native tooling assumes this file is here, so we just require our real entry point

let lastThing = []
const noop = () => {}
const measureStart =
  // @ts-ignore
  __DEV__ && require && require.Systrace && require.Systrace.beginEvent
    ? name => {
        lastThing.push(name)
        require.Systrace.beginEvent(name)
      }
    : noop

const measureStop =
  // @ts-ignore
  __DEV__ && require && require.Systrace && require.Systrace.endEvent
    ? name => {
        if (name !== lastThing[lastThing.length - 1]) {
          console.log("This isn't something I've seen before. Out of order??")
        } else {
          lastThing.pop()
          // @ts-ignore
          require.Systrace.endEvent()
        }
      }
    : noop

window.performance = {}
window.performance = {
  clearMarks: n => lastThing[lastThing.length - 1] === n && measureStop(n),
  // clearMeasures: l => console.log('Clear Measures', l),
  clearMeasures: noop,
  mark: n => measureStart(n),
  measure: (l, n) => measureStop(n),
}

require('./app/globals.native')
const NativeModules = require('react-native').NativeModules
const darkMode = require('./styles/dark-mode')
const {_setSystemIsDarkMode, _setSystemSupported, _setDarkModePreference} = darkMode

console.disableYellowBox = true
const __REMOTEDEV__ = typeof __REMOTEDEV__ !== 'undefined'

if (__DEV__ && !__REMOTEDEV__ && require && require.Systrace && global.nativeTest) {
  require.Systrace.beginEvent = message => {
    if (message.startsWith('RCTDeviceEventEmitter.emit(["RPC"')) {
      global.nativeTest.traceBeginSection(
        'RCTDeviceEventEmitter: RPC(' + (message.length - 37) + ' bytes): ' + message.substring(35, 35 + 30)
      )
    } else {
      global.nativeTest.traceBeginSection(message, 0)
    }
  }

  require.Systrace.endEvent = () => {
    global.nativeTest.traceEndSection()
  }
}

// Load storybook or the app
if (__STORYBOOK__) {
  const load = require('./storybook/index.native').default
  load()
} else {
  const NativeAppearance = NativeModules.Appearance

  if (NativeAppearance) {
    _setSystemIsDarkMode(NativeAppearance.initialColorScheme === 'dark')
    _setSystemSupported(NativeAppearance.supported === '1')
  }

  const NativeEngine = NativeModules.KeybaseEngine
  try {
    const obj = JSON.parse(NativeEngine.guiConfig)
    if (obj && obj.ui) {
      const dm = obj.ui.darkMode
      switch (dm) {
        case 'system': // fallthrough
        case 'alwaysDark': // fallthrough
        case 'alwaysLight':
          _setDarkModePreference(dm)
          break
      }
    }
  } catch (_) {}
  const {load} = require('./app/index.native')
  load()
}
