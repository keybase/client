// @flow
import React, {Component} from 'react'
import {Animated} from 'react-native'
import Box from './box'
import Button from './button'
import HOCTimers from './hoc-timers'

import type {TimerProps} from './hoc-timers'

type Props = {
  loading: boolean,
  style?: Object,
  doneLoadingComponent: React$Element<*>,
  loadingComponent: React$Element<*>,
  duration: number,
  debugAnim?: boolean,
} & TimerProps

type State = {
  opacity: any,
  opacityInv: any,
  loadingActive: boolean,
  loadingActiveTimeoutId: ?number,
}

class LoadingWrapper extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      opacity: new Animated.Value(0),
      opacityInv: new Animated.Value(1),
      loadingActive: this.props.loading,
      loadingActiveTimeoutId: null,
    }
  }

  _doAnimation () {
    const {duration} = this.props
    this.setState({loadingActive: true})
    this.props.clearTimeout(this.state.loadingActiveTimeoutId)

    this.state.opacity.setValue(0)
    this.state.opacityInv.setValue(1)
    Animated.parallel(
      [[this.state.opacity, 1], [this.state.opacityInv, 0]].map(
        ([a, toValue]) => Animated.timing(a, {duration, toValue})
      )
    ).start()

    const loadingActiveTimeoutId = this.props.setTimeout(() => this.setState({loadingActive: false}), this.props.duration)
    this.setState({loadingActiveTimeoutId})
  }

  render () {
    return (
      <Box style={{position: 'relative', ...this.props.style}}>
        {!this.props.loading && this.props.doneLoadingComponent}
        {this.state.loadingActive &&
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              opacity: this.state.opacityInv,
            }}>
            {this.props.loadingComponent}
          </ Animated.View>}
        {this.props.debugAnim && <Button label={'Redo animation'} type='Primary' onClick={() => this._doAnimation()} />}
      </Box>
    )
  }

  componentDidMount () {
    if (!this.props.loading) {
      this._doAnimation()
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.loading && !nextProps.loading) {
      this._doAnimation()
    }
  }
}

export default HOCTimers(LoadingWrapper)
