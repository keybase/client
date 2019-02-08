// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import type {Props} from '.'

type State = {
  zoom: Kb.NativeAnimated.Value,
}
class EmphasisBox extends React.Component<Props, State> {
  state = {zoom: new Kb.NativeAnimated.Value(1)}
  _animation = Kb.NativeAnimated.loop(
    Kb.NativeAnimated.sequence([
      Kb.NativeAnimated.timing(this.state.zoom, {
        duration: 500,
        toValue: 1.05,
        useNativeDriver: true,
      }),
      Kb.NativeAnimated.timing(this.state.zoom, {
        duration: 500,
        toValue: 1,
        useNativeDriver: true,
      }),
    ])
  )

  componentDidMount() {
    if (this.props.emphasize) {
      this._animation.start()
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.emphasize && !prevProps.emphasize) {
      this._animation.start()
    }
    if (!this.props.emphasize && prevProps.emphasize) {
      this._animation.stop()
    }
  }

  componentWillUnmount() {
    this._animation.stop()
  }

  render() {
    return (
      <Kb.NativeAnimated.View style={{transform: [{scale: this.state.zoom}]}}>
        {this.props.children}
      </Kb.NativeAnimated.View>
    )
  }
}

export default EmphasisBox
