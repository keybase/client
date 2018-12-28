// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import type {Props} from '.'

const patternImage = require('../../../../../images/payment-pattern-80.png')

type State = {
  yOffset: Kb.NativeAnimated.Value,
}
class PendingBackground extends React.Component<Props, State> {
  state = {yOffset: new Kb.NativeAnimated.Value(0)}

  componentDidMount() {
    Kb.NativeAnimated.loop(
      Kb.NativeAnimated.timing(this.state.yOffset, {
        duration: 1000,
        easing: Kb.NativeEasing.linear,
        toValue: -80,
        useNativeDriver: true,
      })
    ).start()
  }

  render() {
    return (
      <>
        <Kb.NativeAnimated.Image
          resizeMode="repeat"
          source={patternImage}
          style={{
            bottom: -80,
            height: 'auto',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
            transform: [{translateY: this.state.yOffset}],
            width: 'auto',
          }}
        />
        {this.props.children}
      </>
    )
  }
}

export default PendingBackground
