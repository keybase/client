import * as React from 'react'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
import type {Props} from './download-wrapper'

const DownloadNativeWrapper: React.FC<Props> = props => {
  const [opacity] = React.useState(new NativeAnimated.Value(1))
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
    if (started.current) {
      return
    }
    started.current = true
    opacityAnimation.start(({finished}) => finished && props.dismiss())
  }

  const ensureStopped = () => {
    if (!started.current) {
      return
    }
    opacityAnimation.stop()
    opacity.setValue(1)
    started.current = false
  }

  React.useEffect(() => {
    props.isFirst && props.done ? ensureStarted() : ensureStopped()

    return () => {
      ensureStopped()
    }
  })

  return <NativeAnimated.View style={{opacity}}>{props.children}</NativeAnimated.View>
}

export default DownloadNativeWrapper
