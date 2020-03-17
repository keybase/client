import * as React from 'react'
import {useNavigationEvents} from './navigation-hooks'
import {NavigationEventCallback} from '@react-navigation/core'

/**
 * useFocusBlur sets up callbacks for when your component is focused or blurred.
 * These happen when you are mounted/unmounted, and when navigation focus and
 * blur events happen. onFocus and onBlur should be memoized, if not they may be
 * called more than you expect.
 */
const useFocusBlur = (onFocus?: () => void, onBlur?: () => void) => {
  const focused = React.useRef(false)
  const callback: NavigationEventCallback = e => {
    if (e.type === 'didFocus' && !focused.current) {
      onFocus && onFocus()
      focused.current = true
    } else if (e.type === 'willBlur' && focused.current) {
      onBlur && onBlur()
      focused.current = false
    }
  }
  try {
    useNavigationEvents(callback)
  } catch (err) {
    // ignore; outside the navigation context
  }

  React.useEffect(() => {
    if (!focused.current) {
      onFocus && onFocus()
    }
    focused.current = true
    return () => {
      if (focused.current) {
        onBlur && onBlur()
      }
      // doesn't really matter, we are being unmounted anyway
      focused.current = false
    }
  }, [onFocus, onBlur])
}

export default useFocusBlur
