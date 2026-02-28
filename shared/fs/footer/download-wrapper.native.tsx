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

  const ensureStarted = React.useCallback(() => {
    if (started.current) {
      return
    }
    started.current = true
    opacityAnimation.start(({finished}) => finished && props.dismiss())
  }, [opacityAnimation, props])

  const ensureStopped = React.useCallback(() => {
    if (!started.current) {
      return
    }
    opacityAnimation.stop()
    opacity.setValue(1)
    started.current = false
  }, [opacityAnimation, opacity])

  React.useEffect(() => {
    const update = () => {
      props.isFirst && props.done ? ensureStarted() : ensureStopped()
    }

    update()

    return () => {
      ensureStopped()
    }
  }, [props.isFirst, props.done, ensureStarted, ensureStopped])

  return <NativeAnimated.View style={{opacity}}>{props.children}</NativeAnimated.View>
}

export default DownloadNativeWrapper
