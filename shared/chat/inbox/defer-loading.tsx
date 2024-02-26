import * as React from 'react'
import Inbox from './container'
import {useIsFocused, useNavigationState} from '@react-navigation/core'

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false

const Deferred = React.memo(function Deferred() {
  const isFocused = useIsFocused()
  const navKey = useNavigationState(state => state.key)
  _everFocused = _everFocused || isFocused
  return _everFocused ? <Inbox navKey={navKey} /> : null
})

const DeferredOuter = () => {
  return <Deferred />
}

export default DeferredOuter
