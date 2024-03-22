import * as React from 'react'
import {Animated} from 'react-native'

type SentProps = {
  children: React.ReactNode
}
export const Sent = React.memo(function Sent(p: SentProps) {
  const {children} = p
  const [done, setDone] = React.useState(false)
  const translateY = React.useRef(new Animated.Value(999)).current
  const opacity = React.useRef(new Animated.Value(0)).current
  // only animate up once
  const onceRef = React.useRef(false)

  if (done) {
    return <>{children}</>
  }

  return (
    <Animated.View
      style={{opacity, overflow: 'hidden', transform: [{translateY}], width: '100%'}}
      onLayout={e => {
        if (onceRef.current) {
          return
        }
        const {height} = e.nativeEvent.layout
        onceRef.current = true
        translateY.setValue(height + 10)
        Animated.parallel([
          Animated.timing(opacity, {
            duration: 200,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            duration: 200,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setDone(true)
        })
      }}
    >
      {children}
    </Animated.View>
  )
})
