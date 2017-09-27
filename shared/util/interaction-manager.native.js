// @flow
import {InteractionManager} from 'react-native'

// Arbitrary number
InteractionManager.setDeadline(10)
const runAfterInteractions = (f: Function, timeout: number = 500) => {
  // ensure f get called, timeout at given timeout
  // @gre workaround https://github.com/facebook/react-native/issues/8624
  let called = false
  const timeoutId = setTimeout(() => {
    if (__DEV__) {
      console.log('Some animation is taking too long. Could not run after interaction')
    }
    called = true
    f()
  }, timeout)
  InteractionManager.runAfterInteractions(() => {
    if (called) {
      return
    }
    clearTimeout(timeoutId)
    f()
  })
}

export {runAfterInteractions}
