import * as React from 'react'
import {StyleSheet, View, Animated, PanResponder} from 'react-native'

// A row swipe container. Shows an action which triggers on a full swipe
export const SwipeTrigger = React.memo(function SwipeTrigger(p: {
  children: React.ReactNode
  actionWidth: number
  makeAction: () => React.ReactNode
  onSwiped: () => void
}) {
  const [pan] = React.useState(new Animated.ValueXY())
  const [hasSwiped, setHasSwiped] = React.useState(false)
  const {children, makeAction, onSwiped} = p
  const resetPosition = React.useCallback(() => {
    setHasSwiped(false)
    Animated.timing(pan, {
      duration: 200,
      toValue: {x: 0, y: 0},
      useNativeDriver: true,
    }).start()
  }, [pan])

  const threshold = 40
  const panResponder = React.useMemo(() => {
    let running = false
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        running = true
        const val = -gestureState.dx > threshold
        return val
      },
      onPanResponderGrant: () => {
        pan.setOffset({x: 0, y: 0})
        pan.setValue({x: 0, y: 0})
        setHasSwiped(true)
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue({x: Math.min(gesture.dx, 0), y: 0})
      },
      onPanResponderRelease: () => {
        if (!running) {
          return
        }
        running = false
        pan.flattenOffset()
        // only swipe if its actually still over
        // _value does exist, TODO maybe use addlistener instead or similar
        const px = pan.x as unknown as {_value: number}
        const val = -px._value
        if (val > threshold) {
          onSwiped()
        }
        resetPosition()
      },
      onPanResponderTerminate: () => {
        if (!running) {
          return
        }
        // eslint-disable-next-line
        running = false
        // _value does exist, TODO maybe use addlistener instead or similar
        const px = pan.x as unknown as {_value: number}
        const val = -px._value
        if (val > threshold) {
          onSwiped()
        }
        resetPosition()
      },
      onStartShouldSetPanResponder: () => false,
    })
  }, [onSwiped, pan, resetPosition])

  const action = React.useMemo((): React.ReactNode => {
    return hasSwiped ? makeAction() : null
  }, [makeAction, hasSwiped])

  return (
    <View style={styles.container}>
      {action ? <Animated.View style={[styles.actionContainerTrigger]}>{action}</Animated.View> : null}
      <Animated.View
        style={[styles.rowContainer, {transform: [{translateX: pan.x}]}]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  actionContainerTrigger: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
  },
  container: {
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  rowContainer: {width: '100%'},
})
