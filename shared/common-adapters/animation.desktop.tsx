import * as React from 'react'
import Box from './box'
import {Props, AnimationType} from './animation'

const defaultDimension = 16

const _typeToData = new Map()

const getOptions = (type: AnimationType) => {
  const existing = _typeToData.get(type)
  if (existing) {
    return existing
  }
  const animationData = require('./animation-data.json')

  const options = {animationData: animationData[type]}
  _typeToData.set(type, options)
  return options
}

const Animation = (props: Props) => {
  // jest doesnt' support canvas out of the box, so lets just not do anything
  if (__STORYSHOT__) {
    return (
      <Box>
        {JSON.stringify({
          height: props.height || defaultDimension,
          options: getOptions(props.animationType),
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
        options={getOptions(props.animationType)}
        width={props.width || defaultDimension}
        height={props.height || defaultDimension}
        style={props.style}
      />
    </Box>
  )
}

export default Animation
