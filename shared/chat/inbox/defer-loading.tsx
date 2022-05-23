import * as React from 'react'
import Inbox from './container'
import {useIsFocused, useNavigationState} from '@react-navigation/core'

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false
const DeferedInner = () => {
  const isFocused = useIsFocused()
  const navKey = useNavigationState(state => state.key)
  _everFocused = _everFocused || isFocused
  return _everFocused ? <Inbox navKey={navKey} /> : null
}

const Deferred = React.memo(DeferedInner, () => true)

export default Deferred
export {getOptions} from './container'
