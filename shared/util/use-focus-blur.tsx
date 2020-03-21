import * as React from 'react'
import {useNavigationEvents} from './navigation-hooks'
import {NavigationEventCallback} from '@react-navigation/core'

/**
 * useFocusBlur sets up callbacks for when your component is focused or blurred.
 * These happen when you are mounted/unmounted, and when navigation focus and
 * blur events happen.
 */
const useFocusBlur = (onFocus?: () => void, onBlur?: () => void) => {
  const onFocusRef = React.useRef(onFocus)
  const onBlurRef = React.useRef(onBlur)
  React.useEffect(() => {
    onFocusRef.current = onFocus
    onBlurRef.current = onBlur
  })

  const focused = React.useRef(false)
  const callback: NavigationEventCallback = e => {
    if (e.type === 'didFocus' && !focused.current) {
      onFocusRef.current && onFocusRef.current()
      focused.current = true
    } else if (e.type === 'willBlur' && focused.current) {
      onBlurRef.current && onBlurRef.current()
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
      onFocusRef.current && onFocusRef.current()
    }
    focused.current = true
    return () => {
      if (focused.current) {
        onBlurRef.current && onBlurRef.current()
      }
      // doesn't really matter, we are being unmounted anyway
      focused.current = false
    }
  }, [onFocusRef, onBlurRef])
}

export default useFocusBlur
