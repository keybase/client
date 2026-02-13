import * as React from 'react'
import Inbox from './container'
import {useIsFocused, useNavigationState} from '@react-navigation/core'

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false

export default function Deferred() {
  const [visible, setVisible] = React.useState(_everFocused)
  const isFocused = useIsFocused()
  const navKey = useNavigationState(state => state.key)
  React.useEffect(() => {
    _everFocused = _everFocused || isFocused
  }, [isFocused])

  // work around a bug in gesture handler if we show too quickly when going back from a convo on startup
  React.useEffect(() => {
    if (!isFocused || visible) {
      return
    }
    const id = setTimeout(() => {
      setVisible(true)
    }, 100)
    return () => {
      clearTimeout(id)
    }
  }, [isFocused, visible])

  return visible ? <Inbox navKey={navKey} /> : null
}
