// @flow
import React from 'react'
import Lottie from 'lottie-react-web'
import Box from './box'
import animationData from './animation.json'
import type {Props} from './animation'

const defaultDimension = 16

const Animation = (props: Props) => (
  <Box style={props.containerStyle}>
    <Lottie
      options={{animationData: animationData[props.animationType]}}
      width={props.width || defaultDimension}
      height={props.height || defaultDimension}
      style={props.style}
    />
  </Box>
)

export default Animation
