// @flow
// React-native tooling assumes this file is here, so we just require our real entry point

if (global.nativeTest) {
  console.log('From Go:', global.nativeTest.testNum())
  global.nativeTest.timeMarker('User Code JS')
}

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

  let start = 0
  let calls = 0

  let log = (...l) => console._log(...l)

  const NOJIMA_DONE = v => {
    let diff = Date.now() - start
    measureStop('ECHO' + calls++)
    start = 0
    log('aaa done', v, diff)
  }
  const NOJIMA = p => {
    const RPCTypes = require('./constants/types/rpc-gen')
    if (start) {
      throw new Error('only one')
    }
    try {
      start = Date.now()
      measureStart('ECHO' + calls)
      RPCTypes.testEchoRpcPromise(p).then(v => NOJIMA_DONE(v))
    } catch (_) {
      log('aaa call failed')
      start = 0
    }
  }

  window.NOJIMA = NOJIMA
  window.CALL = () => NOJIMA({arg: {a: new Array(100000).fill({m: new Map([[1, 2]])}), m: new Map()}})
  // setInterval(() => NOJIMA({arg: {a: new Array(100000).fill({m: new Map([[1, 2]])}), m: new Map()}}), 2000)
  setInterval(() => CALL(), 5000)
}
