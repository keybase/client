import type * as React from 'react'
import Animated, {FadeInDown} from 'react-native-reanimated'

// Slide-up + fade for a message you just sent. The thread list is an inverted
// FlatList (cells are flipped with scaleY: -1), so FadeInDown renders on screen
// as sliding up from below. Runs entirely on the UI thread with no re-renders.
export function Sent(p: {children: React.ReactNode}) {
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.container}>
      {p.children}
    </Animated.View>
  )
}

const styles = {container: {width: '100%'}} as const
