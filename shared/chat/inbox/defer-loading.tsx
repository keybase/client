import * as React from 'react'
import * as Container from '../../util/container'
import Inbox from './container'
import {useIsFocused} from '@react-navigation/native'

type Props = Container.RouteProps<{}>

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false

const Deferred = (props: Props) => {
    const isFocused = useIsFocused()
  _everFocused = _everFocused || isFocused
  return _everFocused ? <Inbox navKey={props.navigation.state.key} /> : null
}

// @ts-ignore TS doesn't understand hoisting
Deferred.navigationOptions = Inbox.navigationOptions

export default Deferred
