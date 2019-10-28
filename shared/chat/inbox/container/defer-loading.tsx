import * as React from 'react'
import * as Kb from '../../../common-adapters'
import Inbox from '.'

const Deferred = () => {
  const [everFocused, setEverFocused] = React.useState(false)
  console.log('aaa', everFocused)
  return everFocused ? <Inbox /> : <Kb.NavigationEvents onWillFocus={() => setEverFocused(true)} />
}

export default Deferred
