import * as C from '../../../../../constants'
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as KbMobile from '../../../../../common-adapters/mobile.native'
import type {Props} from '.'

const lightPatternImage = require('../../../../../images/payment-pattern-80.png')
const darkPatternImage = require('../../../../../images/dark-payment-pattern-80.png')

const PendingBackground = (p: Props) => {
  const {children, style} = p
  const offset = React.useRef(new KbMobile.NativeAnimated.Value(0)).current

  C.useOnMountOnce(() => {
    KbMobile.NativeAnimated.loop(
      KbMobile.NativeAnimated.timing(offset, {
        duration: 2000,
        easing: KbMobile.NativeEasing.linear,
        toValue: -80,
        useNativeDriver: true,
      })
    ).start()
  })

  const source = Kb.Styles.isDarkMode() ? darkPatternImage : lightPatternImage

  return (
    <Kb.Box2 direction="vertical" style={style}>
      <KbMobile.NativeAnimated.Image
        resizeMode="repeat"
        source={source}
        style={[styles.image, {transform: [{translateY: offset}] as any}]}
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
