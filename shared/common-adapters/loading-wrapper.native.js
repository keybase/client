// @flow
import React, {Component} from 'react'
import {Animated} from 'react-native'
import Box from './box'

type Props = {
  loading: boolean,
  style?: Object,
  doneLoadingComponent: React$Element<*>,
  loadingComponent: React$Element<*>,
  duration: number,
}

type State = {
  opacity: any,
  loadingActive: boolean,
}

class LoadingWrapper extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      opacity: new Animated.Value(1),
      loadingActive: this.props.loading,
    }
  }

  _doAnimation() {
    const {duration} = this.props
    this.setState({loadingActive: true})

    this.state.opacity.setValue(1)
    Animated.parallel(
      [[this.state.opacity, 0]].map(([a, toValue]) =>
        Animated.timing(a, {duration, toValue})
      )
    ).start(({finished}) => finished && this.setState({loadingActive: false}))
  }

  render() {
    return (
      <Box style={{position: 'relative', ...this.props.style}}>
        {!this.props.loading && this.props.doneLoadingComponent}
        {this.state.loadingActive &&
          <Animated.View
            style={{
              opacity: this.state.opacity,
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
            }}
          >
            {this.props.loadingComponent}
          </Animated.View>}
      </Box>
    )
  }

  componentDidMount() {
    if (!this.props.loading) {
      this._doAnimation()
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.loading && !nextProps.loading) {
      this._doAnimation()
    }
  }
}

export default LoadingWrapper
