import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import Inbox from './container'

type Props = Container.RouteProps<{}>

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false
const Deferred = (props: Props) => {
  const navKey = props.navigation.state.key
  const [everFocused, _setEverFocused] = React.useState(_everFocused)
  const setEverFocused = React.useCallback(() => {
    _everFocused = true
    _setEverFocused(_everFocused)
  }, [_setEverFocused])
  return everFocused ? <Inbox navKey={navKey} /> : <Kb.NavigationEvents onWillFocus={setEverFocused} />
}

// @ts-ignore TS doesn't understand hoisting
Deferred.navigationOptions = Inbox.navigationOptions

export default Deferred
