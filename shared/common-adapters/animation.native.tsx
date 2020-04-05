import * as React from 'react'
import LottieView from 'lottie-react-native'
import Box from './box'
import {Props} from './animation'

const Animation = (props: Props) => {
  const animationData = require('./animation-data.json')
  return (
    <Box style={props.containerStyle}>
      <LottieView
        autoPlay={true}
        loop={true}
        source={animationData[props.animationType]}
        style={props.style || {}}
      />
    </Box>
  )
}

export default Animation
