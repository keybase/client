import type * as React from 'react'
import Animated, {FadeInDown} from 'react-native-reanimated'

// Slide-up + fade for a message you just sent. The thread list (LegendList) is
// NOT inverted, so FadeInDown (enters from 25px below, sliding up into place)
// reads as the row rising from the input bar. Runs entirely on the UI thread
// with no re-renders. The entering animation only plays when this Animated.View
// MOUNTS — callers must key it per message (recycled containers reuse instances).
export function Sent(p: {children: React.ReactNode}) {
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.container}>
      {p.children}
    </Animated.View>
  )
}

const styles = {container: {width: '100%'}} as const
