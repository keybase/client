import * as React from 'react'
import {Animated} from 'react-native'
import Box from './box'

type Props = {
  loading: boolean
  style?: Object
  doneLoadingComponent: React.ReactNode
  loadingComponent: React.ReactNode
  duration: number
}

type State = {
  opacity: any
  loadingActive: boolean
}

class LoadingWrapper extends React.Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      loadingActive: this.props.loading,
      opacity: new Animated.Value(1),
    }
  }

  _doAnimation() {
    const {duration} = this.props
    this.setState({loadingActive: true})

    this.state.opacity.setValue(1)
    Animated.parallel(
      [[this.state.opacity, 0]].map(([a, toValue]) => Animated.timing(a, {duration, toValue}))
    ).start(({finished}) => finished && this.setState({loadingActive: false}))
  }

  render() {
    return (
      <Box style={{position: 'relative', ...this.props.style}}>
        {!this.props.loading && this.props.doneLoadingComponent}
        {this.state.loadingActive && (
          <Animated.View
            style={{
              left: 0,
              opacity: this.state.opacity,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          >
            {this.props.loadingComponent}
          </Animated.View>
        )}
      </Box>
    )
  }

  componentDidMount() {
    if (!this.props.loading) {
      this._doAnimation()
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.loading && !this.props.loading) {
      this._doAnimation()
    }
  }
}

export default LoadingWrapper
