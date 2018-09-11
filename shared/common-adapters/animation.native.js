// @flow
import React from 'react'
import LottieView from 'lottie-react-native'
import Box from './box'
import animationData from './animation.json'
import type {Props} from './animation'

const Animation = (props: Props) => (
  <Box style={props.containerStyle}>
    <LottieView
      autoPlay={true}
      loop={true}
      source={animationData[props.animationType]}
      style={props.style || {}}
    />
  </Box>
)

export default Animation
