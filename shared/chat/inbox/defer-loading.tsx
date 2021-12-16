import * as React from 'react'
import * as Container from '../../util/container'
import Inbox from './container'
import {useIsFocused, useNavigationState} from '@react-navigation/core'

type Props = Container.RouteProps<{}>

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false

const Deferred = (props: Props) => {
  const isFocused = useIsFocused()
  const navKey = useNavigationState(state => state.key)
  _everFocused = _everFocused || isFocused
  return _everFocused ? <Inbox navKey={navKey} /> : null
}

// @ts-ignore TS doesn't understand hoisting
Deferred.navigationOptions = Inbox.navigationOptions

export default Deferred
