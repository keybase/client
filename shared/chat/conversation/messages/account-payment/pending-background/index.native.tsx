import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
import type {Props} from '.'

const lightPatternImage = require('../../../../../images/payment-pattern-80.png') as number
const darkPatternImage = require('../../../../../images/dark-payment-pattern-80.png') as number

const PendingBackground = (p: Props) => {
  const {children, style} = p
  const offset = React.useRef(new NativeAnimated.Value(0)).current

  C.useOnMountOnce(() => {
    NativeAnimated.loop(
      NativeAnimated.timing(offset, {
        duration: 2000,
        easing: NativeEasing.linear,
        toValue: -80,
        useNativeDriver: true,
      })
    ).start()
  })

  const source = Kb.Styles.isDarkMode() ? darkPatternImage : lightPatternImage

  return (
    <Kb.Box2 direction="vertical" style={style}>
      <NativeAnimated.Image
        resizeMode="repeat"
        source={source}
        style={[styles.image, {transform: [{translateY: offset}]}]}
      />
      {children}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      image: {
        bottom: -80,
        height: 'auto',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        width: 'auto',
      },
    }) as const
)

export default PendingBackground
