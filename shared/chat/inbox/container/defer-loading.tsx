import * as React from 'react'
import * as Kb from '../../../common-adapters'
import Inbox from '.'

const Deferred = () => {
  const [everFocused, setEverFocused] = React.useState(false)
  return everFocused ? <Inbox /> : <Kb.NavigationEvents onWillFocus={() => setEverFocused(true)} />
}

// @ts-ignore TS doesn't understand hoisting
Deferred.navigationOptions = Inbox.navigationOptions

export default Deferred
