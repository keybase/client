import * as React from 'react'
import {Animated} from 'react-native'
// Bookkeep whats animating so it finishes and isn't replaced, if we've animated it we keep the key and use null
const animatingMap = new Map<string, null | React.ReactElement>()

type AnimatedChildProps = {
  animatingKey: string
  children: React.ReactNode
}
const AnimatedChild = React.memo(function AnimatedChild({children, animatingKey}: AnimatedChildProps) {
  const [done, setDone] = React.useState(false)
  const translateY = React.useRef(new Animated.Value(999)).current
  const opacity = React.useRef(new Animated.Value(0)).current
  React.useEffect(() => {
    // on unmount, mark it null
    return () => {
      animatingMap.set(animatingKey, null)
    }
  }, [animatingKey])

  // only animate up once
  const onceRef = React.useRef(false)

  React.useEffect(() => {
    onceRef.current = false
  }, [animatingKey])

  return done ? (
    <>{children}</>
  ) : (
    <Animated.View
      style={{opacity, overflow: 'hidden', transform: [{translateY}], width: '100%'}}
      onLayout={(e: any) => {
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
          animatingMap.set(animatingKey, null)
          setDone(true)
        })
      }}
    >
      {children}
    </Animated.View>
  )
})

type SentProps = {
  children: React.ReactNode
  sentKey: string
}
export const Sent = function Sent(p: SentProps) {
  const {children, sentKey} = p
  const state = animatingMap.get(sentKey)

  // if its animating always show it
  if (state) {
    return state
  }

  // if state is null we already animated it
  if (state === undefined) {
    const c = <AnimatedChild animatingKey={sentKey}>{children}</AnimatedChild>
    animatingMap.set(sentKey, c)
    return c
  } else {
    return <>{children}</>
  }
}
