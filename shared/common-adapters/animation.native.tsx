import * as React from 'react'
import LottieView from 'lottie-react-native'
import Box from './box'
// @ts-ignore
import animationData from './animation-data.json'
import {Props} from './animation'

class Animation extends React.Component<Props> {
  render() {
    return (
      <Box style={this.props.containerStyle}>
        <LottieView
          autoPlay={true}
          loop={true}
          source={animationData[this.props.animationType]}
          // @ts-ignore TODO fix styles
          style={this.props.style || {}}
        />
      </Box>
    )
  }
}

export default Animation
