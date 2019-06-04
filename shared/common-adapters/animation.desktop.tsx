import * as React from 'react'
import Box from './box'
// @ts-ignore
import animationData from './animation-data.json'
import {Props} from './animation'

const defaultDimension = 16

class Animation extends React.Component<Props> {
  render() {
    // jest doesnt' support canvas out of the box, so lets just not do anything
    if (__STORYSHOT__) {
      return (
        <Box>
          {JSON.stringify({
            height: this.props.height || defaultDimension,
            options: {animationData: animationData[this.props.animationType]},
            style: this.props.style,
            width: this.props.width || defaultDimension,
          })}
        </Box>
      )
    }
    // jest pukes if the import is on top so just defer till render
    const Lottie = require('lottie-react-web').default
    return (
      <Box style={this.props.containerStyle}>
        <Lottie
          options={{animationData: animationData[this.props.animationType]}}
          width={this.props.width || defaultDimension}
          height={this.props.height || defaultDimension}
          style={this.props.style}
        />
      </Box>
    )
  }
}

export default Animation
