import * as React from 'react'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'

type Props = {
  dismiss: () => void
  done: boolean
  isFirst: boolean
  children: React.ReactNode
}

const DownloadWrapper = (props: Props): React.ReactNode => {
  const [opacity] = React.useState(() => new NativeAnimated.Value(1))
  const started = React.useRef(false)
  const opacityAnimation = React.useRef(
    NativeAnimated.timing(opacity, {
      duration: 3000,
      easing: NativeEasing.linear,
      toValue: 0,
      useNativeDriver: false,
    })
  ).current

  const ensureStarted = () => {
    if (started.current) return
    started.current = true
    opacityAnimation.start(({finished}) => finished && props.dismiss())
  }

  const ensureStopped = () => {
    if (!started.current) return
    opacityAnimation.stop()
    opacity.setValue(1)
    started.current = false
  }

  React.useEffect(() => {
    if (!isMobile) return
    if (props.isFirst && props.done) {
      ensureStarted()
    } else {
      ensureStopped()
    }
    return () => {
      ensureStopped()
    }
  })

  if (!isMobile) {
    return props.children
  }

  return <NativeAnimated.View style={{opacity}}>{props.children}</NativeAnimated.View>
}

export default DownloadWrapper
