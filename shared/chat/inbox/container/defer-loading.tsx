import * as React from 'react'
import * as Kb from '../../../common-adapters'
import Inbox from '.'

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false
const Deferred = () => {
  const [everFocused, _setEverFocused] = React.useState(_everFocused)
  const setEverFocused = React.useCallback(() => {
    _everFocused = true
    _setEverFocused(_everFocused)
  }, [_setEverFocused])
  return everFocused ? <Inbox /> : <Kb.NavigationEvents onWillFocus={setEverFocused} />
}

// @ts-ignore TS doesn't understand hoisting
Deferred.navigationOptions = Inbox.navigationOptions

export default Deferred
