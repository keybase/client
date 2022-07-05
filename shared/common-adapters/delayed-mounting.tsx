import * as React from 'react'
import {useTimeout} from './use-timers'

type Props = {
  delay: number
  children: React.ReactNode
}

const DelayedMounting = (props: Props) => {
  const [showing, setShowing] = React.useState(false)
  const setShowingTrue = useTimeout(() => setShowing(true), props.delay)
  React.useEffect(setShowingTrue, [setShowingTrue])
  return <>{showing && props.children}</>
}

export default DelayedMounting
