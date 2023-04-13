import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import * as Container from '../../../../../util/container'

const lightPatternImage = require('../../../../../images/payment-pattern-80.png')
const darkPatternImage = require('../../../../../images/dark-payment-pattern-80.png')

const PendingBackground = () => {
  const offset = React.useRef(new Kb.NativeAnimated.Value(0)).current

  Container.useOnMountOnce(() => {
    Kb.NativeAnimated.loop(
      Kb.NativeAnimated.timing(offset, {
        duration: 2000,
        easing: Kb.NativeEasing.linear,
        toValue: -80,
        useNativeDriver: true,
      })
    ).start()
  })

  const source = Styles.isDarkMode() ? darkPatternImage : lightPatternImage

  return (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.NativeAnimated.Image
        resizeMode="repeat"
        source={source}
        style={[styles.image, {transform: [{translateY: offset}] as any}]}
      />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        bottom: 0,
        left: 0,
        overflow: 'hidden',
        position: 'absolute',
        right: 0,
        top: 0,
      },
      image: {
        bottom: -80,
        height: 'auto',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        width: 'auto',
      },
    } as const)
)

export default PendingBackground
