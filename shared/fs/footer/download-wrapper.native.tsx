import * as React from 'react'
import Download, {Props} from './download'
import {NativeAnimated, NativeEasing} from '../../common-adapters/mobile.native'

type State = {
  opacity: NativeAnimated.AnimatedValue
}

export default class DownloadNativeWrapper extends React.PureComponent<Props, State> {
  _opacity = new NativeAnimated.Value(1)
  _opacityAnimation = NativeAnimated.timing(this._opacity, {
    duration: 3000,
    easing: NativeEasing.linear,
    toValue: 0,
  })

  _started = false
  _ensureStarted = () => {
    if (this._started) {
      return
    }
    this._started = true
    this._opacityAnimation.start(({finished}) => finished && this.props.dismiss())
  }
  _ensureStopped = () => {
    if (!this._started) {
      return
    }
    this._opacityAnimation.stop()
    this._opacity.setValue(1)
    this._started = false
  }

  _update = () => {
    this.props.isFirst && this.props.isDone ? this._ensureStarted() : this._ensureStopped()
  }

  componentDidMount() {
    this._update()
  }
  componentDidUpdate() {
    this._update()
  }
  componentWillUnmount() {
    this._ensureStopped()
  }

  render() {
    return (
      <NativeAnimated.View style={{opacity: this._opacity}}>
        <Download {...this.props} />
      </NativeAnimated.View>
    )
  }
}
