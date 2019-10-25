import * as React from 'react'
import Box from './box'
import {Props} from './animation'

const defaultDimension = 16

const Animation = (props: Props) => {
  const animationData = require('./animation-data.json')
  // jest doesnt' support canvas out of the box, so lets just not do anything
  if (__STORYSHOT__) {
    return (
      <Box>
        {JSON.stringify({
          height: props.height || defaultDimension,
          options: {animationData: animationData[props.animationType]},
          style: props.style,
          width: props.width || defaultDimension,
        })}
      </Box>
    )
  }
  // jest pukes if the import is on top so just defer till render
  const Lottie = require('lottie-react-web').default
  return (
    <Box className={props.className} style={props.containerStyle}>
      <Lottie
        options={{animationData: animationData[props.animationType]}}
        width={props.width || defaultDimension}
        height={props.height || defaultDimension}
        style={props.style}
      />
    </Box>
  )
}

export default Animation
