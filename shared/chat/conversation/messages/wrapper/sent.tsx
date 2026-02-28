import * as React from 'react'
import {Animated} from 'react-native'

type SentProps = {
  children: React.ReactNode
}
export const Sent = React.memo(function Sent(p: SentProps) {
  const {children} = p
  const [done, setDone] = React.useState(false)
  const translateYRef = React.useRef(new Animated.Value(999))
  const [translateY, setTranslateY] = React.useState<null | Animated.Value>(null)

  React.useEffect(() => {
    setTranslateY(translateYRef.current)
  }, [])

  const opacityRef = React.useRef(new Animated.Value(0))
  const [opacity, setOpacity] = React.useState<null | Animated.Value>(null)

  React.useEffect(() => {
    setOpacity(opacityRef.current)
  }, [])
  // only animate up once
  const onceRef = React.useRef(false)

  if (done) {
    return <>{children}</>
  }

  return (
    <Animated.View
      style={{
        opacity: opacity ?? 0,
        overflow: 'hidden',
        transform: [{translateY: translateY ?? 999}],
        width: '100%',
      }}
      onLayout={e => {
        if (onceRef.current) {
          return
        }
        const {height} = e.nativeEvent.layout
        onceRef.current = true
        if (translateY) {
          translateY.setValue(height + 10)
        }
        Animated.parallel([
          ...(opacity ? [Animated.timing(opacity, {duration: 200, toValue: 1, useNativeDriver: true})] : []),
          ...(translateY
            ? [Animated.timing(translateY, {duration: 200, toValue: 0, useNativeDriver: true})]
            : []),
        ]).start(() => {
          setDone(true)
        })
      }}
    >
      {children}
    </Animated.View>
  )
})
