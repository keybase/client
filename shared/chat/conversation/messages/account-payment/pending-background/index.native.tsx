import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {Props} from '.'

const patternImage = require('../../../../../images/payment-pattern-80.png')

type State = {
  yOffset: Kb.NativeAnimated.Value
}

class PendingBackground extends React.Component<Props, State> {
  state = {yOffset: new Kb.NativeAnimated.Value(0)}

  componentDidMount() {
    Kb.NativeAnimated.loop(
      Kb.NativeAnimated.timing(this.state.yOffset, {
        duration: 2000,
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
          style={Styles.collapseStyles([
            styles.image,
            {
              transform: [{translateY: this.state.yOffset}],
            },
          ])}
        />
        {this.props.children}
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
  image: {
    bottom: -80,
    height: 'auto',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 'auto',
  },
})

export default PendingBackground
