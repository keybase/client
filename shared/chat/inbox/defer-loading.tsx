import * as React from 'react'
import * as Container from '../../util/container'
import Inbox from './container'

// temp before nav 5
// @ts-ignore
import {withNavigationFocus} from '@react-navigation/core'

type Props = Container.RouteProps<{}> & {isFocused: boolean}

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false

const Deferred = withNavigationFocus((props: Props) => {
  _everFocused = _everFocused || props.isFocused
  return _everFocused ? <Inbox navKey={props.navigation.state.key} /> : null
})

// @ts-ignore TS doesn't understand hoisting
Deferred.navigationOptions = Inbox.navigationOptions

export default Deferred
